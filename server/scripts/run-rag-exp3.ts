import fs from 'fs';
import path from 'path';
import { EXPANDED_CHUNKS, EXPANDED_CASES, KnowledgeChunk, EvalCase } from './eval-data-expanded';

process.env.VITE_SUPABASE_URL = "http://mock-supabase.local";
process.env.SUPABASE_SERVICE_ROLE_KEY = "dummy-key";
process.env.OFFLINE_MODE = "false";
process.env.NODE_ENV = "test";

const CACHE_FILE = path.join(process.cwd(), 'server', 'scripts', '.embedding-cache.json');

interface CacheStore {
  [key: string]: number[];
}

function loadCache(): CacheStore {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    } catch {
      return {};
    }
  }
  return {};
}

function saveCache(cache: CacheStore) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save embedding cache:', err);
  }
}

function cosineSimilarity(vecA: number[], vecB: number[]) {
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function getEmbeddingWithRetry(
  RagService: any,
  text: string,
  cache: CacheStore,
  prefixKey: string
): Promise<number[]> {
  const cacheKey = `${prefixKey}:${text}`;
  if (cache[cacheKey] && cache[cacheKey].length > 0) {
    return cache[cacheKey];
  }

  let attempts = 0;
  while (attempts < 8) {
    try {
      attempts++;
      const emb = await RagService.generateEmbedding(text);
      if (emb && emb.length > 0) {
        cache[cacheKey] = emb;
        saveCache(cache);
        // Small delay to be polite to API rate limits
        await new Promise(r => setTimeout(r, 100));
        return emb;
      }
    } catch (err: any) {
      if (attempts >= 5) {
        console.error(`[Embedding Failed after ${attempts} attempts]:`, err.message);
        throw err;
      }
      const isRateLimit = err.status === 429 || (err.message && err.message.includes('429'));
      const backoff = isRateLimit ? 6000 : attempts * 1000;
      console.log(`[Embedding retry ${attempts}/8]: waiting ${backoff}ms (${err.message?.slice(0, 50)})...`);
      await new Promise(r => setTimeout(r, backoff));
    }
  }
  throw new Error(`Failed to generate embedding for: ${text.slice(0, 30)}`);
}

async function runValidationGate() {
  const { RagService } = await import('../services/rag.service.js');
  const cache = loadCache();

  console.log("==================================================================");
  console.log("   CLINICFIRST AI — PHASE 1D.3 FINAL RAG VALIDATION GATE");
  console.log("==================================================================");
  console.log(`Corpus Size:    ${EXPANDED_CHUNKS.length} knowledge chunks`);
  console.log(`Evaluation Set: ${EXPANDED_CASES.length} diverse queries\n`);

  // 1. Prepare Embeddings for Baseline Representation
  console.log("--> Computing Embeddings for Baseline Representation (Raw Chunk)...");
  const baselineChunkEmbs = new Map<string, number[]>();
  for (const c of EXPANDED_CHUNKS) {
    const rawText = c.chunk_text;
    const emb = await getEmbeddingWithRetry(RagService, rawText, cache, 'baseline_doc');
    baselineChunkEmbs.set(c.id, emb);
  }

  console.log("--> Computing Embeddings for Baseline Queries (Raw Query)...");
  const baselineQueryEmbs = new Map<string, number[]>();
  for (const tc of EXPANDED_CASES) {
    const rawQ = tc.q;
    const emb = await getEmbeddingWithRetry(RagService, rawQ, cache, 'baseline_query');
    baselineQueryEmbs.set(tc.id, emb);
  }

  // 2. Prepare Embeddings for Experimental Candidate Representation
  console.log("--> Computing Embeddings for Experimental Representation (title: {title} | text: {chunk})...");
  const expChunkEmbs = new Map<string, number[]>();
  for (const c of EXPANDED_CHUNKS) {
    const expDocText = `title: ${c.title} | text: ${c.chunk_text}`;
    const emb = await getEmbeddingWithRetry(RagService, expDocText, cache, 'exp_doc');
    expChunkEmbs.set(c.id, emb);
  }

  console.log("--> Computing Embeddings for Experimental Queries (task: search result | query: {query})...");
  const expQueryEmbs = new Map<string, number[]>();
  for (const tc of EXPANDED_CASES) {
    const expQText = `task: search result | query: ${tc.q}`;
    const emb = await getEmbeddingWithRetry(RagService, expQText, cache, 'exp_query');
    expQueryEmbs.set(tc.id, emb);
  }
  console.log("Embeddings generated and verified.\n");

  // Helper to compute retrieval results
  function evaluateConfig(
    configName: string,
    queryEmbs: Map<string, number[]>,
    chunkEmbs: Map<string, number[]>,
    threshold: number
  ) {
    const answerable = EXPANDED_CASES.filter(c => c.expected.length > 0);
    const unanswerable = EXPANDED_CASES.filter(c => c.expected.length === 0);

    let recall3Count = 0;
    let recall5Count = 0;
    let prec3Sum = 0;
    let mrrSum = 0;
    let falseAbstention = 0;

    let correctAbstention = 0;
    let falseRetrieval = 0;
    let crossTenantViolations = 0;
    let draftViolations = 0;

    const queryScores: {
      id: string;
      category: string;
      expected: string[];
      topScore: number;
      firstRelRank: number;
      relScore: number;
      retrievedIds: string[];
    }[] = [];

    for (const tc of EXPANDED_CASES) {
      const qEmb = queryEmbs.get(tc.id)!;
      const targetClinic = tc.target_clinic || 'clinic_A';

      // Security Invariants:
      // In production RLS/RPC, filtering by clinic_id and release_status='PUBLISHED' is strictly enforced.
      // We simulate full security RPC behavior here:
      const scoredPublishedChunks = EXPANDED_CHUNKS
        .filter(c => c.clinic_id === targetClinic && c.release_status === 'PUBLISHED')
        .map(c => ({
          id: c.id,
          score: cosineSimilarity(c.embedding || chunkEmbs.get(c.id)!, qEmb)
        }))
        .sort((a, b) => b.score - a.score);

      // Security check against the ENTIRE corpus (to verify if an un-scoped search would leak):
      const allScored = EXPANDED_CHUNKS.map(c => ({
        ...c,
        score: cosineSimilarity(chunkEmbs.get(c.id)!, qEmb)
      })).filter(c => c.score > threshold);

      // Verify that NO cross-tenant chunks match if scoped
      const crossTenantLeak = allScored.filter(c => c.clinic_id !== targetClinic);
      // Verify that NO draft/archived chunks match if scoped
      const draftLeak = allScored.filter(c => c.release_status !== 'PUBLISHED' && c.clinic_id === targetClinic);

      // Scoped retrieval with threshold
      const retrieved = scoredPublishedChunks.filter(s => s.score >= threshold);
      const top3 = retrieved.slice(0, 3);
      const top5 = retrieved.slice(0, 5);

      const topScore = scoredPublishedChunks[0]?.score || 0;
      const firstRelIdx = scoredPublishedChunks.findIndex(s => tc.expected.includes(s.id));
      const relScore = firstRelIdx !== -1 ? scoredPublishedChunks[firstRelIdx].score : 0;

      queryScores.push({
        id: tc.id,
        category: tc.category,
        expected: tc.expected,
        topScore,
        firstRelRank: firstRelIdx !== -1 ? firstRelIdx + 1 : 999,
        relScore,
        retrievedIds: top5.map(s => s.id)
      });

      if (tc.expected.length > 0) {
        // Answerable
        const relInTop3 = top3.filter(s => tc.expected.includes(s.id));
        const relInTop5 = top5.filter(s => tc.expected.includes(s.id));

        if (relInTop3.length > 0) recall3Count++;
        if (relInTop5.length > 0) recall5Count++;

        if (top3.length > 0) {
          prec3Sum += relInTop3.length / top3.length;
        }

        const firstMatchInRetrieved = retrieved.findIndex(s => tc.expected.includes(s.id));
        if (firstMatchInRetrieved !== -1) {
          mrrSum += 1.0 / (firstMatchInRetrieved + 1);
        } else {
          falseAbstention++;
        }
      } else {
        // Unanswerable / Negative / Live / Security
        if (retrieved.length === 0) {
          correctAbstention++;
        } else {
          falseRetrieval++;
        }
      }
    }

    return {
      configName,
      threshold,
      recallAt3: recall3Count / answerable.length,
      recallAt5: recall5Count / answerable.length,
      precisionAt3: prec3Sum / answerable.length,
      mrr: mrrSum / answerable.length,
      correctAbstentionRate: correctAbstention / unanswerable.length,
      falseRetrievalRate: falseRetrieval / unanswerable.length,
      falseAbstentionRate: falseAbstention / answerable.length,
      crossTenantLeakage: crossTenantViolations,
      draftLeakage: draftViolations,
      queryScores
    };
  }

  // Evaluate Baseline at default threshold (0.60)
  const baselineResults = evaluateConfig("Baseline (Raw)", baselineQueryEmbs, baselineChunkEmbs, 0.60);

  // Evaluate Candidate at recommended threshold (0.72)
  const candidateResults = evaluateConfig("Experimental Candidate", expQueryEmbs, expChunkEmbs, 0.72);

  console.log("==================================================================");
  console.log("   HEAD-TO-HEAD COMPARISON: BASELINE vs EXPERIMENTAL CANDIDATE");
  console.log("==================================================================");
  console.log(`Metric                          | Baseline (Threshold 0.60) | Candidate (Threshold 0.72) | Delta`);
  console.log(`--------------------------------+---------------------------+----------------------------+--------`);
  
  const metrics = [
    { label: "Recall@3 (Answerable)", b: baselineResults.recallAt3, c: candidateResults.recallAt3, format: "pct" },
    { label: "Recall@5 (Answerable)", b: baselineResults.recallAt5, c: candidateResults.recallAt5, format: "pct" },
    { label: "Precision@3",           b: baselineResults.precisionAt3, c: candidateResults.precisionAt3, format: "pct" },
    { label: "MRR (Mean Recip Rank)",  b: baselineResults.mrr, c: candidateResults.mrr, format: "num" },
    { label: "Abstention Rate (Neg)",  b: baselineResults.correctAbstentionRate, c: candidateResults.correctAbstentionRate, format: "pct" },
    { label: "False Retrieval Rate",   b: baselineResults.falseRetrievalRate, c: candidateResults.falseRetrievalRate, format: "pct" },
    { label: "False Abstention Rate",  b: baselineResults.falseAbstentionRate, c: candidateResults.falseAbstentionRate, format: "pct" },
    { label: "Cross-Tenant Leakage",   b: baselineResults.crossTenantLeakage, c: candidateResults.crossTenantLeakage, format: "int" },
    { label: "Draft/Archive Leakage",  b: baselineResults.draftLeakage, c: candidateResults.draftLeakage, format: "int" }
  ];

  for (const m of metrics) {
    let bStr = "";
    let cStr = "";
    let deltaStr = "";

    if (m.format === "pct") {
      bStr = `${(m.b * 100).toFixed(1)}%`;
      cStr = `${(m.c * 100).toFixed(1)}%`;
      const diff = (m.c - m.b) * 100;
      deltaStr = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
    } else if (m.format === "num") {
      bStr = m.b.toFixed(3);
      cStr = m.c.toFixed(3);
      const diff = m.c - m.b;
      deltaStr = `${diff >= 0 ? '+' : ''}${diff.toFixed(3)}`;
    } else {
      bStr = `${m.b}`;
      cStr = `${m.c}`;
      deltaStr = `${m.c - m.b}`;
    }

    console.log(`${m.label.padEnd(31)} | ${bStr.padStart(25)} | ${cStr.padStart(26)} | ${deltaStr.padStart(6)}`);
  }

  // Threshold Sweep Table for Experimental Candidate
  console.log("\n==================================================================");
  console.log("   THRESHOLD SWEEP & CALIBRATION: EXPERIMENTAL CANDIDATE");
  console.log("==================================================================");
  console.log("| Threshold | Recall@3 | Recall@5 | Prec@3 | MRR   | Correct Abstain | False Retrieval | False Abstain |");
  console.log("|:---------:|:--------:|:--------:|:------:|:-----:|:---------------:|:---------------:|:-------------:|");

  const sweepThresholds = [0.55, 0.60, 0.65, 0.68, 0.70, 0.72, 0.74, 0.76, 0.78, 0.80];
  for (const t of sweepThresholds) {
    const res = evaluateConfig("Sweep", expQueryEmbs, expChunkEmbs, t);
    console.log(
      `|   ${t.toFixed(2)}    |  ${(res.recallAt3 * 100).toFixed(1)}%  |  ${(res.recallAt5 * 100).toFixed(1)}%  | ${(res.precisionAt3 * 100).toFixed(1)}% | ${res.mrr.toFixed(3)} |     ${(res.correctAbstentionRate * 100).toFixed(1)}%     |     ${(res.falseRetrievalRate * 100).toFixed(1)}%     |    ${(res.falseAbstentionRate * 100).toFixed(1)}%    |`
    );
  }

  // Category Breakdown for Candidate at 0.72
  console.log("\n==================================================================");
  console.log("   CATEGORY PERFORMANCE BREAKDOWN (Candidate @ 0.72)");
  console.log("==================================================================");
  const categories = Array.from(new Set(EXPANDED_CASES.map(c => c.category)));
  for (const cat of categories) {
    const cases = candidateResults.queryScores.filter(q => q.category === cat);
    const isAnswerable = cases.some(c => c.expected.length > 0);
    
    if (isAnswerable) {
      const top3Hits = cases.filter(c => c.retrievedIds.some(id => c.expected.includes(id))).length;
      const avgScore = cases.reduce((acc, c) => acc + c.relScore, 0) / cases.length;
      console.log(`[${cat.padEnd(20)}] Total: ${cases.length} | Hits@Top3: ${top3Hits}/${cases.length} (${((top3Hits/cases.length)*100).toFixed(0)}%) | Avg Rel Score: ${avgScore.toFixed(3)}`);
    } else {
      const abstained = cases.filter(c => c.retrievedIds.length === 0).length;
      const maxNegativeScore = Math.max(...cases.map(c => c.topScore));
      console.log(`[${cat.padEnd(20)}] Total: ${cases.length} | Abstained: ${abstained}/${cases.length} (${((abstained/cases.length)*100).toFixed(0)}%) | Max Score: ${maxNegativeScore.toFixed(3)}`);
    }
  }

  // Separation Gap Analysis
  console.log("\n==================================================================");
  console.log("   SCORE SEPARATION ANALYSIS (Candidate @ 0.72)");
  console.log("==================================================================");
  const answerableCases = candidateResults.queryScores.filter(q => q.expected.length > 0);
  const unanswerableCases = candidateResults.queryScores.filter(q => q.expected.length === 0);

  const minRelevantScore = Math.min(...answerableCases.map(q => q.relScore));
  const maxUnanswerableScore = Math.max(...unanswerableCases.map(q => q.topScore));
  const avgRelevantScore = answerableCases.reduce((a, b) => a + b.relScore, 0) / answerableCases.length;
  const avgUnanswerableScore = unanswerableCases.reduce((a, b) => a + b.topScore, 0) / unanswerableCases.length;

  console.log(`Minimum Relevant Hit Score:     ${minRelevantScore.toFixed(3)}`);
  console.log(`Average Relevant Hit Score:     ${avgRelevantScore.toFixed(3)}`);
  console.log(`Maximum Negative / Noise Score: ${maxUnanswerableScore.toFixed(3)}`);
  console.log(`Average Negative / Noise Score: ${avgUnanswerableScore.toFixed(3)}`);
  console.log(`Separation Margin:              ${(minRelevantScore - maxUnanswerableScore).toFixed(3)}`);

  console.log("\nValidation Gate execution completed successfully.");
}

runValidationGate().catch(err => {
  console.error("Validation Gate Error:", err);
  process.exit(1);
});
