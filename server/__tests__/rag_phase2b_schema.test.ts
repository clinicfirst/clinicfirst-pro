/**
 * CLINICFIRST AI — PHASE 2B SCHEMA FOUNDATION & SECURITY TEST SUITE
 * 
 * Verifies:
 * 1. Migration DDL contracts, non-destructive safety, and strict schema constraints
 * 2. Registry table invariants, status gating, and active index partial uniqueness
 * 3. Scoped chunk table constraints, vector dimension (768), and tenant composite FK
 * 4. RLS policies, tenant isolation, and SECURITY DEFINER search_path hardening
 * 5. Production retrieval isolation (proves legacy path is untouched)
 * 6. Retrieval RPC v2, Activation, and Rollback logic simulations
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { RagIndexStatus, ClinicRagIndex, ClinicRagChunk } from '../../src/types';

export async function runPhase2bSchemaTests() {
  console.log('================================================================');
  console.log('PHASE 2B: RAG SCHEMA FOUNDATION & SAFETY VERIFICATION SUITE');
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

  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260917000000_rag_v2_indices.sql');

  // ============================================================================
  // GROUP 1: MIGRATION ARTIFACT & NON-DESTRUCTIVE SAFETY REVIEW
  // ============================================================================
  console.log('--- Group 1: Migration Artifact & Non-Destructive Safety ---');

  testAssert(
    'Migration file exists with expected timestamp convention',
    fs.existsSync(migrationPath),
    `Migration file missing at ${migrationPath}`
  );

  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  // Safety checks against legacy objects
  testAssert(
    'Migration does NOT alter or drop existing clinic_knowledge_chunks',
    !migrationSql.includes('ALTER TABLE clinic_knowledge_chunks') &&
    !migrationSql.includes('DROP TABLE clinic_knowledge_chunks'),
    'Migration must not modify existing legacy chunks table'
  );

  testAssert(
    'Migration does NOT alter or replace existing match_clinic_knowledge RPC',
    !migrationSql.includes('FUNCTION match_clinic_knowledge(') &&
    !migrationSql.includes('FUNCTION match_clinic_knowledge ('),
    'Migration must not touch existing match_clinic_knowledge RPC'
  );

  testAssert(
    'Migration contains no destructive DROP TABLE or TRUNCATE',
    !migrationSql.includes('DROP TABLE clinic_') && !migrationSql.includes('TRUNCATE'),
    'Destructive table operations found in migration'
  );

  testAssert(
    'Migration does not copy or migrate data from legacy chunks',
    !migrationSql.includes('INSERT INTO clinic_rag_chunks SELECT') &&
    !migrationSql.includes('FROM clinic_knowledge_chunks'),
    'Migration must not copy or mutate legacy vectors'
  );

  // ============================================================================
  // GROUP 2: DDL & CONSTRAINT INTEGRITY INSPECTION
  // ============================================================================
  console.log('\n--- Group 2: DDL & Constraint Integrity Inspection ---');

  // Table 1: clinic_rag_indices
  testAssert(
    'clinic_rag_indices has FK to clinic_knowledge_releases(id) ON DELETE RESTRICT',
    migrationSql.includes('release_id TEXT NOT NULL REFERENCES clinic_knowledge_releases(id) ON DELETE RESTRICT'),
    'Missing or incorrect release_id foreign key constraint'
  );

  testAssert(
    'clinic_rag_indices has FK to clinics(id) ON DELETE CASCADE',
    migrationSql.includes('clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE'),
    'Missing or incorrect clinic_id foreign key constraint'
  );

  testAssert(
    'clinic_rag_indices enforces 7 valid statuses',
    migrationSql.includes("status IN ('BUILDING', 'VALIDATING', 'READY', 'ACTIVE', 'SUPERSEDED', 'ROLLBACK', 'FAILED')"),
    'Status check constraint missing required lifecycle states'
  );

  testAssert(
    'clinic_rag_indices enforces logical identity uniqueness',
    migrationSql.includes('UNIQUE (clinic_id, release_id, representation_version, embedding_model, embedding_dimension)'),
    'Logical identity unique constraint missing'
  );

  testAssert(
    'clinic_rag_indices enforces composite unique (id, clinic_id) for tenant anchoring',
    migrationSql.includes('UNIQUE (id, clinic_id)'),
    'Composite unique (id, clinic_id) missing'
  );

  testAssert(
    'Single active index invariant enforced via partial unique index',
    migrationSql.includes('CREATE UNIQUE INDEX IF NOT EXISTS uq_clinic_rag_indices_active') &&
    migrationSql.includes('ON clinic_rag_indices(clinic_id)') &&
    migrationSql.includes('WHERE is_active = TRUE'),
    'Partial unique index for active index missing'
  );

  testAssert(
    'Immutability trigger defined for critical identity fields',
    migrationSql.includes('protect_rag_index_immutability') &&
    migrationSql.includes('trigger_protect_rag_index_immutability'),
    'Immutability trigger missing'
  );

  // Table 2: clinic_rag_chunks
  testAssert(
    'clinic_rag_chunks enforces VECTOR(768)',
    migrationSql.includes('embedding VECTOR(768) NOT NULL'),
    'Vector dimension 768 constraint missing'
  );

  testAssert(
    'clinic_rag_chunks avoids denormalized release_id',
    !/CREATE TABLE IF NOT EXISTS clinic_rag_chunks\s*\([^)]*release_id/i.test(migrationSql),
    'Denormalized release_id should not exist on chunks table'
  );

  testAssert(
    'clinic_rag_chunks anchors tenant to parent index via composite FK',
    migrationSql.includes('FOREIGN KEY (index_id, clinic_id) REFERENCES clinic_rag_indices(id, clinic_id) ON DELETE CASCADE'),
    'Composite FK anchoring chunk tenant identity missing'
  );

  testAssert(
    'clinic_rag_chunks enforces unique chunk order per index',
    migrationSql.includes('UNIQUE (index_id, chunk_index)'),
    'Chunk index uniqueness missing'
  );

  testAssert(
    'No ANN / HNSW / IVFFlat indexes introduced in Phase 2B',
    !migrationSql.includes('USING hnsw') && !migrationSql.includes('USING ivfflat'),
    'ANN indexes must not be introduced in Phase 2B'
  );

  // ============================================================================
  // GROUP 3: SECURITY, RLS & STORED PROCEDURE HARDENING
  // ============================================================================
  console.log('\n--- Group 3: Security, RLS & Procedure Hardening ---');

  testAssert(
    'RLS enabled on clinic_rag_indices and clinic_rag_chunks',
    migrationSql.includes('ALTER TABLE clinic_rag_indices ENABLE ROW LEVEL SECURITY;') &&
    migrationSql.includes('ALTER TABLE clinic_rag_chunks ENABLE ROW LEVEL SECURITY;'),
    'RLS must be enabled on both new tables'
  );

  testAssert(
    'Tenant-scoped SELECT RLS policies established',
    migrationSql.includes('Users can read rag indices for their clinic') &&
    migrationSql.includes('Users can read rag chunks for their clinic'),
    'Tenant-scoped read policies missing'
  );

  testAssert(
    'match_clinic_knowledge_v2 has SECURITY DEFINER and search_path = public, pg_temp',
    migrationSql.includes('FUNCTION match_clinic_knowledge_v2') &&
    migrationSql.includes('SECURITY DEFINER') &&
    migrationSql.includes('SET search_path = public, pg_temp'),
    'match_clinic_knowledge_v2 missing security definer or hardened search_path'
  );

  testAssert(
    'match_clinic_knowledge_v2 is secured and restricted to service_role only',
    migrationSql.includes('REVOKE ALL ON FUNCTION match_clinic_knowledge_v2(vector(768), int, text, float) FROM PUBLIC;') &&
    migrationSql.includes('GRANT EXECUTE ON FUNCTION match_clinic_knowledge_v2(vector(768), int, text, float) TO service_role;') &&
    !migrationSql.includes('TO authenticated, service_role'),
    'match_clinic_knowledge_v2 permissions not restricted to service_role'
  );

  testAssert(
    'activate_rag_index is secured and restricted to service_role',
    migrationSql.includes('FUNCTION activate_rag_index') &&
    migrationSql.includes('REVOKE ALL ON FUNCTION activate_rag_index(text, uuid) FROM PUBLIC;') &&
    migrationSql.includes('GRANT EXECUTE ON FUNCTION activate_rag_index(text, uuid) TO service_role;'),
    'activate_rag_index permissions not restricted to service_role'
  );

  testAssert(
    'rollback_rag_index is secured and restricted to service_role',
    migrationSql.includes('FUNCTION rollback_rag_index') &&
    migrationSql.includes('REVOKE ALL ON FUNCTION rollback_rag_index(text, text) FROM PUBLIC;') &&
    migrationSql.includes('GRANT EXECUTE ON FUNCTION rollback_rag_index(text, text) TO service_role;'),
    'rollback_rag_index permissions not restricted to service_role'
  );

  // ============================================================================
  // GROUP 4: PRODUCTION RETRIEVAL PATH ISOLATION
  // ============================================================================
  console.log('\n--- Group 4: Production Retrieval Path Isolation ---');

  const ragServicePath = path.join(process.cwd(), 'server/services/rag.service.ts');
  const ragServiceCode = fs.readFileSync(ragServicePath, 'utf8');

  testAssert(
    'RagService.searchKnowledge still routes to legacy match_clinic_knowledge',
    ragServiceCode.includes("supabase.rpc('match_clinic_knowledge'"),
    'RagService must still call legacy RPC in production'
  );

  testAssert(
    'RagService does NOT call match_clinic_knowledge_v2',
    !ragServiceCode.includes('match_clinic_knowledge_v2'),
    'RagService must not call v2 RPC in Phase 2B'
  );

  testAssert(
    'Production retrieval threshold remains unchanged (0.6)',
    ragServiceCode.includes('matchThreshold: number = 0.6'),
    'Production threshold must remain at 0.6 in Phase 2B'
  );

  // ============================================================================
  // GROUP 5: FUNCTIONAL INVARIANT & SIMULATION TESTS
  // ============================================================================
  console.log('\n--- Group 5: Functional Invariant & Simulation Tests ---');

  // 1. Registry Invariants Simulation
  interface MockRegistryItem extends ClinicRagIndex {}
  const mockIndices: MockRegistryItem[] = [];

  function insertIndex(candidate: Partial<ClinicRagIndex>): ClinicRagIndex {
    const validStatuses: RagIndexStatus[] = ['BUILDING', 'VALIDATING', 'READY', 'ACTIVE', 'SUPERSEDED', 'ROLLBACK', 'FAILED'];
    if (!candidate.status || !validStatuses.includes(candidate.status)) {
      throw new Error(`Invalid status: ${candidate.status}`);
    }

    // Check logical identity uniqueness
    const duplicate = mockIndices.find(idx => 
      idx.clinic_id === candidate.clinic_id &&
      idx.release_id === candidate.release_id &&
      idx.representation_version === candidate.representation_version &&
      idx.embedding_model === candidate.embedding_model &&
      idx.embedding_dimension === candidate.embedding_dimension
    );
    if (duplicate) {
      throw new Error('Duplicate logical identity constraint violation');
    }

    // Check single active index invariant
    if (candidate.is_active) {
      const existingActive = mockIndices.find(idx => idx.clinic_id === candidate.clinic_id && idx.is_active);
      if (existingActive) {
        throw new Error('Single active index invariant violation');
      }
    }

    const created: ClinicRagIndex = {
      id: candidate.id || `idx-${Date.now()}-${Math.random()}`,
      clinic_id: candidate.clinic_id!,
      release_id: candidate.release_id!,
      representation_version: candidate.representation_version || 'FORMATTED_V1',
      embedding_model: candidate.embedding_model || 'gemini-embedding-2',
      embedding_dimension: candidate.embedding_dimension || 768,
      retrieval_threshold: candidate.retrieval_threshold || 0.70,
      content_hash: candidate.content_hash || 'hash123',
      status: candidate.status,
      is_active: candidate.is_active || false,
      total_chunks: candidate.total_chunks || 0,
      embedded_chunks: candidate.embedded_chunks || 0,
      created_at: new Date().toISOString()
    };
    mockIndices.push(created);
    return created;
  }

  // Test: Valid insertion
  const idx1 = insertIndex({
    clinic_id: 'clinic_A',
    release_id: 'rel_v1',
    representation_version: 'FORMATTED_V1',
    embedding_model: 'gemini-embedding-2',
    embedding_dimension: 768,
    status: 'READY',
    total_chunks: 3,
    embedded_chunks: 3
  });
  testAssert('Valid index insertion accepted', !!idx1.id, 'Insertion failed');

  // Test: Invalid status rejected
  let invalidStatusCaught = false;
  try {
    insertIndex({ clinic_id: 'clinic_A', release_id: 'rel_v2', status: 'UNKNOWN' as any });
  } catch {
    invalidStatusCaught = true;
  }
  testAssert('Invalid status rejected by constraint', invalidStatusCaught, 'Failed to reject invalid status');

  // Test: Duplicate logical identity rejected
  let duplicateIdentityCaught = false;
  try {
    insertIndex({
      clinic_id: 'clinic_A',
      release_id: 'rel_v1',
      representation_version: 'FORMATTED_V1',
      embedding_model: 'gemini-embedding-2',
      embedding_dimension: 768,
      status: 'READY'
    });
  } catch {
    duplicateIdentityCaught = true;
  }
  testAssert('Duplicate logical identity rejected by unique constraint', duplicateIdentityCaught, 'Failed to reject duplicate logical identity');

  // Test: Single active index per clinic
  const activeA = insertIndex({
    clinic_id: 'clinic_A',
    release_id: 'rel_v3',
    representation_version: 'FORMATTED_V1',
    embedding_model: 'gemini-embedding-2',
    embedding_dimension: 768,
    status: 'ACTIVE',
    is_active: true
  });
  testAssert('First active index permitted for clinic A', activeA.is_active, 'Failed to activate index');

  let secondActiveCaught = false;
  try {
    insertIndex({
      clinic_id: 'clinic_A',
      release_id: 'rel_v4',
      representation_version: 'FORMATTED_V1',
      embedding_model: 'gemini-embedding-2',
      embedding_dimension: 768,
      status: 'ACTIVE',
      is_active: true
    });
  } catch {
    secondActiveCaught = true;
  }
  testAssert('Multiple ACTIVE indexes for one clinic rejected by partial index', secondActiveCaught, 'Failed to enforce single active index invariant');

  // Test: Independent active index for another clinic
  const activeB = insertIndex({
    clinic_id: 'clinic_B',
    release_id: 'rel_v1_b',
    representation_version: 'FORMATTED_V1',
    embedding_model: 'gemini-embedding-2',
    embedding_dimension: 768,
    status: 'ACTIVE',
    is_active: true
  });
  testAssert('Different clinics may have independent ACTIVE indexes', activeB.is_active && activeA.is_active, 'Cross-clinic active indexes conflicted');

  // 2. Chunks Invariants Simulation
  const mockChunks: ClinicRagChunk[] = [];
  function insertChunk(parentIndex: ClinicRagIndex, chunkData: Partial<ClinicRagChunk>): ClinicRagChunk {
    if (chunkData.clinic_id && chunkData.clinic_id !== parentIndex.clinic_id) {
      throw new Error('Composite FK violation: chunk clinic_id diverges from parent index');
    }
    if (!chunkData.embedding || chunkData.embedding.length !== 768) {
      throw new Error('Vector dimension violation: must be exactly 768');
    }
    if (chunkData.chunk_index === undefined || chunkData.chunk_index < 0) {
      throw new Error('chunk_index required');
    }
    const duplicateChunkIndex = mockChunks.find(c => c.index_id === parentIndex.id && c.chunk_index === chunkData.chunk_index);
    if (duplicateChunkIndex) {
      throw new Error('Unique (index_id, chunk_index) violation');
    }

    const chunk: ClinicRagChunk = {
      id: `chk-${Date.now()}-${Math.random()}`,
      index_id: parentIndex.id,
      clinic_id: parentIndex.clinic_id,
      chunk_index: chunkData.chunk_index,
      chunk_title: chunkData.chunk_title || 'Title',
      chunk_text: chunkData.chunk_text || 'Text',
      embedding_input: chunkData.embedding_input || 'Input',
      chunk_content_hash: chunkData.chunk_content_hash || 'chash',
      embedding: chunkData.embedding,
      created_at: new Date().toISOString()
    };
    mockChunks.push(chunk);
    return chunk;
  }

  const chunk1 = insertChunk(idx1, {
    chunk_index: 0,
    embedding: new Array(768).fill(0.05),
    chunk_title: 'Hours',
    chunk_text: 'Open 9 to 5'
  });
  testAssert('Valid chunk insertion accepted', !!chunk1.id, 'Failed to insert chunk');

  let duplicateChunkCaught = false;
  try {
    insertChunk(idx1, {
      chunk_index: 0,
      embedding: new Array(768).fill(0.05)
    });
  } catch {
    duplicateChunkCaught = true;
  }
  testAssert('Duplicate (index_id, chunk_index) rejected', duplicateChunkCaught, 'Failed to reject duplicate chunk index');

  let invalidDimCaught = false;
  try {
    insertChunk(idx1, {
      chunk_index: 1,
      embedding: new Array(1536).fill(0.01)
    });
  } catch {
    invalidDimCaught = true;
  }
  testAssert('Invalid vector dimension rejected (1536 vs 768)', invalidDimCaught, 'Failed to reject invalid vector dimension');

  let tenantDivergenceCaught = false;
  try {
    insertChunk(idx1, {
      clinic_id: 'clinic_B', // Mismatch with idx1 (clinic_A)
      chunk_index: 1,
      embedding: new Array(768).fill(0.05)
    });
  } catch {
    tenantDivergenceCaught = true;
  }
  testAssert('Chunk tenant divergence blocked by composite FK (index_id, clinic_id)', tenantDivergenceCaught, 'Allowed tenant divergence between chunk and parent index');

  // 3. Activation Safety Simulation
  function simulateActivation(clinicId: string, candidateIndex: ClinicRagIndex, releaseStatus: string, isLatestPublished: boolean) {
    if (candidateIndex.clinic_id !== clinicId) {
      throw new Error('Index belongs to another clinic');
    }
    if (candidateIndex.status !== 'READY') {
      throw new Error(`Candidate is in status ${candidateIndex.status}, required READY`);
    }
    if (candidateIndex.total_chunks <= 0 || candidateIndex.embedded_chunks !== candidateIndex.total_chunks) {
      throw new Error('Candidate is incomplete');
    }
    if (releaseStatus !== 'PUBLISHED') {
      throw new Error(`Release is ${releaseStatus}, required PUBLISHED`);
    }
    if (!isLatestPublished) {
      throw new Error('Candidate is for a stale release');
    }

    // Demote existing active
    const currentActive = mockIndices.find(i => i.clinic_id === clinicId && i.is_active);
    if (currentActive) {
      currentActive.is_active = false;
      currentActive.status = 'SUPERSEDED';
    }

    candidateIndex.is_active = true;
    candidateIndex.status = 'ACTIVE';
    candidateIndex.activated_at = new Date().toISOString();
    return { success: true, activated_index_id: candidateIndex.id };
  }

  // Candidate in BUILDING cannot activate
  const buildingCandidate: ClinicRagIndex = {
    ...idx1,
    id: 'idx-bld',
    status: 'BUILDING',
    is_active: false
  };
  let buildingActivationBlocked = false;
  try {
    simulateActivation('clinic_A', buildingCandidate, 'PUBLISHED', true);
  } catch {
    buildingActivationBlocked = true;
  }
  testAssert('BUILDING status cannot activate', buildingActivationBlocked, 'Allowed activation of BUILDING index');

  // Incomplete candidate cannot activate
  const incompleteCandidate: ClinicRagIndex = {
    ...idx1,
    id: 'idx-inc',
    status: 'READY',
    total_chunks: 5,
    embedded_chunks: 3,
    is_active: false
  };
  let incompleteBlocked = false;
  try {
    simulateActivation('clinic_A', incompleteCandidate, 'PUBLISHED', true);
  } catch {
    incompleteBlocked = true;
  }
  testAssert('Incomplete READY index cannot activate', incompleteBlocked, 'Allowed activation of incomplete index');

  // Candidate with unpublished release cannot activate
  const unpubCandidate: ClinicRagIndex = {
    ...idx1,
    id: 'idx-unpub',
    status: 'READY',
    total_chunks: 3,
    embedded_chunks: 3,
    is_active: false
  };
  let unpubBlocked = false;
  try {
    simulateActivation('clinic_A', unpubCandidate, 'COMPILED', true);
  } catch {
    unpubBlocked = true;
  }
  testAssert('Unpublished release candidate cannot activate', unpubBlocked, 'Allowed activation of unpublished release');

  // Candidate with stale release cannot activate
  let staleBlocked = false;
  try {
    simulateActivation('clinic_A', unpubCandidate, 'PUBLISHED', false);
  } catch {
    staleBlocked = true;
  }
  testAssert('Stale release candidate cannot activate', staleBlocked, 'Allowed activation of stale release');

  // Valid READY candidate activates atomically
  const validCandidate: ClinicRagIndex = {
    ...idx1,
    id: 'idx-valid',
    status: 'READY',
    total_chunks: 3,
    embedded_chunks: 3,
    is_active: false
  };
  mockIndices.push(validCandidate);
  const actResult = simulateActivation('clinic_A', validCandidate, 'PUBLISHED', true);
  testAssert('Valid READY candidate activates successfully', actResult.success, 'Failed to activate valid candidate');
  testAssert('Previous active index demoted to SUPERSEDED', activeA.status === 'SUPERSEDED' && !activeA.is_active, 'Previous active index was not demoted');

  // 4. Rollback Simulation
  function simulateRollback(clinicId: string, reason: string) {
    const active = mockIndices.find(i => i.clinic_id === clinicId && i.is_active);
    if (!active) return { success: false, message: 'No active index found' };

    active.is_active = false;
    active.status = 'ROLLBACK';
    active.rolled_back_at = new Date().toISOString();
    active.error_message = reason;

    // Find previous SUPERSEDED index
    const previous = mockIndices
      .filter(i => i.clinic_id === clinicId && i.status === 'SUPERSEDED')
      .sort((a, b) => (b.activated_at || '').localeCompare(a.activated_at || ''))[0];

    if (previous) {
      previous.is_active = true;
      previous.status = 'ACTIVE';
      return { success: true, restored_index_id: previous.id, fallback_to_legacy: false };
    } else {
      return { success: true, restored_index_id: null, fallback_to_legacy: true };
    }
  }

  const rollResult = simulateRollback('clinic_A', 'Evaluation failure in shadow test');
  testAssert('Rollback restores previous SUPERSEDED index', rollResult.success && rollResult.restored_index_id === activeA.id, 'Failed to restore previous index');
  testAssert('Active index restored to ACTIVE status', activeA.status === 'ACTIVE' && activeA.is_active, 'Restored index status incorrect');
  testAssert('Rollback does not delete vectors', mockChunks.length === 1, 'Vectors were erroneously deleted during rollback');

  // Rollback when no previous index exists
  simulateRollback('clinic_A', 'Second rollback'); // Demotes activeA to ROLLBACK
  const secondRollback = simulateRollback('clinic_A', 'Third rollback'); // No more active index
  testAssert('Rollback with no prior registry falls back to legacy path', secondRollback.success === false || secondRollback.fallback_to_legacy === true, 'Failed legacy fallback contract');

  console.log('\n================================================================');
  console.log(`PHASE 2B TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    throw new Error(`Phase 2B test suite failed with ${failed} failure(s)`);
  }
}

// Auto-run if executed directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('rag_phase2b_schema')) {
  runPhase2bSchemaTests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
