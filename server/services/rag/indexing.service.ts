import { KnowledgeService } from '../knowledge.service';
import { RagChunkingService, REPRESENTATION_VERSION_FORMATTED_V1, DEFAULT_EMBEDDING_MODEL, DEFAULT_EMBEDDING_DIMENSION } from './chunking.service';
import { RagEmbeddingService } from './embedding.service';
import { RagValidationService } from './validation.service';
import { RagRepository } from './repository';
import { IndexBuildResult, EmbeddingOptions, DocumentChunkWithEmbedding } from './types';
import { ClinicRagIndex } from '../../../src/types';

export class RagIndexingService {
  // In-flight indexing mutex to coordinate concurrent builds within a single Node process
  private static inFlightBuilds: Map<string, Promise<IndexBuildResult>> = new Map();

  // Multi-instance lease threshold: if an index has been BUILDING for over 15 minutes,
  // it is considered stale/crashed and eligible for resumption by another instance.
  private static readonly BUILDING_LEASE_TIMEOUT_MS = 15 * 60 * 1000;

  /**
   * Orchestrates the V2 dual indexing pipeline for a published knowledge release.
   * 
   * Lifecycle:
   * 1. Validate release exists, belongs to clinic, and is PUBLISHED
   * 2. Resolve/create index identity in clinic_rag_indices (BUILDING)
   * 3. Deterministically chunk release content (FORMATTED_V1)
   * 4. Generate 768-dim embeddings with bounded concurrency (<= 2)
   * 5. Batch-insert candidate chunks into clinic_rag_chunks
   * 6. Perform comprehensive completeness & tenant validation (VALIDATING)
   * 7. Transition candidate index to READY
   * 
   * Invariant: Does NOT activate candidate index (is_active remains FALSE).
   * Invariant: Production retrieval is untouched and continues using V1.
   */
  static async indexReleaseV2(
    clinicId: string,
    releaseId: string,
    compiledContent?: string,
    options: EmbeddingOptions = {}
  ): Promise<IndexBuildResult> {
    const startTime = Date.now();

    if (!clinicId || !releaseId) {
      return {
        success: false,
        clinic_id: clinicId,
        release_id: releaseId,
        status: 'FAILED',
        chunks_count: 0,
        error: 'Both clinicId and releaseId are required.'
      };
    }

    const representationVersion = REPRESENTATION_VERSION_FORMATTED_V1;
    const embeddingModel = options.model || DEFAULT_EMBEDDING_MODEL;
    const embeddingDimension = options.dimension || DEFAULT_EMBEDDING_DIMENSION;

    // Mutex key for concurrent duplicate builds of identical logical identity
    const mutexKey = `${clinicId}:${releaseId}:${representationVersion}:${embeddingModel}:${embeddingDimension}`;

    const existingInFlight = this.inFlightBuilds.get(mutexKey);
    if (existingInFlight) {
      console.log(`[RagIndexingService] Reusing in-flight build promise for identity: ${mutexKey}`);
      return existingInFlight;
    }

    const buildPromise = this.executeBuild(
      clinicId,
      releaseId,
      representationVersion,
      embeddingModel,
      embeddingDimension,
      compiledContent,
      options,
      startTime
    ).finally(() => {
      this.inFlightBuilds.delete(mutexKey);
    });

    this.inFlightBuilds.set(mutexKey, buildPromise);
    return buildPromise;
  }

  private static async executeBuild(
    clinicId: string,
    releaseId: string,
    representationVersion: string,
    embeddingModel: string,
    embeddingDimension: number,
    providedContent: string | undefined,
    options: EmbeddingOptions,
    startTime: number
  ): Promise<IndexBuildResult> {
    console.log(`[RagIndexingService] Initiating V2 indexing for clinic: ${clinicId}, release: ${releaseId}`);

    // 1. RELEASE VALIDATION
    let release;
    try {
      release = await KnowledgeService.getKnowledgeRelease(clinicId, releaseId);
    } catch (err: any) {
      console.error(`[RagIndexingService] Failed to fetch release: ${err.message}`);
      return {
        success: false,
        clinic_id: clinicId,
        release_id: releaseId,
        status: 'FAILED',
        chunks_count: 0,
        duration_ms: Date.now() - startTime,
        error: `Database error retrieving release: ${err.message}`
      };
    }

    if (!release) {
      console.error(`[RagIndexingService] Release ${releaseId} not found for clinic ${clinicId}`);
      return {
        success: false,
        clinic_id: clinicId,
        release_id: releaseId,
        status: 'FAILED',
        chunks_count: 0,
        duration_ms: Date.now() - startTime,
        error: `Release ${releaseId} does not exist or does not belong to clinic ${clinicId}.`
      };
    }

    if (release.clinic_id !== clinicId) {
      console.error(`[RagIndexingService] Tenant mismatch: release.clinic_id (${release.clinic_id}) !== ${clinicId}`);
      return {
        success: false,
        clinic_id: clinicId,
        release_id: releaseId,
        status: 'FAILED',
        chunks_count: 0,
        duration_ms: Date.now() - startTime,
        error: `Release ${releaseId} belongs to another clinic (${release.clinic_id}). Cross-tenant build blocked.`
      };
    }

    if (release.status !== 'PUBLISHED') {
      console.warn(`[RagIndexingService] Release ${releaseId} has status '${release.status}'. Only PUBLISHED releases can be indexed.`);
      return {
        success: false,
        clinic_id: clinicId,
        release_id: releaseId,
        status: 'FAILED',
        chunks_count: 0,
        duration_ms: Date.now() - startTime,
        error: `Release ${releaseId} status is '${release.status}', expected 'PUBLISHED'.`
      };
    }

    const content = providedContent || release.compiled_content;
    if (!content || !content.trim()) {
      console.error(`[RagIndexingService] Release ${releaseId} has empty compiled content.`);
      return {
        success: false,
        clinic_id: clinicId,
        release_id: releaseId,
        status: 'FAILED',
        chunks_count: 0,
        duration_ms: Date.now() - startTime,
        error: `Release ${releaseId} contains no compiled markdown content to index.`
      };
    }

    // 2. CHUNKING & HASH CALCULATION
    const chunkMetadataList = RagChunkingService.chunkReleaseContent(
      content,
      representationVersion,
      embeddingModel,
      embeddingDimension
    );

    if (chunkMetadataList.length === 0) {
      return {
        success: false,
        clinic_id: clinicId,
        release_id: releaseId,
        status: 'FAILED',
        chunks_count: 0,
        duration_ms: Date.now() - startTime,
        error: 'Markdown chunker yielded zero chunks from release content.'
      };
    }

    const indexContentHash = RagChunkingService.computeIndexContentHash(
      content,
      representationVersion,
      embeddingModel,
      embeddingDimension
    );

    // 3. IDEMPOTENT CANDIDATE INDEX RESOLUTION
    let candidateIndex: ClinicRagIndex;

    const existingIndex = await RagRepository.findIndexByIdentity({
      clinic_id: clinicId,
      release_id: releaseId,
      representation_version: representationVersion,
      embedding_model: embeddingModel,
      embedding_dimension: embeddingDimension
    });

    if (existingIndex) {
      if (existingIndex.status === 'READY' || existingIndex.status === 'ACTIVE' || existingIndex.status === 'SUPERSEDED') {
        console.log(`[RagIndexingService] Existing index ${existingIndex.id} is already in state ${existingIndex.status}. Reusing.`);
        return {
          success: true,
          index_id: existingIndex.id,
          clinic_id: clinicId,
          release_id: releaseId,
          status: existingIndex.status,
          chunks_count: existingIndex.total_chunks,
          reused_existing: true,
          duration_ms: Date.now() - startTime
        };
      }

      // Concurrency check for active BUILDING index
      if (existingIndex.status === 'BUILDING') {
        const buildAgeMs = Date.now() - new Date(existingIndex.created_at).getTime();
        if (buildAgeMs < this.BUILDING_LEASE_TIMEOUT_MS) {
          console.warn(
            `[RagIndexingService] An active build for index ${existingIndex.id} is already in progress on another instance (started ${Math.round(buildAgeMs / 1000)}s ago). Yielding to avoid destructive chunk wipe.`
          );
          return {
            success: false,
            index_id: existingIndex.id,
            clinic_id: clinicId,
            release_id: releaseId,
            status: 'BUILDING',
            chunks_count: existingIndex.total_chunks,
            duration_ms: Date.now() - startTime,
            error: 'An active index build is currently in progress on another instance. Please wait for completion.'
          };
        } else {
          console.warn(
            `[RagIndexingService] Stale BUILDING index ${existingIndex.id} detected (age: ${Math.round(buildAgeMs / 1000)}s > lease: ${this.BUILDING_LEASE_TIMEOUT_MS / 1000}s). Reclaiming lease and rebuilding.`
          );
        }
      }

      // If prior build was FAILED or a stale BUILDING lease, resume/rebuild cleanly
      console.log(`[RagIndexingService] Prior index ${existingIndex.id} was in state ${existingIndex.status}. Cleaning partial chunks and restarting.`);
      await RagRepository.deleteChunksByIndexId(existingIndex.id);

      candidateIndex = await RagRepository.updateIndex(existingIndex.id, {
        status: 'BUILDING',
        error_message: null,
        content_hash: indexContentHash,
        total_chunks: chunkMetadataList.length,
        embedded_chunks: 0,
        validation_report: null,
        validated_at: null
      });
    } else {
      // Create new candidate index record (RagRepository.createIndex handles PostgreSQL 23505 race conditions gracefully)
      candidateIndex = await RagRepository.createIndex({
        clinic_id: clinicId,
        release_id: releaseId,
        representation_version: representationVersion,
        embedding_model: embeddingModel,
        embedding_dimension: embeddingDimension,
        retrieval_threshold: 0.70,
        content_hash: indexContentHash,
        status: 'BUILDING',
        total_chunks: chunkMetadataList.length,
        embedded_chunks: 0
      });

      // If another instance created the index concurrently and won the race:
      if (candidateIndex.status === 'READY' || candidateIndex.status === 'ACTIVE' || candidateIndex.status === 'SUPERSEDED') {
        console.log(`[RagIndexingService] Adopted winning completed index ${candidateIndex.id} with status ${candidateIndex.status}.`);
        return {
          success: true,
          index_id: candidateIndex.id,
          clinic_id: clinicId,
          release_id: releaseId,
          status: candidateIndex.status,
          chunks_count: candidateIndex.total_chunks,
          reused_existing: true,
          duration_ms: Date.now() - startTime
        };
      }
    }

    // 4. EMBEDDING GENERATION WITH BOUNDED CONCURRENCY & RETRIES
    let embeddedChunks: DocumentChunkWithEmbedding[];
    try {
      embeddedChunks = await RagEmbeddingService.batchEmbedChunks(chunkMetadataList, {
        ...options,
        model: embeddingModel,
        dimension: embeddingDimension,
        concurrency: 2 // Strict concurrency cap
      });

      // Update progress
      candidateIndex = await RagRepository.updateIndex(candidateIndex.id, {
        embedded_chunks: embeddedChunks.length
      });
    } catch (embedError: any) {
      console.error(`[RagIndexingService] Embedding generation failed for index ${candidateIndex.id}:`, embedError.message);
      await RagRepository.updateIndex(candidateIndex.id, {
        status: 'FAILED',
        error_message: `Embedding failure: ${embedError.message}`
      });

      return {
        success: false,
        index_id: candidateIndex.id,
        clinic_id: clinicId,
        release_id: releaseId,
        status: 'FAILED',
        chunks_count: 0,
        duration_ms: Date.now() - startTime,
        error: embedError.message
      };
    }

    // 5. CHUNKS INSERTION IN BOUNDED BATCHES
    try {
      const recordsToInsert = embeddedChunks.map(chunk => ({
        index_id: candidateIndex.id,
        clinic_id: clinicId,
        chunk_index: chunk.chunk_index,
        chunk_title: chunk.chunk_title,
        chunk_text: chunk.chunk_text,
        embedding_input: chunk.embedding_input,
        chunk_content_hash: chunk.chunk_content_hash,
        embedding: chunk.embedding
      }));

      await RagRepository.insertChunksBatch(recordsToInsert, 50);
    } catch (insertError: any) {
      console.error(`[RagIndexingService] Chunk insertion failed for index ${candidateIndex.id}:`, insertError.message);
      await RagRepository.updateIndex(candidateIndex.id, {
        status: 'FAILED',
        error_message: `Chunk insertion failure: ${insertError.message}`
      });

      return {
        success: false,
        index_id: candidateIndex.id,
        clinic_id: clinicId,
        release_id: releaseId,
        status: 'FAILED',
        chunks_count: 0,
        duration_ms: Date.now() - startTime,
        error: insertError.message
      };
    }

    // 6. COMPLETENESS & TENANT INTEGRITY VALIDATION
    candidateIndex = await RagRepository.updateIndex(candidateIndex.id, {
      status: 'VALIDATING'
    });

    const storedChunks = await RagRepository.getChunksByIndexId(candidateIndex.id);
    const { isValid, report } = RagValidationService.validateCandidateIndex({
      index: candidateIndex,
      release,
      expectedChunks: chunkMetadataList,
      actualChunks: storedChunks
    });

    if (!isValid) {
      console.error(`[RagIndexingService] Validation failed for index ${candidateIndex.id}:`, report);
      await RagRepository.updateIndex(candidateIndex.id, {
        status: 'FAILED',
        validation_report: report,
        error_message: 'Completeness or integrity validation failed. See validation_report.'
      });

      return {
        success: false,
        index_id: candidateIndex.id,
        clinic_id: clinicId,
        release_id: releaseId,
        status: 'FAILED',
        chunks_count: storedChunks.length,
        duration_ms: Date.now() - startTime,
        validation_report: report,
        error: 'Candidate index failed completeness validation.'
      };
    }

    // 7. TRANSITION TO READY (STRICT INVARIANT: NEVER ACTIVATE IN PHASE 2C)
    const finalizedIndex = await RagRepository.updateIndex(candidateIndex.id, {
      status: 'READY',
      total_chunks: storedChunks.length,
      embedded_chunks: storedChunks.length,
      validated_at: new Date().toISOString(),
      validation_report: report,
      error_message: null
      // NOTE: is_active is NOT modified. It remains false.
    });

    const duration = Date.now() - startTime;
    console.log(
      `[RagIndexingService] Index ${finalizedIndex.id} successfully built and validated to READY in ${duration}ms (${storedChunks.length} chunks).`
    );

    return {
      success: true,
      index_id: finalizedIndex.id,
      clinic_id: clinicId,
      release_id: releaseId,
      status: 'READY',
      chunks_count: storedChunks.length,
      duration_ms: duration,
      validation_report: report
    };
  }
}
