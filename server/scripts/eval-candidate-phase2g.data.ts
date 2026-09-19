import fs from 'fs';
import path from 'path';

export interface CandidateChunk {
  id: string;
  index_id: string;
  clinic_id: string;
  chunk_index: number;
  chunk_title: string;
  chunk_text: string;
  embedding: number[];
}

export interface CandidateMetadata {
  id: string;
  clinic_id: string;
  release_id: string;
  status: string;
  is_active: boolean;
  representation_version: string;
  embedding_model: string;
  embedding_dimension: number;
  retrieval_threshold: number;
  content_hash: string;
  total_chunks: number;
  embedded_chunks: number;
  recomputed_content_hash: string;
}

export interface CandidateExport {
  exported_at: string;
  candidate_metadata: CandidateMetadata;
  chunks_count: number;
  chunks: CandidateChunk[];
}

export const EXPECTED_INDEX_ID = '118ef4f1-c0e9-496e-b369-91bb8882b61f';
export const EXPECTED_CONTENT_HASH = 'ddc007a1d0e066411a37f0f99895dae8a0524fad1a3a20dfa99db529187ef622';
export const EXPECTED_CHUNK_COUNT = 30;
export const EXPECTED_DIMENSION = 768;

/**
 * Loads and strictly validates the candidate dataset from the root export file.
 */
export function loadAndValidateCandidateCorpus(customPath?: string): CandidateExport {
  const filePath = customPath || path.resolve(process.cwd(), 'phase2g-candidate-118ef4f1-export.json');
  if (!fs.existsSync(filePath)) {
    throw new Error(`Candidate export file not found at: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const data: CandidateExport = JSON.parse(raw);

  const meta = data.candidate_metadata;
  if (!meta) throw new Error('Missing candidate_metadata in export file');
  if (meta.id !== EXPECTED_INDEX_ID) {
    throw new Error(`Index ID mismatch. Expected ${EXPECTED_INDEX_ID}, got ${meta.id}`);
  }
  if (meta.status !== 'READY') {
    throw new Error(`Status mismatch. Expected READY, got ${meta.status}`);
  }
  if (meta.is_active !== false) {
    throw new Error(`is_active mismatch. Expected false, got ${meta.is_active}`);
  }
  if (meta.content_hash !== EXPECTED_CONTENT_HASH) {
    throw new Error(`content_hash mismatch. Expected ${EXPECTED_CONTENT_HASH}, got ${meta.content_hash}`);
  }
  if (meta.recomputed_content_hash !== EXPECTED_CONTENT_HASH) {
    throw new Error(`recomputed_content_hash mismatch. Expected ${EXPECTED_CONTENT_HASH}, got ${meta.recomputed_content_hash}`);
  }
  if (data.chunks_count !== EXPECTED_CHUNK_COUNT || data.chunks.length !== EXPECTED_CHUNK_COUNT) {
    throw new Error(`Chunk count mismatch. Expected ${EXPECTED_CHUNK_COUNT}, got count=${data.chunks_count}, array=${data.chunks.length}`);
  }

  const seenIds = new Set<string>();
  for (let i = 0; i < EXPECTED_CHUNK_COUNT; i++) {
    const chunk = data.chunks[i];
    if (chunk.chunk_index !== i) {
      throw new Error(`Chunk index sequence mismatch at index ${i}: got ${chunk.chunk_index}`);
    }
    if (!chunk.id || seenIds.has(chunk.id)) {
      throw new Error(`Duplicate or invalid chunk ID at index ${i}: ${chunk.id}`);
    }
    seenIds.add(chunk.id);

    if (!chunk.chunk_title || typeof chunk.chunk_title !== 'string') {
      throw new Error(`Invalid title at chunk index ${i}`);
    }
    if (!chunk.chunk_text || typeof chunk.chunk_text !== 'string') {
      throw new Error(`Invalid text at chunk index ${i}`);
    }
    if (!Array.isArray(chunk.embedding) || chunk.embedding.length !== EXPECTED_DIMENSION) {
      throw new Error(`Invalid embedding vector at index ${i}: expected dimension ${EXPECTED_DIMENSION}`);
    }
    for (let d = 0; d < EXPECTED_DIMENSION; d++) {
      if (typeof chunk.embedding[d] !== 'number' || !Number.isFinite(chunk.embedding[d])) {
        throw new Error(`Non-finite vector value in chunk ${chunk.id} at dimension ${d}`);
      }
    }
  }

  return data;
}
