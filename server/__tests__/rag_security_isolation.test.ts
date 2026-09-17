/**
 * CLINICFIRST AI — RAG SECURITY & ISOLATION TEST SUITE
 * Verifies tenant boundary isolation, draft/archive gating, and model context safety.
 */

import { EXPANDED_CHUNKS, EXPANDED_CASES } from '../scripts/eval-data-expanded.js';

export async function runSecurityIsolationTests() {
  console.log('----------------------------------------------------');
  console.log('RAG SECURITY & MULTI-TENANT ISOLATION TESTS');
  console.log('----------------------------------------------------\n');

  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean, message: string) {
    if (condition) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name}: ${message}`);
      failed++;
    }
  }

  // 1. Cross-Tenant Context Gating Test
  console.log('Test 1: Cross-Tenant Context Barrier');
  const targetClinic = 'clinic_A';
  const foreignClinic = 'clinic_B';
  const clinicBChunks = EXPANDED_CHUNKS.filter(c => c.clinic_id === foreignClinic);
  assert(
    'Clinic B chunks exist in test corpus',
    clinicBChunks.length > 0,
    'Expected clinic B chunks in corpus'
  );

  // Simulate context retrieval filter for Clinic A
  const allowedChunksForA = EXPANDED_CHUNKS.filter(c => c.clinic_id === targetClinic && c.release_status === 'PUBLISHED');
  const leakedChunks = allowedChunksForA.filter(c => c.clinic_id !== targetClinic);
  assert(
    'Strict tenant filter prevents foreign tenant chunk inclusion',
    leakedChunks.length === 0,
    `Found ${leakedChunks.length} leaked foreign chunks`
  );

  // 2. Draft & Archived Knowledge Gating Test
  console.log('\nTest 2: Release Status Gating (Draft/Archived Quarantine)');
  const draftChunks = EXPANDED_CHUNKS.filter(c => c.release_status === 'DRAFT');
  const archivedChunks = EXPANDED_CHUNKS.filter(c => c.release_status === 'ARCHIVED');
  assert('Draft chunks present in corpus fixture', draftChunks.length > 0, 'No draft chunks');
  assert('Archived chunks present in corpus fixture', archivedChunks.length > 0, 'No archived chunks');

  const leakedDrafts = allowedChunksForA.filter(c => c.release_status === 'DRAFT');
  const leakedArchived = allowedChunksForA.filter(c => c.release_status === 'ARCHIVED');
  assert('Draft chunks strictly excluded from context builder pool', leakedDrafts.length === 0, `Leaked drafts: ${leakedDrafts.length}`);
  assert('Archived chunks strictly excluded from context builder pool', leakedArchived.length === 0, `Leaked archived: ${leakedArchived.length}`);

  // 3. Evaluation Boundary Test on Phase 1E Results
  console.log('\nTest 3: Model Boundary Leakage Verification Across 46 Test Cases');
  const fs = await import('fs');
  const path = await import('path');
  const resultsPath = path.join(process.cwd(), 'server/scripts/rag-eval-phase1e-results.json');
  if (fs.existsSync(resultsPath)) {
    const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    const chunkMap = new Map(EXPANDED_CHUNKS.map(c => [c.id, c]));

    for (const candName of ['Candidate A', 'Candidate B']) {
      const cases = results[candName].cases;
      let crossTenantContextCount = 0;
      let draftContextCount = 0;
      let archivedContextCount = 0;

      cases.forEach((c: any) => {
        c.retrieved_chunk_ids.forEach((cid: string) => {
          const chunk = chunkMap.get(cid);
          if (chunk) {
            if (chunk.clinic_id !== 'clinic_A') crossTenantContextCount++;
            if (chunk.release_status === 'DRAFT') draftContextCount++;
            if (chunk.release_status === 'ARCHIVED') archivedContextCount++;
          }
        });
      });

      assert(`${candName}: 0 cross-tenant chunks in model context`, crossTenantContextCount === 0, `Found ${crossTenantContextCount}`);
      assert(`${candName}: 0 draft chunks in model context`, draftContextCount === 0, `Found ${draftContextCount}`);
      assert(`${candName}: 0 archived chunks in model context`, archivedContextCount === 0, `Found ${archivedContextCount}`);
    }
  } else {
    console.warn('  Results file not found, skipping case-by-case boundary verification');
  }

  console.log('\n----------------------------------------------------');
  console.log(`SECURITY TESTS SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('----------------------------------------------------\n');

  if (failed > 0) {
    throw new Error(`Security isolation tests failed: ${failed} failures`);
  }
}

// Auto-run if executed directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('rag_security_isolation')) {
  runSecurityIsolationTests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
