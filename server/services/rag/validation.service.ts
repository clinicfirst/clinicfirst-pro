import { ClinicRagIndex, ClinicRagChunk, ClinicKnowledgeRelease } from '../../../src/types';
import { RagChunkingService } from './chunking.service';
import { RagEmbeddingService } from './embedding.service';
import {
  DocumentChunkMetadata,
  RagValidationCheck,
  RagValidationReport
} from './types';

export class RagValidationService {
  /**
   * Performs rigorous completeness and integrity validation on a candidate index and its chunks.
   * All checks must pass for the index to transition to READY.
   */
  static validateCandidateIndex(params: {
    index: ClinicRagIndex;
    release: ClinicKnowledgeRelease;
    expectedChunks: DocumentChunkMetadata[];
    actualChunks: ClinicRagChunk[];
  }): { isValid: boolean; report: RagValidationReport } {
    const { index, release, expectedChunks, actualChunks } = params;
    const checks: RagValidationCheck[] = [];

    // 1. Release Status Check
    const releasePublished = release.status === 'PUBLISHED';
    checks.push({
      check: 'release_published',
      passed: releasePublished,
      details: releasePublished
        ? `Release ${release.id} is in status PUBLISHED.`
        : `Release ${release.id} has invalid status '${release.status}', required PUBLISHED.`
    });

    // 2. Release-Tenant Anchor Check
    const releaseTenantMatch = release.clinic_id === index.clinic_id;
    checks.push({
      check: 'release_tenant_match',
      passed: releaseTenantMatch,
      details: releaseTenantMatch
        ? `Release clinic_id (${release.clinic_id}) matches index clinic_id (${index.clinic_id}).`
        : `Release clinic_id (${release.clinic_id}) does not match index clinic_id (${index.clinic_id}).`
    });

    // 3. Expected vs Actual Chunk Count Check
    const expectedCount = expectedChunks.length;
    const actualCount = actualChunks.length;
    const countMatch = expectedCount > 0 && expectedCount === actualCount;
    checks.push({
      check: 'chunk_count_match',
      passed: countMatch,
      details: countMatch
        ? `Exact count match: expected ${expectedCount}, got ${actualCount}.`
        : `Count mismatch: expected ${expectedCount}, got ${actualCount}.`
    });

    // 4. Contiguous Chunk Indices & No Duplicates Check
    const seenIndices = new Set<number>();
    let contiguous = true;
    let sequenceError = '';

    for (const chunk of actualChunks) {
      if (seenIndices.has(chunk.chunk_index)) {
        contiguous = false;
        sequenceError = `Duplicate chunk_index ${chunk.chunk_index} found.`;
        break;
      }
      seenIndices.add(chunk.chunk_index);
    }

    if (contiguous) {
      for (let i = 0; i < expectedCount; i++) {
        if (!seenIndices.has(i)) {
          contiguous = false;
          sequenceError = `Missing contiguous chunk_index ${i} (range 0..${expectedCount - 1}).`;
          break;
        }
      }
    }

    checks.push({
      check: 'contiguous_chunk_indices',
      passed: contiguous,
      details: contiguous
        ? `All chunk indices strictly contiguous from 0 to ${expectedCount - 1}.`
        : sequenceError
    });

    // 5. Chunk Tenant Isolation Check
    const allChunksMatchClinic = actualChunks.every(c => c.clinic_id === index.clinic_id);
    checks.push({
      check: 'chunk_tenant_isolation',
      passed: allChunksMatchClinic,
      details: allChunksMatchClinic
        ? `All ${actualChunks.length} chunks match parent index clinic_id (${index.clinic_id}).`
        : `One or more chunks have diverged clinic_id values.`
    });

    // 6. Non-Null Fields Check
    let nullFieldFound = false;
    let nullFieldDetails = '';
    for (const chunk of actualChunks) {
      if (!chunk.chunk_title || !chunk.chunk_text || !chunk.embedding_input || !chunk.chunk_content_hash) {
        nullFieldFound = true;
        nullFieldDetails = `Chunk at index ${chunk.chunk_index} has null or empty required textual fields.`;
        break;
      }
    }
    checks.push({
      check: 'non_null_text_fields',
      passed: !nullFieldFound,
      details: !nullFieldFound ? 'All chunks have non-empty text, title, input, and hash.' : nullFieldDetails
    });

    // 7. Vector Dimension & Value Validation
    let vectorValid = true;
    let vectorDetails = '';
    for (const chunk of actualChunks) {
      try {
        RagEmbeddingService.validateVector(chunk.embedding, index.embedding_dimension);
      } catch (err: any) {
        vectorValid = false;
        vectorDetails = `Vector validation error on chunk ${chunk.chunk_index}: ${err.message}`;
        break;
      }
    }
    checks.push({
      check: 'vector_dimensions_valid',
      passed: vectorValid,
      details: vectorValid
        ? `All ${actualChunks.length} chunks have verified ${index.embedding_dimension}-dimension finite vectors.`
        : vectorDetails
    });

    // 8. Chunk Content Hash Verification
    let hashesMatch = true;
    let hashDetails = '';
    for (let i = 0; i < actualChunks.length; i++) {
      const actual = actualChunks[i];
      const expected = expectedChunks.find(e => e.chunk_index === actual.chunk_index);
      if (!expected) {
        hashesMatch = false;
        hashDetails = `No expected chunk metadata found for actual chunk ${actual.chunk_index}.`;
        break;
      }
      if (actual.chunk_content_hash !== expected.chunk_content_hash) {
        hashesMatch = false;
        hashDetails = `Hash divergence at chunk ${actual.chunk_index}: expected ${expected.chunk_content_hash}, stored ${actual.chunk_content_hash}.`;
        break;
      }
    }
    checks.push({
      check: 'chunk_content_hashes_match',
      passed: hashesMatch,
      details: hashesMatch
        ? 'All chunk content hashes strictly match computed candidate hashes.'
        : hashDetails
    });

    // 9. Index Content Hash Verification
    const recomputedIndexHash = RagChunkingService.computeIndexContentHash(
      release.compiled_content,
      index.representation_version,
      index.embedding_model,
      index.embedding_dimension
    );
    const indexHashMatches = index.content_hash === recomputedIndexHash;
    checks.push({
      check: 'index_content_hash_match',
      passed: indexHashMatches,
      details: indexHashMatches
        ? 'Index content hash matches recomputed hash from compiled release.'
        : `Index hash mismatch: expected ${recomputedIndexHash}, recorded ${index.content_hash}.`
    });

    const allPassed = checks.every(c => c.passed);

    const report: RagValidationReport = {
      timestamp: new Date().toISOString(),
      all_passed: allPassed,
      checks,
      total_expected_chunks: expectedCount,
      total_validated_chunks: actualCount,
      representation_version: index.representation_version,
      embedding_model: index.embedding_model,
      embedding_dimension: index.embedding_dimension
    };

    return { isValid: allPassed, report };
  }
}
