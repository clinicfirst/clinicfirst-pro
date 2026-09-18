import { supabase, isOfflineMode } from '../../supabaseDiff';
import { db } from '../../db';
import { RagChunkingService } from './chunking.service';
import { RagEmbeddingService } from './embedding.service';
import {
  RagRetrievalOptions,
  RagRetrievalResponse,
  RagChunkResult,
  RagFallbackReason
} from './types';

// Strict default retrieval configuration
export const DEFAULT_V2_MATCH_THRESHOLD = 0.70;
export const DEFAULT_V1_MATCH_THRESHOLD = 0.60;
export const DEFAULT_MATCH_COUNT = 3;
export const DEFAULT_RAG_V2_TIMEOUT_MS = 2500;

export class RagRetrievalService {
  /**
   * Deterministic boolean evaluation of RAG_V2_ENABLED.
   * Strictly matches "true" only (rejects "TRUE", "1", "true ", truthy objects).
   */
  static isV2GlobalEnabled(): boolean {
    return process.env.RAG_V2_ENABLED === 'true';
  }

  /**
   * Evaluates clinic eligibility against RAG_V2_CLINIC_ALLOWLIST.
   * - If RAG_V2_ENABLED !== 'true' -> ineligible.
   * - If allowlist is empty or undefined -> eligible when global switch is enabled.
   * - If allowlist is '*' -> all clinics eligible.
   * - If allowlist is comma-separated string -> clinicId must be an exact trimmed match.
   */
  static isV2EligibleForClinic(clinicId: string): { eligible: boolean; reason?: RagFallbackReason } {
    if (!this.isV2GlobalEnabled()) {
      return { eligible: false, reason: 'V2_DISABLED_BY_CONFIG' };
    }

    const rawAllowlist = process.env.RAG_V2_CLINIC_ALLOWLIST;
    if (!rawAllowlist || rawAllowlist.trim() === '') {
      return { eligible: true };
    }

    const trimmed = rawAllowlist.trim();
    if (trimmed === '*') {
      return { eligible: true };
    }

    const allowedClinics = trimmed.split(',').map(s => s.trim()).filter(Boolean);
    if (allowedClinics.includes(clinicId)) {
      return { eligible: true };
    }

    return { eligible: false, reason: 'CLINIC_NOT_IN_ALLOWLIST' };
  }

  /**
   * Resolves the configured timeout in milliseconds.
   */
  static getTimeoutMs(customTimeout?: number): number {
    if (typeof customTimeout === 'number' && customTimeout > 0) {
      return customTimeout;
    }
    const envVal = process.env.RAG_V2_TIMEOUT_MS;
    if (envVal) {
      const parsed = parseInt(envVal, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return DEFAULT_RAG_V2_TIMEOUT_MS;
  }

  /**
   * Validates each chunk returned by the V2 database RPC.
   * Rejects malformed records (missing text/id, non-numeric or non-finite similarity, out of range).
   */
  static validateV2Chunks(data: any[]): RagChunkResult[] {
    if (!Array.isArray(data)) {
      throw new Error('V2 output is not an array');
    }

    const validated: RagChunkResult[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row || typeof row !== 'object') {
        throw new Error(`Row ${i} is not an object`);
      }

      const id = String(row.id || '');
      const chunk_text = typeof row.chunk_text === 'string' ? row.chunk_text : '';
      const similarity = Number(row.similarity);

      if (!id) {
        throw new Error(`Row ${i} missing required id`);
      }
      if (!chunk_text || chunk_text.trim() === '') {
        throw new Error(`Row ${i} missing required chunk_text`);
      }
      if (typeof similarity !== 'number' || isNaN(similarity) || !Number.isFinite(similarity)) {
        throw new Error(`Row ${i} similarity is non-finite or NaN (value: ${row.similarity})`);
      }
      if (similarity < -1.0 || similarity > 1.0) {
        throw new Error(`Row ${i} similarity out of expected [-1, 1] cosine bounds (value: ${similarity})`);
      }

      validated.push({
        id,
        chunk_text,
        similarity,
        title: typeof row.chunk_title === 'string' ? row.chunk_title : undefined,
        representation_version: typeof row.representation_version === 'string' ? row.representation_version : undefined
      });
    }

    return validated;
  }

  /**
   * Primary entrypoint: Retrieves knowledge context using V2 when eligible,
   * falling back to V1 on infrastructure/RPC errors or timeouts.
   * Legitimate V2 zero-matches are treated as intentional abstentions without V1 fallback.
   */
  static async retrieve(
    clinicId: string,
    query: string,
    options: RagRetrievalOptions = {}
  ): Promise<RagRetrievalResponse> {
    const startTime = Date.now();
    const matchCount = options.matchCount ?? DEFAULT_MATCH_COUNT;
    const matchThreshold = options.matchThreshold ?? DEFAULT_V2_MATCH_THRESHOLD;
    const timeoutMs = this.getTimeoutMs(options.timeoutMs);

    // 1. Eligibility Check (with test-seam override if specified)
    let isEligible = false;
    let ineligibilityReason: RagFallbackReason | undefined;

    if (options._testSeam?.forceVersion === 'V1') {
      isEligible = false;
      ineligibilityReason = 'V2_DISABLED_BY_CONFIG';
    } else if (options._testSeam?.forceVersion === 'V2') {
      isEligible = true;
    } else {
      const eligibility = this.isV2EligibleForClinic(clinicId);
      isEligible = eligibility.eligible;
      ineligibilityReason = eligibility.reason;
    }

    // If not eligible, directly execute V1
    if (!isEligible) {
      const v1Result = await this.retrieveV1(clinicId, query, {
        matchCount,
        matchThreshold: options.matchThreshold ?? DEFAULT_V1_MATCH_THRESHOLD,
        _testSeam: options._testSeam
      });

      this.logTelemetry({
        clinic_id: clinicId,
        call_id: options.callId,
        version_attempted: 'V1',
        version_resolved: v1Result.version_used,
        fallback_occurred: false,
        fallback_reason: ineligibilityReason,
        result_count: v1Result.chunks.length,
        threshold_applied: options.matchThreshold ?? DEFAULT_V1_MATCH_THRESHOLD,
        top_similarity: v1Result.chunks[0]?.similarity,
        latency_embedding_ms: v1Result.latency_ms.embedding,
        latency_db_ms: v1Result.latency_ms.db,
        latency_total_ms: Date.now() - startTime
      });

      return v1Result;
    }

    // 2. V2 Execution Path
    let embeddingStart = Date.now();
    let embeddingLatency = 0;
    let v2QueryEmbedding: number[] | null = null;

    try {
      if (options._testSeam?.mockQueryEmbedding) {
        v2QueryEmbedding = options._testSeam.mockQueryEmbedding;
      } else {
        const formattedInput = RagChunkingService.formatQueryEmbeddingInput(query);
        v2QueryEmbedding = await RagEmbeddingService.generateEmbedding(formattedInput, {
          timeoutMs: Math.min(timeoutMs, 10000)
        });
      }
      embeddingLatency = Date.now() - embeddingStart;
    } catch (err: any) {
      embeddingLatency = Date.now() - embeddingStart;
      console.warn('[RagRetrievalService] V2 query embedding failed. Falling back to V1.', {
        clinic_id: clinicId,
        reason: 'EMBEDDING_FAILURE'
      });

      const v1Result = await this.retrieveV1(clinicId, query, {
        matchCount,
        matchThreshold: options.matchThreshold ?? DEFAULT_V1_MATCH_THRESHOLD,
        _testSeam: options._testSeam
      });

      this.logTelemetry({
        clinic_id: clinicId,
        call_id: options.callId,
        version_attempted: 'V2',
        version_resolved: v1Result.version_used,
        fallback_occurred: true,
        fallback_reason: 'EMBEDDING_FAILURE',
        result_count: v1Result.chunks.length,
        threshold_applied: options.matchThreshold ?? DEFAULT_V1_MATCH_THRESHOLD,
        top_similarity: v1Result.chunks[0]?.similarity,
        latency_embedding_ms: embeddingLatency,
        latency_db_ms: v1Result.latency_ms.db,
        latency_total_ms: Date.now() - startTime
      });

      return {
        ...v1Result,
        fallback_occurred: true,
        fallback_reason: 'EMBEDDING_FAILURE'
      };
    }

    // 3. Database RPC Execution with Timeout Race
    const dbStart = Date.now();
    let dbLatency = 0;
    let rpcResult: { data: any; error: any } | null = null;
    let timeoutOccurred = false;

    try {
      const rpcCallPromise = (async () => {
        if (options._testSeam?.mockV2Rpc) {
          return options._testSeam.mockV2Rpc({
            query_embedding: v2QueryEmbedding,
            match_count: matchCount,
            p_clinic_id: clinicId,
            match_threshold: matchThreshold
          });
        }

        if (isOfflineMode || !supabase) {
          // Offline local memory inspection for V2
          const list = ((db.data as any).clinic_rag_indices || []) as any[];
          const activeIndex = list.find(
            i => i.clinic_id === clinicId && i.is_active === true && i.status === 'ACTIVE'
          );
          if (!activeIndex) {
            return { data: [], error: null };
          }
          const chunks = ((db.data as any).clinic_rag_chunks || []) as any[];
          const clinicChunks = chunks.filter(c => c.index_id === activeIndex.id && c.clinic_id === clinicId);
          // Return simulated chunks
          return {
            data: clinicChunks.slice(0, matchCount).map((c: any) => ({
              id: c.id,
              chunk_text: c.chunk_text,
              chunk_title: c.chunk_title,
              similarity: 0.85,
              representation_version: 'FORMATTED_V1'
            })),
            error: null
          };
        }

        return await supabase.rpc('match_clinic_knowledge_v2', {
          query_embedding: v2QueryEmbedding,
          match_count: matchCount,
          p_clinic_id: clinicId,
          match_threshold: matchThreshold
        });
      })();

      let timerHandle: any;
      const timeoutPromise = new Promise<{ timeout: true }>((resolve) => {
        timerHandle = setTimeout(() => resolve({ timeout: true }), timeoutMs);
      });

      const raced = await Promise.race([rpcCallPromise, timeoutPromise]);
      clearTimeout(timerHandle);

      if ('timeout' in raced) {
        timeoutOccurred = true;
      } else {
        rpcResult = raced;
      }
      dbLatency = Date.now() - dbStart;
    } catch (err: any) {
      dbLatency = Date.now() - dbStart;
      rpcResult = { data: null, error: err };
    }

    // 4. Evaluate RPC Result / Fallbacks
    let fallbackReason: RagFallbackReason | undefined;

    if (timeoutOccurred) {
      fallbackReason = 'RPC_TIMEOUT';
    } else if (rpcResult?.error) {
      fallbackReason = 'RPC_ERROR';
    }

    // If an infrastructure error or timeout occurred, trigger V1 fallback
    if (fallbackReason) {
      console.warn(`[RagRetrievalService] V2 failure (${fallbackReason}). Executing V1 fallback.`, {
        clinic_id: clinicId,
        reason: fallbackReason
      });

      const v1Result = await this.retrieveV1(clinicId, query, {
        matchCount,
        matchThreshold: options.matchThreshold ?? DEFAULT_V1_MATCH_THRESHOLD,
        _testSeam: options._testSeam
      });

      this.logTelemetry({
        clinic_id: clinicId,
        call_id: options.callId,
        version_attempted: 'V2',
        version_resolved: v1Result.version_used,
        fallback_occurred: true,
        fallback_reason: fallbackReason,
        result_count: v1Result.chunks.length,
        threshold_applied: options.matchThreshold ?? DEFAULT_V1_MATCH_THRESHOLD,
        top_similarity: v1Result.chunks[0]?.similarity,
        latency_embedding_ms: embeddingLatency,
        latency_db_ms: dbLatency + v1Result.latency_ms.db,
        latency_total_ms: Date.now() - startTime
      });

      return {
        ...v1Result,
        fallback_occurred: true,
        fallback_reason: fallbackReason
      };
    }

    // 5. Output Validation
    try {
      const rawData = rpcResult?.data ?? [];
      const validatedChunks = this.validateV2Chunks(rawData);

      // CASE A: Matches returned -> Return V2 results
      // CASE B: 0 matches returned -> Legitimate abstention! Return empty [] without fallback.
      this.logTelemetry({
        clinic_id: clinicId,
        call_id: options.callId,
        version_attempted: 'V2',
        version_resolved: 'V2',
        fallback_occurred: false,
        result_count: validatedChunks.length,
        threshold_applied: matchThreshold,
        top_similarity: validatedChunks[0]?.similarity,
        latency_embedding_ms: embeddingLatency,
        latency_db_ms: dbLatency,
        latency_total_ms: Date.now() - startTime
      });

      return {
        chunks: validatedChunks,
        version_used: 'V2',
        fallback_occurred: false,
        latency_ms: {
          embedding: embeddingLatency,
          db: dbLatency,
          total: Date.now() - startTime
        }
      };
    } catch (validationErr: any) {
      console.warn('[RagRetrievalService] V2 returned malformed output. Executing V1 fallback.', {
        clinic_id: clinicId,
        validation_error: validationErr.message
      });

      const v1Result = await this.retrieveV1(clinicId, query, {
        matchCount,
        matchThreshold: options.matchThreshold ?? DEFAULT_V1_MATCH_THRESHOLD,
        _testSeam: options._testSeam
      });

      this.logTelemetry({
        clinic_id: clinicId,
        call_id: options.callId,
        version_attempted: 'V2',
        version_resolved: v1Result.version_used,
        fallback_occurred: true,
        fallback_reason: 'MALFORMED_OUTPUT',
        result_count: v1Result.chunks.length,
        threshold_applied: options.matchThreshold ?? DEFAULT_V1_MATCH_THRESHOLD,
        top_similarity: v1Result.chunks[0]?.similarity,
        latency_embedding_ms: embeddingLatency,
        latency_db_ms: dbLatency + v1Result.latency_ms.db,
        latency_total_ms: Date.now() - startTime
      });

      return {
        ...v1Result,
        fallback_occurred: true,
        fallback_reason: 'MALFORMED_OUTPUT'
      };
    }
  }

  /**
   * Internal V1 retrieval runner.
   * Calls match_clinic_knowledge (raw query embedding, 0.60 threshold).
   */
  static async retrieveV1(
    clinicId: string,
    query: string,
    options: { matchCount: number; matchThreshold: number; _testSeam?: RagRetrievalOptions['_testSeam'] }
  ): Promise<RagRetrievalResponse> {
    const start = Date.now();
    let embeddingLatency = 0;
    let dbLatency = 0;

    try {
      // 1. Generate unformatted raw query embedding (legacy V1 pattern)
      const embStart = Date.now();
      let queryEmbedding: number[];

      if (options._testSeam?.mockV1Rpc) {
        queryEmbedding = new Array(768).fill(0.01);
      } else {
        const { RagService } = await import('../rag.service');
        queryEmbedding = await RagService.generateEmbedding(query);
      }
      embeddingLatency = Date.now() - embStart;

      // 2. Call V1 RPC
      const dbStart = Date.now();
      let data: any = null;
      let error: any = null;

      if (options._testSeam?.mockV1Rpc) {
        const res = await options._testSeam.mockV1Rpc({
          query_embedding: queryEmbedding,
          match_threshold: options.matchThreshold,
          match_count: options.matchCount,
          p_clinic_id: clinicId
        });
        data = res.data;
        error = res.error;
      } else if (isOfflineMode || !supabase) {
        data = [];
      } else {
        const res = await supabase.rpc('match_clinic_knowledge', {
          query_embedding: queryEmbedding,
          match_threshold: options.matchThreshold,
          match_count: options.matchCount,
          p_clinic_id: clinicId
        });
        data = res.data;
        error = res.error;
      }
      dbLatency = Date.now() - dbStart;

      if (error) {
        throw error;
      }

      const rows = Array.isArray(data) ? data : [];
      const chunks: RagChunkResult[] = rows.map((r: any, idx: number) => ({
        id: String(r.id || `v1_chunk_${idx}`),
        chunk_text: String(r.chunk_text || ''),
        similarity: Number(r.similarity ?? 0.6)
      }));

      return {
        chunks,
        version_used: 'V1',
        fallback_occurred: false,
        latency_ms: {
          embedding: embeddingLatency,
          db: dbLatency,
          total: Date.now() - start
        }
      };
    } catch (v1Err: any) {
      console.error('[RagRetrievalService] V1 retrieval failed:', v1Err?.message || v1Err);
      return {
        chunks: [],
        version_used: 'NONE',
        fallback_occurred: true,
        fallback_reason: 'RPC_ERROR',
        latency_ms: {
          embedding: embeddingLatency,
          db: dbLatency,
          total: Date.now() - start
        }
      };
    }
  }

  /**
   * Safe structured telemetry logging.
   * Strips all PII, patient queries, embeddings, credentials, and full knowledge text.
   */
  private static logTelemetry(telemetry: {
    clinic_id: string;
    call_id?: string;
    version_attempted: 'V1' | 'V2';
    version_resolved: 'V1' | 'V2' | 'NONE';
    fallback_occurred: boolean;
    fallback_reason?: RagFallbackReason;
    result_count: number;
    threshold_applied: number;
    top_similarity?: number;
    latency_embedding_ms: number;
    latency_db_ms: number;
    latency_total_ms: number;
  }): void {
    const payload = {
      event: 'rag_retrieval',
      timestamp: new Date().toISOString(),
      clinic_id: telemetry.clinic_id,
      call_id: telemetry.call_id || undefined,
      version_attempted: telemetry.version_attempted,
      version_resolved: telemetry.version_resolved,
      fallback_occurred: telemetry.fallback_occurred,
      fallback_reason: telemetry.fallback_reason || undefined,
      result_count: telemetry.result_count,
      threshold_applied: telemetry.threshold_applied,
      top_similarity: typeof telemetry.top_similarity === 'number' ? Number(telemetry.top_similarity.toFixed(4)) : undefined,
      latency_ms: {
        embedding: telemetry.latency_embedding_ms,
        db: telemetry.latency_db_ms,
        total: telemetry.latency_total_ms
      }
    };

    console.log(`[RAG_TELEMETRY] ${JSON.stringify(payload)}`);
  }
}
