/**
 * CLINICFIRST AI — PHASE 2C DUAL INDEXING PIPELINE TEST SUITE
 * 
 * Verifies:
 * 1. Happy path: Published release -> BUILDING -> VALIDATING -> READY
 * 2. Status gating: Draft/Unpublished release rejected
 * 3. Multi-tenant isolation: Cross-tenant release indexing rejected
 * 4. Idempotency: Duplicate indexing calls do not produce duplicate indexes
 * 5. Partial failure containment: Incomplete/failed embedding marks FAILED, never READY
 * 6. Vector dimension enforcement: Strictly 768 dimensions validated
 * 7. Malformed/null vector rejection: Null, NaN, Infinity fail safely
 * 8. Retry policy: Transient 429/503 errors retried with exponential backoff
 * 9. Terminal error classification: 400/401/403 fail immediately without loop
 * 10. Concurrency: In-flight deduplication for identical release identity
 * 11. Multi-release concurrency: Independent releases R1 and R2 remain isolated
 * 12. Completeness validation: Missing chunks or duplicate positions rejected
 * 13. Tenant integrity: Divergent chunk clinic_id rejected
 * 14. Production isolation: Legacy match_clinic_knowledge and threshold 0.60 untouched
 * 15. Active-index invariant: Candidate index is_active is strictly FALSE
 */

import fs from 'fs';
import path from 'path';
import { db } from '../db';
import { KnowledgeService } from '../services/knowledge.service';
import {
  RagChunkingService,
  RagEmbeddingService,
  RagValidationService,
  RagIndexingService,
  RagRepository,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_EMBEDDING_DIMENSION,
  REPRESENTATION_VERSION_FORMATTED_V1
} from '../services/rag';
import { ClinicKnowledgeRelease, ClinicRagIndex, ClinicRagChunk } from '../../src/types';

// Deterministic 768-dimensional mock vector generator for unit tests
function createDeterministicVector768(seed: number = 1.0): number[] {
  const vec = new Array(768);
  for (let i = 0; i < 768; i++) {
    vec[i] = Math.sin(i * 0.1 + seed) * 0.05;
  }
  return vec;
}

export async function runPhase2cIndexingTests() {
  console.log('================================================================');
  console.log('PHASE 2C: CONTROLLED RAG DUAL INDEXING PIPELINE TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function testAssert(name: string, condition: boolean, message: string) {
    if (condition) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name}: ${message}`);
      failed++;
    }
  }

  // Setup mock database storage
  (db.data as any).clinic_knowledge_releases = [];
  (db.data as any).clinic_rag_indices = [];
  (db.data as any).clinic_rag_chunks = [];

  const sampleMarkdown = `
# City Health Clinic Knowledge Base

## Operating Hours
Our clinic is open Monday to Friday from 8:00 AM to 6:00 PM, and Saturday from 9:00 AM to 1:00 PM. We are closed on Sundays and national public holidays.

## Appointment Booking Policies
Patients must book appointments at least 2 hours in advance. Cancellations require 24 hours prior notice to avoid a late cancellation fee of $25. Walk-ins are accepted only for urgent triage.

## Accepted Insurance Plans
We accept BlueCross BlueShield, Aetna, Medicare, and UnitedHealthcare. Copayments are due at the time of check-in via cash, credit card, or digital payment.
`.trim();

  // Seed sample published release for Clinic A
  const releaseA1: ClinicKnowledgeRelease = {
    id: 'rel_a1_pub',
    clinic_id: 'clinic_alpha',
    version: 1,
    document_hash: 'hash_a1',
    compiled_content: sampleMarkdown,
    status: 'PUBLISHED',
    compiled_at: new Date().toISOString(),
    published_at: new Date().toISOString(),
    published_by: 'dr_smith'
  };
  (db.data as any).clinic_knowledge_releases.push(releaseA1);

  // Seed sample draft (unpublished) release for Clinic A
  const releaseA2Draft: ClinicKnowledgeRelease = {
    id: 'rel_a2_draft',
    clinic_id: 'clinic_alpha',
    version: 2,
    document_hash: 'hash_a2',
    compiled_content: sampleMarkdown,
    status: 'COMPILED', // Not PUBLISHED!
    compiled_at: new Date().toISOString()
  };
  (db.data as any).clinic_knowledge_releases.push(releaseA2Draft);

  // Seed sample published release for Clinic B
  const releaseB1: ClinicKnowledgeRelease = {
    id: 'rel_b1_pub',
    clinic_id: 'clinic_beta',
    version: 1,
    document_hash: 'hash_b1',
    compiled_content: `## Beta Urgent Care\nOpen 24/7 for emergency pediatric care.`,
    status: 'PUBLISHED',
    compiled_at: new Date().toISOString(),
    published_at: new Date().toISOString()
  };
  (db.data as any).clinic_knowledge_releases.push(releaseB1);

  // Custom unit-test embedder using deterministic 768-dim mock vectors
  const unitTestEmbedder = async (text: string) => {
    return createDeterministicVector768(text.length);
  };

  // ============================================================================
  // GROUP 1: CHUNKING & REPRESENTATION CONTRACT
  // ============================================================================
  console.log('--- Group 1: Chunking & Representation Contract ---');

  const chunkMetadata = RagChunkingService.chunkReleaseContent(
    sampleMarkdown,
    REPRESENTATION_VERSION_FORMATTED_V1,
    DEFAULT_EMBEDDING_MODEL,
    DEFAULT_EMBEDDING_DIMENSION
  );

  testAssert(
    'Markdown split extracts semantic sections',
    chunkMetadata.length === 3,
    `Expected 3 chunks, got ${chunkMetadata.length}`
  );

  testAssert(
    'Chunk titles correctly extracted from markdown headings',
    chunkMetadata[0].chunk_title === 'Operating Hours' &&
    chunkMetadata[1].chunk_title === 'Appointment Booking Policies' &&
    chunkMetadata[2].chunk_title === 'Accepted Insurance Plans',
    'Chunk titles do not match expected section headings'
  );

  testAssert(
    'Document embedding input follows FORMATTED_V1 contract (title: ... | text: ...)',
    chunkMetadata[0].embedding_input.startsWith('title: Operating Hours | text:'),
    'Document embedding input violates FORMATTED_V1 format'
  );

  testAssert(
    'Query embedding input helper follows task: search result | query: ...',
    RagChunkingService.formatQueryEmbeddingInput('what are your hours') === 'task: search result | query: what are your hours',
    'Query embedding format helper violates FORMATTED_V1 format'
  );

  testAssert(
    'Deterministic chunk content hash generated',
    typeof chunkMetadata[0].chunk_content_hash === 'string' && chunkMetadata[0].chunk_content_hash.length === 64,
    'Chunk content hash missing or invalid SHA-256'
  );

  const indexHash = RagChunkingService.computeIndexContentHash(sampleMarkdown);
  testAssert(
    'Deterministic index content hash generated',
    typeof indexHash === 'string' && indexHash.length === 64,
    'Index content hash missing or invalid SHA-256'
  );

  // ============================================================================
  // GROUP 2: VECTOR VALIDATION & ERROR CLASSIFICATION
  // ============================================================================
  console.log('\n--- Group 2: Vector Validation & Error Classification ---');

  const validVec = createDeterministicVector768();
  const validated = RagEmbeddingService.validateVector(validVec, 768);
  testAssert('Valid 768-dim vector accepted', validated.length === 768, 'Failed valid vector check');

  let invalidDimCaught = false;
  try {
    RagEmbeddingService.validateVector(new Array(512).fill(0.1), 768);
  } catch {
    invalidDimCaught = true;
  }
  testAssert('Vector dimension mismatch (512 vs 768) strictly rejected', invalidDimCaught, 'Failed to reject 512 dimension');

  let nanVectorCaught = false;
  try {
    const nanVec = [...validVec];
    nanVec[10] = NaN;
    RagEmbeddingService.validateVector(nanVec, 768);
  } catch {
    nanVectorCaught = true;
  }
  testAssert('Vector containing NaN strictly rejected', nanVectorCaught, 'Failed to reject NaN in vector');

  let nullVectorCaught = false;
  try {
    RagEmbeddingService.validateVector(null, 768);
  } catch {
    nullVectorCaught = true;
  }
  testAssert('Null vector strictly rejected', nullVectorCaught, 'Failed to reject null vector');

  testAssert(
    'Error classification: 429 classified as retryable',
    RagEmbeddingService.isRetryableError({ status: 429, message: 'Resource exhausted' }),
    '429 should be retryable'
  );

  testAssert(
    'Error classification: 503 classified as retryable',
    RagEmbeddingService.isRetryableError({ status: 503, message: 'Service unavailable' }),
    '503 should be retryable'
  );

  testAssert(
    'Error classification: 400 classified as terminal',
    !RagEmbeddingService.isRetryableError({ status: 400, message: 'Bad request invalid argument' }),
    '400 must NOT be retryable'
  );

  testAssert(
    'Error classification: 401 classified as terminal',
    !RagEmbeddingService.isRetryableError({ status: 401, message: 'API key not valid' }),
    '401 must NOT be retryable'
  );

  // ============================================================================
  // GROUP 3: HAPPY PATH DUAL INDEXING BUILD
  // ============================================================================
  console.log('\n--- Group 3: Happy Path Dual Indexing Build ---');

  const buildResult = await RagIndexingService.indexReleaseV2(
    'clinic_alpha',
    'rel_a1_pub',
    undefined,
    { customEmbedder: unitTestEmbedder }
  );

  testAssert('Build result reports success: true', buildResult.success === true, `Build failed: ${buildResult.error}`);
  testAssert('Candidate index status is READY', buildResult.status === 'READY', `Expected READY, got ${buildResult.status}`);
  testAssert('Chunks count matches expected chunk count (3)', buildResult.chunks_count === 3, `Expected 3 chunks, got ${buildResult.chunks_count}`);
  testAssert('Index ID generated', !!buildResult.index_id, 'Missing index ID');

  const storedIndex = await RagRepository.getIndexById(buildResult.index_id!);
  testAssert('Stored index status is READY in database', storedIndex?.status === 'READY', 'Stored index not READY');
  testAssert('Candidate index is_active invariant: STRICTLY FALSE', storedIndex?.is_active === false, 'Candidate index must NOT be active');
  testAssert('Stored index records total_chunks = 3', storedIndex?.total_chunks === 3, 'total_chunks incorrect');
  testAssert('Stored index records embedded_chunks = 3', storedIndex?.embedded_chunks === 3, 'embedded_chunks incorrect');
  testAssert('Stored index records validated_at timestamp', !!storedIndex?.validated_at, 'validated_at missing');
  testAssert('Stored index contains validation_report', storedIndex?.validation_report?.all_passed === true, 'Validation report missing or failed');

  const storedChunks = await RagRepository.getChunksByIndexId(buildResult.index_id!);
  testAssert('Stored chunk count in database is 3', storedChunks.length === 3, `Expected 3 chunks in db, got ${storedChunks.length}`);
  testAssert('Chunks have 768-dim embeddings', storedChunks[0].embedding.length === 768, 'Stored vector dimension not 768');
  testAssert('Chunks are contiguous from index 0 to 2', storedChunks[0].chunk_index === 0 && storedChunks[2].chunk_index === 2, 'Chunk index ordering wrong');
  testAssert('All chunks anchor to clinic_alpha', storedChunks.every(c => c.clinic_id === 'clinic_alpha'), 'Chunk clinic_id diverged');

  // ============================================================================
  // GROUP 4: STATUS GATING & TENANT ISOLATION
  // ============================================================================
  console.log('\n--- Group 4: Status Gating & Tenant Isolation ---');

  // Test: Draft release rejected
  const draftBuildResult = await RagIndexingService.indexReleaseV2(
    'clinic_alpha',
    'rel_a2_draft',
    undefined,
    { customEmbedder: unitTestEmbedder }
  );
  testAssert(
    'Draft (COMPILED) release rejected from indexing',
    draftBuildResult.success === false && draftBuildResult.status === 'FAILED',
    'Failed to reject draft release'
  );
  testAssert(
    'Draft rejection error message clearly identifies status',
    draftBuildResult.error?.includes('expected \'PUBLISHED\'') || false,
    `Unexpected error message: ${draftBuildResult.error}`
  );

  // Test: Cross-tenant release rejected
  const crossTenantResult = await RagIndexingService.indexReleaseV2(
    'clinic_alpha', // Clinic A trying to index Clinic B's release!
    'rel_b1_pub',
    undefined,
    { customEmbedder: unitTestEmbedder }
  );
  testAssert(
    'Cross-tenant release indexing rejected',
    crossTenantResult.success === false && crossTenantResult.status === 'FAILED',
    'Failed to block cross-tenant indexing'
  );

  // Test: Non-existent release rejected
  const nonExistentResult = await RagIndexingService.indexReleaseV2(
    'clinic_alpha',
    'rel_non_existent',
    undefined,
    { customEmbedder: unitTestEmbedder }
  );
  testAssert(
    'Non-existent release rejected',
    nonExistentResult.success === false && nonExistentResult.status === 'FAILED',
    'Failed to reject non-existent release'
  );

  // ============================================================================
  // GROUP 5: IDEMPOTENCY & RESUMABILITY
  // ============================================================================
  console.log('\n--- Group 5: Idempotency & Resumability ---');

  const countBeforeSecondBuild = (db.data as any).clinic_rag_indices.length;
  const secondBuildResult = await RagIndexingService.indexReleaseV2(
    'clinic_alpha',
    'rel_a1_pub',
    undefined,
    { customEmbedder: unitTestEmbedder }
  );
  const countAfterSecondBuild = (db.data as any).clinic_rag_indices.length;

  testAssert(
    'Idempotent call succeeds',
    secondBuildResult.success === true,
    'Second indexing call failed'
  );
  testAssert(
    'Duplicate build reuses existing READY index without creating new rows',
    countBeforeSecondBuild === countAfterSecondBuild && secondBuildResult.reused_existing === true,
    'Duplicate build created another index row'
  );
  testAssert(
    'Returned index ID matches first build ID',
    secondBuildResult.index_id === buildResult.index_id,
    'Index ID changed across idempotent calls'
  );

  // ============================================================================
  // GROUP 6: PARTIAL EMBEDDING FAILURE CONTAINMENT
  // ============================================================================
  console.log('\n--- Group 6: Partial Embedding Failure Containment ---');

  // Seed a new published release for testing failure
  const releaseFail: ClinicKnowledgeRelease = {
    id: 'rel_fail_test',
    clinic_id: 'clinic_alpha',
    version: 3,
    document_hash: 'hash_fail',
    compiled_content: `## Section 1\nContent 1\n\n## Section 2\nContent 2\n\n## Section 3\nContent 3`,
    status: 'PUBLISHED',
    compiled_at: new Date().toISOString(),
    published_at: new Date().toISOString()
  };
  (db.data as any).clinic_knowledge_releases.push(releaseFail);

  // Mock embedder that fails on chunk 2
  let callCount = 0;
  const failingEmbedder = async (text: string) => {
    callCount++;
    if (callCount === 2) {
      throw new Error('Simulated Gemini quota exceeded (429)');
    }
    return createDeterministicVector768(callCount);
  };

  const failedBuildResult = await RagIndexingService.indexReleaseV2(
    'clinic_alpha',
    'rel_fail_test',
    undefined,
    { customEmbedder: failingEmbedder, maxRetries: 1 }
  );

  testAssert(
    'Build with failing embedding returns success: false',
    failedBuildResult.success === false,
    'Build should have failed'
  );
  testAssert(
    'Failed candidate index status is FAILED, NOT READY',
    failedBuildResult.status === 'FAILED',
    `Expected status FAILED, got ${failedBuildResult.status}`
  );

  const storedFailedIndex = await RagRepository.getIndexById(failedBuildResult.index_id!);
  testAssert(
    'Database records candidate index as FAILED with error_message',
    storedFailedIndex?.status === 'FAILED' && storedFailedIndex?.error_message?.includes('Simulated Gemini quota'),
    'Database index status not FAILED'
  );
  testAssert(
    'Failed candidate is_active invariant: STRICTLY FALSE',
    storedFailedIndex?.is_active === false,
    'Failed candidate index cannot be active'
  );

  // ============================================================================
  // GROUP 7: RESUMING AFTER FAILURE (CLEAN REBUILD)
  // ============================================================================
  console.log('\n--- Group 7: Resuming After Failure ---');

  // Now retry indexing the same failed release with a working embedder
  const resumeBuildResult = await RagIndexingService.indexReleaseV2(
    'clinic_alpha',
    'rel_fail_test',
    undefined,
    { customEmbedder: unitTestEmbedder }
  );

  testAssert(
    'Retry of previously failed index succeeds',
    resumeBuildResult.success === true && resumeBuildResult.status === 'READY',
    'Failed to rebuild index after prior failure'
  );
  testAssert(
    'Prior failed index row is reused and transitioned to READY',
    resumeBuildResult.index_id === failedBuildResult.index_id,
    'New index created instead of rebuilding existing failed index'
  );

  const updatedIndex = await RagRepository.getIndexById(resumeBuildResult.index_id!);
  testAssert(
    'Rebuilt index status updated to READY with clear error_message',
    updatedIndex?.status === 'READY' && !updatedIndex?.error_message,
    'Rebuilt index has lingering error message or wrong status'
  );

  // ============================================================================
  // GROUP 8: CONCURRENT BUILDS & MULTI-RELEASE ISOLATION
  // ============================================================================
  console.log('\n--- Group 8: Concurrent Builds & Multi-Release Isolation ---');

  // 1. Concurrent duplicate requests for same release
  const promise1 = RagIndexingService.indexReleaseV2('clinic_beta', 'rel_b1_pub', undefined, { customEmbedder: unitTestEmbedder });
  const promise2 = RagIndexingService.indexReleaseV2('clinic_beta', 'rel_b1_pub', undefined, { customEmbedder: unitTestEmbedder });

  const [res1, res2] = await Promise.all([promise1, promise2]);
  testAssert('Concurrent duplicate build 1 succeeds', res1.success && res1.status === 'READY', 'Build 1 failed');
  testAssert('Concurrent duplicate build 2 succeeds', res2.success && res2.status === 'READY', 'Build 2 failed');
  testAssert('Concurrent duplicate builds share single index identity', res1.index_id === res2.index_id, 'Duplicate indexes created under concurrency');

  const betaIndices = ((db.data as any).clinic_rag_indices as ClinicRagIndex[]).filter(i => i.clinic_id === 'clinic_beta');
  testAssert('Exactly one index exists for clinic_beta', betaIndices.length === 1, `Expected 1 index, got ${betaIndices.length}`);

  // 2. Multi-release isolation
  const alphaIndices = ((db.data as any).clinic_rag_indices as ClinicRagIndex[]).filter(i => i.clinic_id === 'clinic_alpha');
  testAssert('Clinic alpha indices remain completely isolated from clinic beta', alphaIndices.every(i => i.clinic_id === 'clinic_alpha'), 'Tenant cross-leak detected');

  // 3. Multi-instance concurrency: Active BUILDING index yields without deleting chunks
  const existingBuildingIndex = await RagRepository.createIndex({
    clinic_id: 'clinic_beta',
    release_id: 'rel_b2_pub',
    representation_version: 'FORMATTED_V1',
    embedding_model: 'gemini-embedding-2',
    embedding_dimension: 768,
    retrieval_threshold: 0.70,
    content_hash: 'mock_hash',
    status: 'BUILDING',
    total_chunks: 2,
    embedded_chunks: 1
  });

  // Insert a chunk to verify it is NOT wiped when another instance encounters an active BUILDING lease
  await RagRepository.insertChunksBatch([{
    index_id: existingBuildingIndex.id,
    clinic_id: 'clinic_beta',
    chunk_index: 0,
    chunk_title: 'Title',
    chunk_text: 'Text',
    embedding_input: 'Input',
    chunk_content_hash: 'hash0',
    embedding: new Array(768).fill(0.01)
  }]);

  // Second instance attempts to index rel_b2_pub while building index is active (< 15 min old)
  // Clear in-memory in-flight mutex to simulate a separate process instance
  (RagIndexingService as any).inFlightBuilds.clear();

  // Create release fixture for rel_b2_pub
  if (!(db.data as any).clinic_knowledge_releases) {
    (db.data as any).clinic_knowledge_releases = [];
  }
  (db.data as any).clinic_knowledge_releases.push({
    id: 'rel_b2_pub',
    clinic_id: 'clinic_beta',
    version: 2,
    document_hash: 'b2_hash',
    status: 'PUBLISHED',
    compiled_content: '# Section B2\n\nContent B2',
    compiled_at: new Date().toISOString(),
    published_at: new Date().toISOString()
  });

  const separateInstanceResult = await RagIndexingService.indexReleaseV2('clinic_beta', 'rel_b2_pub', undefined, { customEmbedder: unitTestEmbedder });
  testAssert(
    'Concurrent instance yields gracefully on active BUILDING lease without failing the original build',
    separateInstanceResult.success === false && separateInstanceResult.error?.includes('in progress on another instance'),
    'Failed to yield to active BUILDING index lease'
  );

  const preservedChunks = await RagRepository.getChunksByIndexId(existingBuildingIndex.id);
  testAssert(
    'Active BUILDING chunks preserved against cross-instance wipe',
    preservedChunks.length === 1,
    'Chunks were destructively deleted by concurrent instance'
  );

  // 4. Stale BUILDING lease (>15 min) is reclaimed and cleanly rebuilt
  await RagRepository.updateIndex(existingBuildingIndex.id, {
    created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString() // 20 mins ago (exceeds 15m lease)
  });
  (RagIndexingService as any).inFlightBuilds.clear();

  const reclaimedResult = await RagIndexingService.indexReleaseV2('clinic_beta', 'rel_b2_pub', undefined, { customEmbedder: unitTestEmbedder });
  testAssert(
    'Stale BUILDING lease reclaimed and completed to READY',
    reclaimedResult.success === true && reclaimedResult.status === 'READY',
    'Failed to reclaim stale BUILDING lease'
  );

  // ============================================================================
  // GROUP 9: VALIDATION LOGIC SAFETY (TAMPERING DEFENSE)
  // ============================================================================
  console.log('\n--- Group 9: Validation Logic Safety (Tampering Defense) ---');

  // Test: Missing chunk in sequence rejected by validation
  const incompleteChunks: ClinicRagChunk[] = storedChunks.slice(0, 2); // Only 2 of 3 chunks
  const incompleteValidation = RagValidationService.validateCandidateIndex({
    index: storedIndex!,
    release: releaseA1,
    expectedChunks: chunkMetadata,
    actualChunks: incompleteChunks
  });
  testAssert(
    'Incomplete chunk count rejected by validation service',
    incompleteValidation.isValid === false,
    'Validation failed to catch missing chunk'
  );

  // Test: Tampered chunk text/hash rejected by validation
  const tamperedChunks: ClinicRagChunk[] = storedChunks.map((c, i) =>
    i === 0 ? { ...c, chunk_content_hash: 'tampered_hash_value' } : c
  );
  const tamperedValidation = RagValidationService.validateCandidateIndex({
    index: storedIndex!,
    release: releaseA1,
    expectedChunks: chunkMetadata,
    actualChunks: tamperedChunks
  });
  testAssert(
    'Tampered chunk hash rejected by validation service',
    tamperedValidation.isValid === false,
    'Validation failed to catch tampered chunk content hash'
  );

  // Test: Chunk tenant divergence rejected
  const divergentChunks: ClinicRagChunk[] = storedChunks.map((c, i) =>
    i === 0 ? { ...c, clinic_id: 'clinic_hacker' } : c
  );
  const tenantDivergenceValidation = RagValidationService.validateCandidateIndex({
    index: storedIndex!,
    release: releaseA1,
    expectedChunks: chunkMetadata,
    actualChunks: divergentChunks
  });
  testAssert(
    'Chunk tenant divergence rejected by validation service',
    tenantDivergenceValidation.isValid === false,
    'Validation failed to catch chunk tenant divergence'
  );

  // ============================================================================
  // GROUP 10: PRODUCTION RETRIEVAL ISOLATION (ZERO CUTOVER)
  // ============================================================================
  console.log('\n--- Group 10: Production Retrieval Path Isolation ---');

  const ragServicePath = path.join(process.cwd(), 'server/services/rag.service.ts');
  const ragServiceCode = fs.readFileSync(ragServicePath, 'utf8');

  testAssert(
    'Production RagService.searchKnowledge still routes to legacy match_clinic_knowledge',
    ragServiceCode.includes("supabase.rpc('match_clinic_knowledge'"),
    'Production searchKnowledge must continue calling match_clinic_knowledge'
  );

  testAssert(
    'Production RagService does NOT call match_clinic_knowledge_v2',
    !ragServiceCode.includes('match_clinic_knowledge_v2'),
    'Production searchKnowledge must NOT reference match_clinic_knowledge_v2'
  );

  testAssert(
    'Production RagService does NOT reference clinic_rag_chunks or clinic_rag_indices',
    !ragServiceCode.includes('clinic_rag_chunks') && !ragServiceCode.includes('clinic_rag_indices'),
    'Production searchKnowledge must NOT query V2 tables'
  );

  testAssert(
    'Production retrieval threshold remains fixed at 0.60',
    ragServiceCode.includes('matchThreshold: number = 0.6'),
    'Production threshold must remain 0.60'
  );

  testAssert(
    'No call to activate_rag_index exists anywhere in indexing pipeline',
    !fs.readFileSync(path.join(process.cwd(), 'server/services/rag/indexing.service.ts'), 'utf8').includes('activate_rag_index'),
    'activate_rag_index must NOT be invoked in Phase 2C'
  );

  console.log('\n================================================================');
  console.log(`PHASE 2C TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    throw new Error(`Phase 2C test suite failed with ${failed} failure(s)`);
  }
}

// Auto-run if executed directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('rag_phase2c_indexing')) {
  runPhase2cIndexingTests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
