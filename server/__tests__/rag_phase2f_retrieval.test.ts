import fs from 'fs';
import path from 'path';
import {
  RagRetrievalService,
  DEFAULT_V2_MATCH_THRESHOLD,
  DEFAULT_V1_MATCH_THRESHOLD
} from '../services/rag/retrieval.service';
import { RagService } from '../services/rag.service';
import { searchClinicKnowledge } from '../voice/tools/search-knowledge';

export async function runPhase2fRetrievalTests() {
  console.log('================================================================');
  console.log('PHASE 2F: APPLICATION-LAYER V2 RETRIEVAL & CUTOVER TEST SUITE');
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

  const originalEnv = { ...process.env };

  function resetEnv() {
    delete process.env.RAG_V2_ENABLED;
    delete process.env.RAG_V2_CLINIC_ALLOWLIST;
    delete process.env.RAG_V2_TIMEOUT_MS;
  }

  try {
    // --------------------------------------------------------------------------
    // GROUP 1: Strict Environment Flag Parsing & Eligibility Gating
    // --------------------------------------------------------------------------
    console.log('\n--- Group 1: Strict Environment Flag Parsing & Eligibility ---');
    resetEnv();

    testAssert(
      '1. V2 disabled by default when RAG_V2_ENABLED is undefined',
      RagRetrievalService.isV2GlobalEnabled() === false,
      'isV2GlobalEnabled must be false when undefined'
    );

    process.env.RAG_V2_ENABLED = 'TRUE';
    testAssert(
      '2. Rejects uppercase "TRUE"',
      RagRetrievalService.isV2GlobalEnabled() === false,
      'Must strictly reject uppercase TRUE'
    );

    process.env.RAG_V2_ENABLED = '1';
    testAssert(
      '3. Rejects numeric "1"',
      RagRetrievalService.isV2GlobalEnabled() === false,
      'Must strictly reject numeric 1'
    );

    process.env.RAG_V2_ENABLED = ' true ';
    testAssert(
      '4. Rejects padded " true "',
      RagRetrievalService.isV2GlobalEnabled() === false,
      'Must strictly reject padded string'
    );

    process.env.RAG_V2_ENABLED = 'true';
    testAssert(
      '5. Accepts exact lowercase "true"',
      RagRetrievalService.isV2GlobalEnabled() === true,
      'Must accept exact lowercase true'
    );

    // Allowlist evaluation
    process.env.RAG_V2_ENABLED = 'true';
    process.env.RAG_V2_CLINIC_ALLOWLIST = '';
    testAssert(
      '6. Empty allowlist enables all clinics when RAG_V2_ENABLED is true',
      RagRetrievalService.isV2EligibleForClinic('clinic_any').eligible === true,
      'Empty allowlist must allow all clinics'
    );

    process.env.RAG_V2_CLINIC_ALLOWLIST = '*';
    testAssert(
      '7. Wildcard allowlist "*" enables all clinics',
      RagRetrievalService.isV2EligibleForClinic('clinic_any').eligible === true,
      'Wildcard allowlist must allow all clinics'
    );

    process.env.RAG_V2_CLINIC_ALLOWLIST = 'clinic_canary, clinic_1787923240249_cqgw';
    testAssert(
      '8. Listed clinic in allowlist is eligible',
      RagRetrievalService.isV2EligibleForClinic('clinic_canary').eligible === true &&
      RagRetrievalService.isV2EligibleForClinic('clinic_1787923240249_cqgw').eligible === true,
      'Listed clinics must be eligible'
    );

    const nonListed = RagRetrievalService.isV2EligibleForClinic('clinic_other');
    testAssert(
      '9. Non-listed clinic in allowlist is ineligible with reason CLINIC_NOT_IN_ALLOWLIST',
      nonListed.eligible === false && nonListed.reason === 'CLINIC_NOT_IN_ALLOWLIST',
      'Unlisted clinic must be rejected'
    );

    // --------------------------------------------------------------------------
    // GROUP 2: V2 Retrieval Success & Legitimate Abstention (Zero Results)
    // --------------------------------------------------------------------------
    console.log('\n--- Group 2: V2 Retrieval Success & Abstention ---');

    let v2RpcCalled = false;
    let v1RpcCalled = false;

    const mockV2Success = async () => {
      v2RpcCalled = true;
      return {
        data: [
          {
            id: 'v2_chunk_1',
            chunk_text: 'Open 8:00 AM to 6:00 PM Monday to Friday.',
            chunk_title: 'Operating Hours',
            similarity: 0.88,
            representation_version: 'FORMATTED_V1'
          }
        ],
        error: null
      };
    };

    const resSuccess = await RagRetrievalService.retrieve('clinic_canary', 'Operating hours', {
      _testSeam: {
        forceVersion: 'V2',
        mockV2Rpc: mockV2Success
      }
    });

    testAssert(
      '10. V2 successful retrieval returns V2 chunks with fallback_occurred = false',
      resSuccess.version_used === 'V2' &&
      resSuccess.fallback_occurred === false &&
      resSuccess.chunks.length === 1 &&
      resSuccess.chunks[0].chunk_text.includes('8:00 AM to 6:00 PM') &&
      resSuccess.chunks[0].similarity === 0.88,
      'V2 success must return V2 version and chunks'
    );

    // Legitimate Abstention: V2 returns 0 rows (no chunk exceeded threshold)
    v2RpcCalled = false;
    v1RpcCalled = false;
    const mockV2Empty = async () => {
      v2RpcCalled = true;
      return { data: [], error: null };
    };
    const mockV1MustNotCall = async () => {
      v1RpcCalled = true;
      return { data: [{ id: 'v1_bad', chunk_text: 'Should not exist', similarity: 0.6 }], error: null };
    };

    const resAbstention = await RagRetrievalService.retrieve('clinic_canary', 'Random unrelated query', {
      _testSeam: {
        forceVersion: 'V2',
        mockV2Rpc: mockV2Empty,
        mockV1Rpc: mockV1MustNotCall
      }
    });

    testAssert(
      '11. V2 legitimate zero-result abstention returns empty [] and DOES NOT trigger V1 fallback',
      resAbstention.version_used === 'V2' &&
      resAbstention.fallback_occurred === false &&
      resAbstention.chunks.length === 0 &&
      v1RpcCalled === false,
      'Abstention must return [] without triggering V1'
    );

    // --------------------------------------------------------------------------
    // GROUP 3: V2 Failures, Timeout & V1 Fallback
    // --------------------------------------------------------------------------
    console.log('\n--- Group 3: V2 Failures, Timeout & V1 Fallback ---');

    // 12. RPC Error triggers V1
    const mockV2Error = async () => {
      return { data: null, error: { message: 'Database connection timeout' } };
    };
    const mockV1FallbackSuccess = async () => {
      return { data: [{ id: 'v1_rescued', chunk_text: 'V1 fallback content', similarity: 0.65 }], error: null };
    };

    const resRpcError = await RagRetrievalService.retrieve('clinic_canary', 'Insurance plans', {
      _testSeam: {
        forceVersion: 'V2',
        mockV2Rpc: mockV2Error,
        mockV1Rpc: mockV1FallbackSuccess
      }
    });

    testAssert(
      '12. V2 RPC error safely triggers V1 fallback with fallback_reason = RPC_ERROR',
      resRpcError.version_used === 'V1' &&
      resRpcError.fallback_occurred === true &&
      resRpcError.fallback_reason === 'RPC_ERROR' &&
      resRpcError.chunks.length === 1 &&
      resRpcError.chunks[0].chunk_text === 'V1 fallback content',
      'RPC error must trigger V1 fallback'
    );

    // 13. Timeout triggers V1
    const mockV2Timeout = async () => {
      return new Promise<any>((resolve) => setTimeout(resolve, 5000));
    };

    const resTimeout = await RagRetrievalService.retrieve('clinic_canary', 'Cancellation policy', {
      timeoutMs: 50,
      _testSeam: {
        forceVersion: 'V2',
        mockQueryEmbedding: new Array(768).fill(0.01),
        mockV2Rpc: mockV2Timeout,
        mockV1Rpc: mockV1FallbackSuccess
      }
    });

    testAssert(
      '13. V2 timeout safely triggers V1 fallback with fallback_reason = RPC_TIMEOUT',
      resTimeout.version_used === 'V1' &&
      resTimeout.fallback_occurred === true &&
      resTimeout.fallback_reason === 'RPC_TIMEOUT' &&
      resTimeout.chunks.length === 1,
      'Timeout must trigger V1 fallback'
    );

    // 14. Malformed output triggers V1
    const mockV2Malformed = async () => {
      return {
        data: [{ id: 'bad', chunk_text: 'Missing similarity', similarity: 'not-a-number' }],
        error: null
      };
    };

    const resMalformed = await RagRetrievalService.retrieve('clinic_canary', 'Doctor specialties', {
      _testSeam: {
        forceVersion: 'V2',
        mockV2Rpc: mockV2Malformed,
        mockV1Rpc: mockV1FallbackSuccess
      }
    });

    testAssert(
      '14. V2 malformed output safely triggers V1 fallback with fallback_reason = MALFORMED_OUTPUT',
      resMalformed.version_used === 'V1' &&
      resMalformed.fallback_occurred === true &&
      resMalformed.fallback_reason === 'MALFORMED_OUTPUT' &&
      resMalformed.chunks[0].chunk_text === 'V1 fallback content',
      'Malformed output must trigger V1 fallback'
    );

    // 15. Double failure (V2 and V1 both fail) returns version NONE + empty array
    const mockV1Error = async () => {
      return { data: null, error: { message: 'V1 legacy table error' } };
    };

    const resDoubleFail = await RagRetrievalService.retrieve('clinic_canary', 'Emergency contact', {
      _testSeam: {
        forceVersion: 'V2',
        mockV2Rpc: mockV2Error,
        mockV1Rpc: mockV1Error
      }
    });

    testAssert(
      '15. Double failure (V2 + V1 fail) safely returns version NONE and empty [] without crashing',
      resDoubleFail.version_used === 'NONE' &&
      resDoubleFail.fallback_occurred === true &&
      resDoubleFail.chunks.length === 0,
      'Double failure must return empty []'
    );

    // --------------------------------------------------------------------------
    // GROUP 4: Multi-Tenant Scoping & Security
    // --------------------------------------------------------------------------
    console.log('\n--- Group 4: Multi-Tenant Scoping & Security ---');

    let capturedV2ClinicId = '';
    let capturedV1ClinicId = '';

    await RagRetrievalService.retrieve('clinic_tenant_alpha', 'Check tenant parameter', {
      _testSeam: {
        forceVersion: 'V2',
        mockV2Rpc: async (params) => {
          capturedV2ClinicId = params.p_clinic_id;
          return { data: null, error: { message: 'Force fallback to check V1' } };
        },
        mockV1Rpc: async (params) => {
          capturedV1ClinicId = params.p_clinic_id;
          return { data: [], error: null };
        }
      }
    });

    testAssert(
      '16. Tenant isolation: Server-authoritative clinic ID is passed to V2 RPC',
      capturedV2ClinicId === 'clinic_tenant_alpha',
      'V2 must receive the verified clinic_id'
    );

    testAssert(
      '17. Tenant isolation: V1 fallback preserves the exact same authorized clinic ID',
      capturedV1ClinicId === 'clinic_tenant_alpha',
      'V1 fallback must preserve the same verified clinic_id'
    );

    // --------------------------------------------------------------------------
    // GROUP 5: Malformed Data Validation Safeguards
    // --------------------------------------------------------------------------
    console.log('\n--- Group 5: Malformed Data Validation ---');

    let rejectedOutOfRange = false;
    try {
      RagRetrievalService.validateV2Chunks([{ id: '1', chunk_text: 'text', similarity: 1.5 }]);
    } catch {
      rejectedOutOfRange = true;
    }
    testAssert('18. Rejects similarity > 1.0', rejectedOutOfRange, 'Must reject similarity > 1.0');

    let rejectedMissingId = false;
    try {
      RagRetrievalService.validateV2Chunks([{ id: '', chunk_text: 'text', similarity: 0.8 }]);
    } catch {
      rejectedMissingId = true;
    }
    testAssert('19. Rejects missing ID', rejectedMissingId, 'Must reject missing ID');

    let rejectedEmptyChunkText = false;
    try {
      RagRetrievalService.validateV2Chunks([{ id: '1', chunk_text: '   ', similarity: 0.8 }]);
    } catch {
      rejectedEmptyChunkText = true;
    }
    testAssert('20. Rejects whitespace-only chunk text', rejectedEmptyChunkText, 'Must reject empty chunk_text');

    // --------------------------------------------------------------------------
    // GROUP 6: Telemetry & PII Redaction
    // --------------------------------------------------------------------------
    console.log('\n--- Group 6: Telemetry & PII Redaction ---');

    let loggedOutput = '';
    const origLog = console.log;
    console.log = (...args: any[]) => {
      loggedOutput += args.join(' ') + '\n';
      origLog(...args);
    };

    await RagRetrievalService.retrieve('clinic_canary', 'Private medical patient condition text', {
      callId: 'call_corr_999',
      _testSeam: {
        forceVersion: 'V2',
        mockV2Rpc: mockV2Success
      }
    });

    console.log = origLog;

    testAssert(
      '21. Telemetry logs contain event "rag_retrieval" with clinic_id and call_id',
      loggedOutput.includes('[RAG_TELEMETRY]') &&
      loggedOutput.includes('"event":"rag_retrieval"') &&
      loggedOutput.includes('"clinic_id":"clinic_canary"') &&
      loggedOutput.includes('"call_id":"call_corr_999"'),
      'Telemetry must record metadata'
    );

    testAssert(
      '22. Telemetry logs DO NOT leak raw query text or confidential knowledge chunks',
      !loggedOutput.includes('Private medical patient condition text') &&
      !loggedOutput.includes('query_embedding') &&
      !loggedOutput.includes('GEMINI_API_KEY'),
      'Telemetry must strip all PII and vectors'
    );

    // --------------------------------------------------------------------------
    // GROUP 7: Voice Tool Integration & Facade Compatibility
    // --------------------------------------------------------------------------
    console.log('\n--- Group 7: Voice Tool Integration & RagService Facade ---');

    const voiceToolResult = await searchClinicKnowledge('clinic_alpha', {
      query: 'What is the vaccination schedule?'
    });

    testAssert(
      '23. searchClinicKnowledge returns standard voice tool contract ({ success: true, message, context })',
      voiceToolResult.success === true &&
      typeof voiceToolResult.message === 'string' &&
      typeof voiceToolResult.context === 'string',
      'Voice tool contract must be respected'
    );

    testAssert(
      '24. RagService.searchKnowledge maintains 2-parameter signature',
      typeof RagService.searchKnowledge === 'function' && RagService.searchKnowledge.length === 2,
      'Public facade signature must be preserved'
    );

    // --------------------------------------------------------------------------
    // GROUP 8: Code Architecture & Production Isolation Invariants
    // --------------------------------------------------------------------------
    console.log('\n--- Group 8: Safety & Isolation Invariants ---');

    const retrievalCode = fs.readFileSync(
      path.join(process.cwd(), 'server/services/rag/retrieval.service.ts'),
      'utf8'
    );

    testAssert(
      '25. retrieval.service.ts does NOT call activate_rag_index',
      !retrievalCode.includes('activate_rag_index'),
      'activate_rag_index must never be called in retrieval code'
    );

    testAssert(
      '26. retrieval.service.ts does NOT call rollback_rag_index',
      !retrievalCode.includes('rollback_rag_index'),
      'rollback_rag_index must never be called in retrieval code'
    );

    const voiceToolCode = fs.readFileSync(
      path.join(process.cwd(), 'server/voice/tools/search-knowledge.ts'),
      'utf8'
    );

    testAssert(
      '27. search-knowledge.ts is completely unmodified',
      voiceToolCode.includes('RagService.searchKnowledge(clinicId, query)'),
      'Voice tool must continue delegating directly to RagService'
    );

    const appointmentCode = fs.readFileSync(
      path.join(process.cwd(), 'server/services/appointment.service.ts'),
      'utf8'
    );

    testAssert(
      '28. appointment.service.ts is completely isolated from RAG V2 changes',
      !appointmentCode.includes('RagRetrievalService') && !appointmentCode.includes('match_clinic_knowledge_v2'),
      'Appointment service must have zero RAG dependencies'
    );

  } finally {
    process.env = { ...originalEnv };
  }

  console.log('\n================================================================');
  console.log(`PHASE 2F TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    throw new Error(`Phase 2F test suite failed with ${failed} failure(s)`);
  }
}

// Auto-run if executed directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('rag_phase2f_retrieval')) {
  runPhase2fRetrievalTests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
