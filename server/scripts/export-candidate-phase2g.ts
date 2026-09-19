import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables (.env, .env.local, etc.)
dotenv.config();

/**
 * PHASE 2G - READ-ONLY EXPORT & PREFLIGHT VALIDATION SCRIPT
 *
 * Target: Candidate index 118ef4f1-c0e9-496e-b369-91bb8882b61f
 * Required Environment: SUPABASE_SERVICE_ROLE_KEY & (VITE_SUPABASE_URL or SUPABASE_URL)
 *
 * INVARIANTS:
 * - Strictly READ-ONLY (SELECT only). Zero INSERT, UPDATE, DELETE, or RPC mutations.
 * - Validates candidate metadata, chunk counts, indices, vector dimensions, and content hash.
 * - Recomputes index content hash from authoritative release content and verifies against expected hash.
 * - NEVER prints or logs secrets, service role keys, or credentials.
 */

const TARGET_INDEX_ID = '118ef4f1-c0e9-496e-b369-91bb8882b61f';
const EXPECTED_CONTENT_HASH = 'ddc007a1d0e066411a37f0f99895dae8a0524fad1a3a20dfa99db529187ef622';
const EXPECTED_CHUNK_COUNT = 30;
const EXPECTED_EMBEDDING_DIMENSION = 768;
const DEFAULT_OUTPUT_PATH = path.resolve(process.cwd(), 'phase2g-candidate-118ef4f1-export.json');

/**
 * Normalizes PostgreSQL vector representation into a finite number[].
 */
function normalizePgVector(value: unknown): number[] {
  if (value === null || value === undefined) {
    throw new Error('Vector normalization failed: value is null or undefined');
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      throw new Error('Vector normalization failed: array is empty');
    }
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      if (typeof item !== 'number' || isNaN(item) || !Number.isFinite(item)) {
        throw new Error(`Vector normalization failed: element at index ${i} is not a finite number`);
      }
    }
    return value as number[];
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
      throw new Error(`Vector normalization failed: malformed vector string syntax`);
    }

    const inner = trimmed.slice(1, -1).trim();
    if (inner.length === 0) {
      throw new Error('Vector normalization failed: empty vector string');
    }

    const parts = inner.split(',');
    const result: number[] = new Array(parts.length);

    for (let i = 0; i < parts.length; i++) {
      const raw = parts[i].trim();
      const num = Number(raw);
      if (isNaN(num) || !Number.isFinite(num)) {
        throw new Error(`Vector normalization failed: element at index ${i} is not a finite number`);
      }
      result[i] = num;
    }

    return result;
  }

  throw new Error(`Vector normalization failed: expected string or number[], received ${typeof value}`);
}

/**
 * Authoritative production index content hash calculation matching RagChunkingService.computeIndexContentHash.
 */
function computeIndexContentHash(
  compiledContent: string,
  representationVersion: string,
  embeddingModel: string,
  embeddingDimension: number
): string {
  const payload = [
    compiledContent,
    representationVersion,
    embeddingModel,
    embeddingDimension.toString()
  ].join('\n');

  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

async function runExport() {
  console.log('============================================================');
  console.log('PHASE 2G CANDIDATE EXPORT & PREFLIGHT VALIDATION');
  console.log('============================================================');
  console.log(`Target Index ID: ${TARGET_INDEX_ID}`);
  console.log(`Expected Content Hash: ${EXPECTED_CONTENT_HASH}`);
  console.log(`Expected Chunk Count: ${EXPECTED_CHUNK_COUNT}`);
  console.log(`Target Output File: ${DEFAULT_OUTPUT_PATH}`);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    console.error('\n[FATAL] Missing SUPABASE_URL or VITE_SUPABASE_URL environment variable.');
    process.exit(1);
  }

  if (!serviceRoleKey) {
    console.error('\n[FATAL] Missing SUPABASE_SERVICE_ROLE_KEY environment variable.');
    console.error('This script must be executed in an environment where SUPABASE_SERVICE_ROLE_KEY is configured.');
    process.exit(1);
  }

  console.log('\n[1/6] Initializing read-only Supabase admin client...');
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  console.log('[2/6] Fetching candidate metadata from clinic_rag_indices (READ-ONLY)...');
  const { data: indexRecord, error: indexError } = await client
    .from('clinic_rag_indices')
    .select('*')
    .eq('id', TARGET_INDEX_ID)
    .maybeSingle();

  if (indexError) {
    console.error(`\n[VALIDATION FAILED] Error querying clinic_rag_indices: ${indexError.message}`);
    process.exit(1);
  }

  if (!indexRecord) {
    console.error(`\n[VALIDATION FAILED] Candidate index ${TARGET_INDEX_ID} does not exist.`);
    process.exit(1);
  }

  console.log('Candidate index record found:');
  console.log(`  - status: ${indexRecord.status}`);
  console.log(`  - is_active: ${indexRecord.is_active}`);
  console.log(`  - release_id: ${indexRecord.release_id}`);
  console.log(`  - clinic_id: ${indexRecord.clinic_id}`);
  console.log(`  - representation_version: ${indexRecord.representation_version}`);
  console.log(`  - embedding_model: ${indexRecord.embedding_model}`);
  console.log(`  - embedding_dimension: ${indexRecord.embedding_dimension}`);
  console.log(`  - total_chunks: ${indexRecord.total_chunks}`);
  console.log(`  - embedded_chunks: ${indexRecord.embedded_chunks}`);
  console.log(`  - content_hash: ${indexRecord.content_hash}`);

  // Validation 1: Candidate status must be READY
  if (indexRecord.status !== 'READY') {
    console.error(`\n[VALIDATION FAILED] Expected status === 'READY', got '${indexRecord.status}'`);
    process.exit(1);
  }

  // Validation 2: Candidate must be inactive
  if (indexRecord.is_active !== false) {
    console.error(`\n[VALIDATION FAILED] Expected is_active === false, got ${indexRecord.is_active}`);
    process.exit(1);
  }

  // Validation 3: Total chunks must equal 30
  if (indexRecord.total_chunks !== EXPECTED_CHUNK_COUNT) {
    console.error(`\n[VALIDATION FAILED] Expected total_chunks === ${EXPECTED_CHUNK_COUNT}, got ${indexRecord.total_chunks}`);
    process.exit(1);
  }

  // Validation 4: Embedded chunks must equal 30
  if (indexRecord.embedded_chunks !== EXPECTED_CHUNK_COUNT) {
    console.error(`\n[VALIDATION FAILED] Expected embedded_chunks === ${EXPECTED_CHUNK_COUNT}, got ${indexRecord.embedded_chunks}`);
    process.exit(1);
  }

  // Validation 5: Stored content hash must match expected hash
  if (indexRecord.content_hash !== EXPECTED_CONTENT_HASH) {
    console.error(`\n[VALIDATION FAILED] Stored content_hash does not match expected hash.`);
    console.error(`  Expected: ${EXPECTED_CONTENT_HASH}`);
    console.error(`  Actual:   ${indexRecord.content_hash}`);
    process.exit(1);
  }

  console.log('\n[3/6] Fetching associated release from clinic_knowledge_releases to verify content hash...');
  const { data: releaseRecord, error: releaseError } = await client
    .from('clinic_knowledge_releases')
    .select('id, clinic_id, status, compiled_content')
    .eq('id', indexRecord.release_id)
    .maybeSingle();

  if (releaseError) {
    console.error(`\n[VALIDATION FAILED] Error querying clinic_knowledge_releases: ${releaseError.message}`);
    process.exit(1);
  }

  if (!releaseRecord || !releaseRecord.compiled_content) {
    console.error(`\n[VALIDATION FAILED] Release ${indexRecord.release_id} not found or missing compiled_content.`);
    process.exit(1);
  }

  // Validation 6: Recompute authoritative content hash
  const recomputedHash = computeIndexContentHash(
    releaseRecord.compiled_content,
    indexRecord.representation_version,
    indexRecord.embedding_model,
    Number(indexRecord.embedding_dimension)
  );

  console.log(`Authoritative Recomputed Hash: ${recomputedHash}`);
  if (recomputedHash !== EXPECTED_CONTENT_HASH) {
    console.error(`\n[VALIDATION FAILED] Recomputed index content hash does not match expected hash.`);
    console.error(`  Expected:   ${EXPECTED_CONTENT_HASH}`);
    console.error(`  Recomputed: ${recomputedHash}`);
    process.exit(1);
  }

  console.log('\n[4/6] Fetching candidate chunks from clinic_rag_chunks (READ-ONLY)...');
  const { data: rawChunks, error: chunksError } = await client
    .from('clinic_rag_chunks')
    .select('id, index_id, clinic_id, chunk_index, chunk_title, chunk_text, embedding')
    .eq('index_id', TARGET_INDEX_ID)
    .order('chunk_index', { ascending: true });

  if (chunksError) {
    console.error(`\n[VALIDATION FAILED] Error querying clinic_rag_chunks: ${chunksError.message}`);
    process.exit(1);
  }

  if (!rawChunks || rawChunks.length === 0) {
    console.error(`\n[VALIDATION FAILED] No chunks found for index_id ${TARGET_INDEX_ID}.`);
    process.exit(1);
  }

  // Validation 7: Exactly 30 chunk rows
  console.log(`Retrieved ${rawChunks.length} chunk rows.`);
  if (rawChunks.length !== EXPECTED_CHUNK_COUNT) {
    console.error(`\n[VALIDATION FAILED] Expected ${EXPECTED_CHUNK_COUNT} chunks, received ${rawChunks.length}`);
    process.exit(1);
  }

  console.log('\n[5/6] Validating chunk integrity and vector dimensions...');
  const seenIds = new Set<string>();
  const seenIndices = new Set<number>();
  const validatedChunks: Array<{
    id: string;
    index_id: string;
    clinic_id: string;
    chunk_index: number;
    chunk_title: string;
    chunk_text: string;
    embedding: number[];
  }> = [];

  for (let i = 0; i < rawChunks.length; i++) {
    const chunk = rawChunks[i];

    // Validation 8: Unique UUIDs
    if (seenIds.has(chunk.id)) {
      console.error(`\n[VALIDATION FAILED] Duplicate chunk UUID encountered: ${chunk.id}`);
      process.exit(1);
    }
    seenIds.add(chunk.id);

    // Validation 9: chunk_index exactly 0 through 29
    if (typeof chunk.chunk_index !== 'number' || chunk.chunk_index !== i) {
      console.error(`\n[VALIDATION FAILED] Expected chunk at position ${i} to have chunk_index ${i}, got ${chunk.chunk_index}`);
      process.exit(1);
    }
    seenIndices.add(chunk.chunk_index);

    // Validation 10: chunk_title and chunk_text present and non-empty
    if (!chunk.chunk_title || typeof chunk.chunk_title !== 'string') {
      console.error(`\n[VALIDATION FAILED] Chunk at index ${i} has invalid chunk_title.`);
      process.exit(1);
    }
    if (!chunk.chunk_text || typeof chunk.chunk_text !== 'string') {
      console.error(`\n[VALIDATION FAILED] Chunk at index ${i} has invalid chunk_text.`);
      process.exit(1);
    }

    // Validation 11: vector normalization and dimension = 768
    let normalizedEmbedding: number[];
    try {
      normalizedEmbedding = normalizePgVector(chunk.embedding);
    } catch (err: any) {
      console.error(`\n[VALIDATION FAILED] Chunk ${chunk.id} (index ${i}) has invalid vector: ${err.message}`);
      process.exit(1);
    }

    if (normalizedEmbedding.length !== EXPECTED_EMBEDDING_DIMENSION) {
      console.error(`\n[VALIDATION FAILED] Chunk ${chunk.id} (index ${i}) has dimension ${normalizedEmbedding.length}, expected ${EXPECTED_EMBEDDING_DIMENSION}`);
      process.exit(1);
    }

    validatedChunks.push({
      id: chunk.id,
      index_id: chunk.index_id,
      clinic_id: chunk.clinic_id,
      chunk_index: chunk.chunk_index,
      chunk_title: chunk.chunk_title,
      chunk_text: chunk.chunk_text,
      embedding: normalizedEmbedding
    });
  }

  // Validation 12: Sequence completeness
  for (let idx = 0; idx < EXPECTED_CHUNK_COUNT; idx++) {
    if (!seenIndices.has(idx)) {
      console.error(`\n[VALIDATION FAILED] Missing chunk_index ${idx} in sequence 0..${EXPECTED_CHUNK_COUNT - 1}`);
      process.exit(1);
    }
  }

  console.log('All 30 chunks and vector dimensions successfully validated.');

  console.log('\n[6/6] Writing verified export artifact...');
  const exportPayload = {
    exported_at: new Date().toISOString(),
    candidate_metadata: {
      id: indexRecord.id,
      clinic_id: indexRecord.clinic_id,
      release_id: indexRecord.release_id,
      status: indexRecord.status,
      is_active: indexRecord.is_active,
      representation_version: indexRecord.representation_version,
      embedding_model: indexRecord.embedding_model,
      embedding_dimension: Number(indexRecord.embedding_dimension),
      retrieval_threshold: Number(indexRecord.retrieval_threshold),
      content_hash: indexRecord.content_hash,
      total_chunks: Number(indexRecord.total_chunks),
      embedded_chunks: Number(indexRecord.embedded_chunks),
      recomputed_content_hash: recomputedHash
    },
    chunks_count: validatedChunks.length,
    chunks: validatedChunks
  };

  fs.writeFileSync(DEFAULT_OUTPUT_PATH, JSON.stringify(exportPayload, null, 2), 'utf8');
  console.log(`\nEXPORT COMPLETED SUCCESSFULLY.`);
  console.log(`Saved to: ${DEFAULT_OUTPUT_PATH}`);
  console.log(`Total Chunks Exported: ${validatedChunks.length}`);
  console.log(`Content Hash Verified: ${recomputedHash}`);
}

runExport().catch((err: any) => {
  console.error('\n[UNHANDLED ERROR]', err.message);
  process.exit(1);
});
