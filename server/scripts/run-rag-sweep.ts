import fs from 'fs';
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

async function run() {
  const { supabase } = await import('../supabaseDiff.js');
  const { RagService } = await import('../services/rag.service.js');
  const { EVAL_CHUNKS, EVAL_CASES } = await import('./eval-data.js');

  console.log("Generating embeddings for Golden Corpus...");
  const chunkEmbeddings = new Map();
  for (const c of EVAL_CHUNKS) {
    c.embedding = await RagService.generateEmbedding(c.chunk_text);
    chunkEmbeddings.set(c.id, c);
  }

  console.log("Generating embeddings for Queries...");
  const queryData = [];
  for (const tc of EVAL_CASES) {
    const qEmb = await RagService.generateEmbedding(tc.q);
    const clinicId = tc.target_clinic || "clinic_A";
    
    // Calculate similarities against all PUBLISHED chunks for the target clinic
    const similarities = [];
    for (const c of EVAL_CHUNKS) {
      if (c.clinic_id === clinicId && c.release_status === 'PUBLISHED') {
        const sim = cosineSimilarity(c.embedding!, qEmb);
        similarities.push({ id: c.id, score: sim });
      }
    }
    similarities.sort((a, b) => b.score - a.score);
    
    queryData.push({
      ...tc,
      similarities
    });
  }

  // Threshold Sweep
  const thresholds = [0.60, 0.65, 0.70, 0.72, 0.74, 0.75, 0.76, 0.78, 0.80];
  
  console.log("\n| Threshold | Recall@3 | Recall@5 | Precision@3 | MRR | Correct Abstention | False Retrieval | False Abstention |");
  console.log("| --------: | -------: | -------: | ----------: | --: | -----------------: | --------------: | ---------------: |");
  
  const answerable = queryData.filter(q => q.expected.length > 0);
  const unanswerable = queryData.filter(q => q.expected.length === 0);
  
  for (const t of thresholds) {
    let r3 = 0, r5 = 0, p3 = 0, mrrSum = 0;
    let falseAbstention = 0; // Answerable query, but didn't retrieve expected due to threshold
    
    for (const q of answerable) {
      const retrieved = q.similarities.filter(s => s.score > t);
      if (retrieved.length === 0) {
        falseAbstention++;
        continue;
      }
      
      const firstRelevantIdx = retrieved.findIndex(s => q.expected.includes(s.id));
      if (firstRelevantIdx !== -1) {
        mrrSum += 1.0 / (firstRelevantIdx + 1);
        if (firstRelevantIdx < 3) r3++;
        if (firstRelevantIdx < 5) r5++;
      } else {
        falseAbstention++;
      }
      
      const top3 = retrieved.slice(0, 3);
      const relInTop3 = top3.filter(s => q.expected.includes(s.id)).length;
      if (top3.length > 0) p3 += (relInTop3 / top3.length);
    }
    
    let correctAbstention = 0;
    let falseRetrieval = 0;
    
    for (const q of unanswerable) {
      const retrieved = q.similarities.filter(s => s.score > t);
      if (retrieved.length === 0) {
        correctAbstention++;
      } else {
        falseRetrieval++;
      }
    }
    
    const recall3Pct = (r3 / answerable.length).toFixed(3);
    const recall5Pct = (r5 / answerable.length).toFixed(3);
    const prec3Pct = (p3 / answerable.length).toFixed(3);
    const mrrAvg = (mrrSum / answerable.length).toFixed(3);
    const correctAbsPct = (correctAbstention / unanswerable.length).toFixed(3);
    const falseRetRate = (falseRetrieval / unanswerable.length).toFixed(3);
    const falseAbsRate = (falseAbstention / answerable.length).toFixed(3);
    
    console.log(`| ${t.toFixed(2)} | ${recall3Pct} | ${recall5Pct} | ${prec3Pct} | ${mrrAvg} | ${correctAbsPct} | ${falseRetRate} | ${falseAbsRate} |`);
  }

  // Separation Analysis
  console.log("\n### Positive (Answerable) Queries");
  for (const q of answerable) {
    const topScore = q.similarities[0]?.score.toFixed(3) || 0;
    const firstRelevantIdx = q.similarities.findIndex(s => q.expected.includes(s.id));
    const highestRelevantScore = firstRelevantIdx !== -1 ? q.similarities[firstRelevantIdx].score.toFixed(3) : 0;
    console.log(`- ${q.id} [${q.category}] First Rel Rank: ${firstRelevantIdx+1} | Highest Rel Score: ${highestRelevantScore} | Top Overall Score: ${topScore}`);
  }

  console.log("\n### Negative (Unanswerable/Live Data) Queries");
  for (const q of unanswerable) {
    const top = q.similarities[0];
    console.log(`- ${q.id} [${q.category}] Top Score: ${top ? top.score.toFixed(3) : 'N/A'} | Retrieved Source: ${top ? top.id : 'N/A'}`);
  }
}
run();
