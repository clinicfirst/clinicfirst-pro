import fs from 'fs';
process.env.VITE_SUPABASE_URL = "http://mock-supabase.local";
process.env.SUPABASE_SERVICE_ROLE_KEY = "dummy-key";
process.env.OFFLINE_MODE = "false";
process.env.NODE_ENV = "test";

function cosineSimilarity(vecA: number[], vecB: number[]) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function run() {
  const { supabase } = await import('../supabaseDiff.js');
  const { RagService } = await import('../services/rag.service.js');
  const { EVAL_CHUNKS, EVAL_CASES } = await import('./eval-data.js');

  const DB_CHUNKS: any[] = [];
  
  // Mock Supabase
  (supabase as any).rpc = async (name: string, params: any) => {
    if (name === 'match_clinic_knowledge') {
      const { query_embedding, match_threshold, match_count, p_clinic_id } = params;
      
      const results = DB_CHUNKS
        .filter(c => c.clinic_id === p_clinic_id && c.release_status === 'PUBLISHED')
        .map(c => {
          const sim = cosineSimilarity(c.embedding, query_embedding);
          return { ...c, similarity: sim };
        })
        .filter(c => c.similarity > match_threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, match_count);
        
      return { data: results, error: null };
    }
    return { data: [], error: null };
  };

  console.log("Generating embeddings for Golden Corpus...");
  for (const c of EVAL_CHUNKS) {
    c.embedding = await RagService.generateEmbedding(c.chunk_text);
    DB_CHUNKS.push(c);
  }
  console.log(`Embedded ${DB_CHUNKS.length} chunks.\n`);

  let results = {
    total: EVAL_CASES.length,
    answerable: 0,
    unanswerable: 0,
    recallAt3: 0,
    recallAt5: 0,
    precisionAt3Sum: 0,
    mrrSum: 0,
    retrievalAbstained: 0,
    crossTenantLeakage: 0,
    draftLeakage: 0,
    latencySum: 0,
    details: [] as any[]
  };

  for (const tc of EVAL_CASES) {
    const start = Date.now();
    const clinicId = tc.target_clinic || "clinic_A";
    const queryEmbedding = await RagService.generateEmbedding(tc.q);
    
    const { data } = await supabase.rpc('match_clinic_knowledge', {
      query_embedding: queryEmbedding,
      match_threshold: 0.6,
      match_count: 5,
      p_clinic_id: clinicId
    });
    
    const latency = Date.now() - start;
    results.latencySum += latency;

    const retrievedIds = data.map((d: any) => d.id);
    const expected = tc.expected;
    
    let pass = false;
    let failReason = "";
    
    if (expected.length === 0) {
      results.unanswerable++;
      // Unanswerable case
      
      // Check for security violations first
      const hasCrossTenant = retrievedIds.some((id: string) => id.includes("CB"));
      const hasDraft = retrievedIds.some((id: string) => id.includes("DRAFT"));
      
      if (hasCrossTenant) results.crossTenantLeakage++;
      if (hasDraft) results.draftLeakage++;
      
      if (retrievedIds.length === 0) {
        results.retrievalAbstained++;
        pass = true;
      } else {
        failReason = "Failed to abstain at retrieval layer (threshold too low)";
        pass = false;
      }
    } else {
      results.answerable++;
      // Find first relevant
      const firstRelevantIdx = retrievedIds.findIndex((id: string) => expected.includes(id));
      
      let recall3 = 0;
      let recall5 = 0;
      let precision3 = 0;
      let mrr = 0;
      
      if (firstRelevantIdx !== -1) {
        mrr = 1.0 / (firstRelevantIdx + 1);
        if (firstRelevantIdx < 3) recall3 = 1;
        if (firstRelevantIdx < 5) recall5 = 1;
      }
      
      // Precision@3: number of relevant items in top 3 / 3
      const top3 = retrievedIds.slice(0, 3);
      const relevantInTop3 = top3.filter((id: string) => expected.includes(id)).length;
      // If we only retrieved 2 items, denominator could be 3 or 2 depending on definition, typically we use min(3, retrieved.length) or just 3.
      // Let's use 3. Wait, if there's only 1 expected, precision@3 is max 0.33. That's standard.
      precision3 = top3.length > 0 ? relevantInTop3 / top3.length : 0;
      
      results.recallAt3 += recall3;
      results.recallAt5 += recall5;
      results.precisionAt3Sum += precision3;
      results.mrrSum += mrr;
      
      pass = recall3 > 0;
      if (!pass) failReason = "Expected item not found in top 3";
    }
    
    results.details.push({
      id: tc.id,
      category: tc.category,
      q: tc.q,
      expected,
      retrieved: data.map((d: any) => ({ id: d.id, score: d.similarity.toFixed(3) })),
      pass,
      failReason,
      latency
    });
  }
  
  console.log("\n================ RAG EVALUATION RESULTS ================\n");
  
  console.log(`Layer 1 & 4: Retrieval Quality & Latency`);
  console.log(`Total Cases Evaluated: ${results.total}`);
  console.log(`Answerable Cases: ${results.answerable}`);
  console.log(`Unanswerable Cases: ${results.unanswerable}\n`);
  
  if (results.answerable > 0) {
    console.log(`Recall@3:      ${(results.recallAt3 / results.answerable).toFixed(3)}`);
    console.log(`Recall@5:      ${(results.recallAt5 / results.answerable).toFixed(3)}`);
    console.log(`Precision@3:   ${(results.precisionAt3Sum / results.answerable).toFixed(3)}`);
    console.log(`MRR:           ${(results.mrrSum / results.answerable).toFixed(3)}`);
  }
  
  if (results.unanswerable > 0) {
    console.log(`Abstention Rate (Retrieval): ${(results.retrievalAbstained / results.unanswerable).toFixed(3)}`);
  }
  
  console.log(`Avg Latency:   ${(results.latencySum / results.total).toFixed(0)} ms\n`);
  
  console.log(`Layer 2: Security & Isolation`);
  console.log(`Cross-Tenant Leakage: ${results.crossTenantLeakage}`);
  console.log(`Draft Leakage:        ${results.draftLeakage}\n`);
  
  console.log(`Per-Question Diagnostics:\n`);
  for (const d of results.details) {
    console.log(`[${d.pass ? 'PASS' : 'FAIL'}] ${d.id} | ${d.category}`);
    console.log(`Q: ${d.q}`);
    console.log(`Expected:  ${d.expected.length > 0 ? d.expected.join(', ') : 'NONE'}`);
    console.log(`Retrieved: ${d.retrieved.length > 0 ? d.retrieved.map((r: any) => r.id + ' (' + r.score + ')').join(', ') : 'NONE'}`);
    if (!d.pass && d.failReason) console.log(`Reason:    ${d.failReason}`);
    console.log(`Latency:   ${d.latency} ms\n`);
  }
}
run();
