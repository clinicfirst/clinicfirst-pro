import { EXPANDED_CHUNKS, EXPANDED_CASES } from './eval-data-expanded';

process.env.VITE_SUPABASE_URL = "http://mock-supabase.local";
process.env.SUPABASE_SERVICE_ROLE_KEY = "dummy-key";
process.env.OFFLINE_MODE = "false";
process.env.NODE_ENV = "test";

function cosineSimilarity(vecA: number[], vecB: number[]) {
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function runBaselineOnly() {
  const { RagService } = await import('../services/rag.service.js');
  console.log("Running Baseline-Only Verification on Expanded Dataset...");
  
  // Cache check or compute
  const fs = await import('fs');
  const path = await import('path');
  const cacheFile = path.join(process.cwd(), 'server', 'scripts', '.embedding-cache.json');
  let cache: Record<string, number[]> = {};
  if (fs.existsSync(cacheFile)) {
    cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  }

  const chunkEmbs = new Map<string, number[]>();
  for (const c of EXPANDED_CHUNKS) {
    const key = `baseline_doc:${c.chunk_text}`;
    if (cache[key]) {
      chunkEmbs.set(c.id, cache[key]);
    } else {
      const emb = await RagService.generateEmbedding(c.chunk_text);
      cache[key] = emb;
      chunkEmbs.set(c.id, emb);
    }
  }

  const queryEmbs = new Map<string, number[]>();
  for (const tc of EXPANDED_CASES) {
    const key = `baseline_query:${tc.q}`;
    if (cache[key]) {
      queryEmbs.set(tc.id, cache[key]);
    } else {
      const emb = await RagService.generateEmbedding(tc.q);
      cache[key] = emb;
      queryEmbs.set(tc.id, emb);
    }
  }
  fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));

  const answerable = EXPANDED_CASES.filter(c => c.expected.length > 0);
  const unanswerable = EXPANDED_CASES.filter(c => c.expected.length === 0);

  let recall3 = 0;
  let correctAbstain = 0;

  for (const tc of answerable) {
    const qEmb = queryEmbs.get(tc.id)!;
    const scored = EXPANDED_CHUNKS
      .filter(c => c.clinic_id === (tc.target_clinic || 'clinic_A') && c.release_status === 'PUBLISHED')
      .map(c => ({ id: c.id, score: cosineSimilarity(chunkEmbs.get(c.id)!, qEmb) }))
      .sort((a, b) => b.score - a.score)
      .filter(s => s.score >= 0.60);
    
    if (scored.slice(0, 3).some(s => tc.expected.includes(s.id))) {
      recall3++;
    }
  }

  for (const tc of unanswerable) {
    const qEmb = queryEmbs.get(tc.id)!;
    const scored = EXPANDED_CHUNKS
      .filter(c => c.clinic_id === (tc.target_clinic || 'clinic_A') && c.release_status === 'PUBLISHED')
      .map(c => ({ id: c.id, score: cosineSimilarity(chunkEmbs.get(c.id)!, qEmb) }))
      .sort((a, b) => b.score - a.score)
      .filter(s => s.score >= 0.60);
    
    if (scored.length === 0) {
      correctAbstain++;
    }
  }

  console.log(`Baseline Recall@3 (Threshold 0.60): ${(recall3 / answerable.length * 100).toFixed(1)}%`);
  console.log(`Baseline Correct Abstention (Threshold 0.60): ${(correctAbstain / unanswerable.length * 100).toFixed(1)}%`);
}

runBaselineOnly().catch(console.error);
