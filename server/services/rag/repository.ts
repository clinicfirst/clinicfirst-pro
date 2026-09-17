import crypto from 'crypto';
import { supabase, isOfflineMode } from '../../supabaseDiff';
import { db } from '../../db';
import { ClinicRagIndex, ClinicRagChunk } from '../../../src/types';

export class RagRepository {
  /**
   * Find an existing RAG index by its unique logical identity.
   */
  static async findIndexByIdentity(params: {
    clinic_id: string;
    release_id: string;
    representation_version: string;
    embedding_model: string;
    embedding_dimension: number;
  }): Promise<ClinicRagIndex | null> {
    const { clinic_id, release_id, representation_version, embedding_model, embedding_dimension } = params;

    if (!supabase || isOfflineMode) {
      const list = ((db.data as any).clinic_rag_indices || []) as ClinicRagIndex[];
      const found = list.find(
        i =>
          i.clinic_id === clinic_id &&
          i.release_id === release_id &&
          i.representation_version === representation_version &&
          i.embedding_model === embedding_model &&
          i.embedding_dimension === embedding_dimension
      );
      return found || null;
    }

    const { data, error } = await supabase
      .from('clinic_rag_indices')
      .select('*')
      .eq('clinic_id', clinic_id)
      .eq('release_id', release_id)
      .eq('representation_version', representation_version)
      .eq('embedding_model', embedding_model)
      .eq('embedding_dimension', embedding_dimension)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('[RagRepository.findIndexByIdentity] Supabase error:', error);
      throw new Error(`Failed to query clinic_rag_indices: ${error.message}`);
    }

    return (data as ClinicRagIndex) || null;
  }

  /**
   * Find index by ID.
   */
  static async getIndexById(id: string): Promise<ClinicRagIndex | null> {
    if (!supabase || isOfflineMode) {
      const list = ((db.data as any).clinic_rag_indices || []) as ClinicRagIndex[];
      return list.find(i => i.id === id) || null;
    }

    const { data, error } = await supabase
      .from('clinic_rag_indices')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get index by ID: ${error.message}`);
    }
    return (data as ClinicRagIndex) || null;
  }

  /**
   * Create a new candidate RAG index record.
   */
  static async createIndex(index: Omit<ClinicRagIndex, 'id' | 'created_at' | 'is_active'> & { id?: string; is_active?: boolean }): Promise<ClinicRagIndex> {
    const newRecord: ClinicRagIndex = {
      id: index.id || crypto.randomUUID(),
      clinic_id: index.clinic_id,
      release_id: index.release_id,
      representation_version: index.representation_version,
      embedding_model: index.embedding_model,
      embedding_dimension: index.embedding_dimension,
      retrieval_threshold: index.retrieval_threshold || 0.70,
      content_hash: index.content_hash,
      status: index.status,
      is_active: false, // Invariant: candidate indexes are never active in Phase 2C
      total_chunks: index.total_chunks || 0,
      embedded_chunks: index.embedded_chunks || 0,
      created_at: new Date().toISOString()
    };

    if (!supabase || isOfflineMode) {
      if (!(db.data as any).clinic_rag_indices) {
        (db.data as any).clinic_rag_indices = [];
      }
      const existing = ((db.data as any).clinic_rag_indices as ClinicRagIndex[]).find(
        i =>
          i.clinic_id === newRecord.clinic_id &&
          i.release_id === newRecord.release_id &&
          i.representation_version === newRecord.representation_version &&
          i.embedding_model === newRecord.embedding_model &&
          i.embedding_dimension === newRecord.embedding_dimension
      );
      if (existing) {
        // Multi-instance simulated race: return existing winner
        console.warn(`[RagRepository.createIndex] Conflict detected on identity in offline store. Reusing index ${existing.id}`);
        return existing;
      }
      (db.data as any).clinic_rag_indices.push(newRecord);
      db.flush();
      return newRecord;
    }

    const { data, error } = await supabase
      .from('clinic_rag_indices')
      .insert(newRecord)
      .select()
      .single();

    if (error) {
      // 23505 is PostgreSQL unique_violation error code
      if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('uq_clinic_rag_indices_identity')) {
        console.warn(`[RagRepository.createIndex] Race condition detected: concurrent instance created index for ${index.clinic_id}:${index.release_id}. Fetching winning record.`);
        const existing = await this.findIndexByIdentity({
          clinic_id: index.clinic_id,
          release_id: index.release_id,
          representation_version: index.representation_version,
          embedding_model: index.embedding_model,
          embedding_dimension: index.embedding_dimension
        });
        if (existing) {
          return existing;
        }
      }
      console.error('[RagRepository.createIndex] Supabase error:', error);
      throw new Error(`Failed to insert clinic_rag_indices record: ${error.message}`);
    }

    return data as ClinicRagIndex;
  }

  /**
   * Update an existing RAG index status, counts, and validation report.
   */
  static async updateIndex(id: string, updates: Partial<ClinicRagIndex>): Promise<ClinicRagIndex> {
    if (!supabase || isOfflineMode) {
      const list = ((db.data as any).clinic_rag_indices || []) as ClinicRagIndex[];
      const idx = list.findIndex(i => i.id === id);
      if (idx === -1) {
        throw new Error(`Index with ID ${id} not found in offline db`);
      }
      list[idx] = { ...list[idx], ...updates };
      db.flush();
      return list[idx];
    }

    const { data, error } = await supabase
      .from('clinic_rag_indices')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[RagRepository.updateIndex] Supabase error:', error);
      throw new Error(`Failed to update clinic_rag_indices: ${error.message}`);
    }

    return data as ClinicRagIndex;
  }

  /**
   * Delete all chunks for a given index ID (used when retrying / rebuilding a failed or building index).
   */
  static async deleteChunksByIndexId(indexId: string): Promise<void> {
    if (!supabase || isOfflineMode) {
      if ((db.data as any).clinic_rag_chunks) {
        (db.data as any).clinic_rag_chunks = (
          (db.data as any).clinic_rag_chunks as ClinicRagChunk[]
        ).filter(c => c.index_id !== indexId);
        db.flush();
      }
      return;
    }

    const { error } = await supabase
      .from('clinic_rag_chunks')
      .delete()
      .eq('index_id', indexId);

    if (error) {
      console.error('[RagRepository.deleteChunksByIndexId] Supabase error:', error);
      throw new Error(`Failed to delete chunks for index ${indexId}: ${error.message}`);
    }
  }

  /**
   * Insert chunks in bounded batches into clinic_rag_chunks.
   */
  static async insertChunksBatch(
    chunks: Array<Omit<ClinicRagChunk, 'id' | 'created_at'> & { id?: string }>,
    batchSize: number = 50
  ): Promise<void> {
    if (chunks.length === 0) return;

    if (!supabase || isOfflineMode) {
      if (!(db.data as any).clinic_rag_chunks) {
        (db.data as any).clinic_rag_chunks = [];
      }
      for (const c of chunks) {
        (db.data as any).clinic_rag_chunks.push({
          ...c,
          id: c.id || crypto.randomUUID(),
          created_at: new Date().toISOString()
        });
      }
      db.flush();
      return;
    }

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize).map(c => ({
        ...c,
        id: c.id || crypto.randomUUID(),
        created_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('clinic_rag_chunks')
        .insert(batch);

      if (error) {
        console.error('[RagRepository.insertChunksBatch] Supabase error:', error);
        throw new Error(`Failed to insert batch into clinic_rag_chunks: ${error.message}`);
      }
    }
  }

  /**
   * Normalizes a pgvector representation from the database boundary into a strict JavaScript number[].
   * PostgREST / Supabase returns PostgreSQL VECTOR columns as text formatted as "[0.0123, -0.456, ...]".
   * This helper parses vector strings and verifies that every element is a finite number.
   * Throws if the representation is malformed, contains non-finite numbers, or is empty.
   */
  static normalizePgVector(value: unknown): number[] {
    if (value === null || value === undefined) {
      throw new Error('Vector normalization failed: value is null or undefined');
    }

    // If already an array, validate elements are finite numbers
    if (Array.isArray(value)) {
      if (value.length === 0) {
        throw new Error('Vector normalization failed: array is empty');
      }
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (typeof item !== 'number' || isNaN(item) || !Number.isFinite(item)) {
          throw new Error(`Vector normalization failed: element at index ${i} is not a finite number (value: ${item})`);
        }
      }
      return value as number[];
    }

    // If string, parse pgvector format: "[0.123, -0.456, ...]"
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
        throw new Error(`Vector normalization failed: malformed vector string, expected bracketed syntax '[...]', got: ${trimmed.slice(0, 30)}...`);
      }

      const inner = trimmed.slice(1, -1).trim();
      if (inner.length === 0) {
        throw new Error('Vector normalization failed: vector string contains no elements');
      }

      const parts = inner.split(',');
      const result: number[] = new Array(parts.length);

      for (let i = 0; i < parts.length; i++) {
        const rawPart = parts[i].trim();
        if (rawPart.length === 0) {
          throw new Error(`Vector normalization failed: empty element at index ${i}`);
        }
        const num = Number(rawPart);
        if (isNaN(num) || !Number.isFinite(num)) {
          throw new Error(`Vector normalization failed: element at index ${i} ('${rawPart}') is not a finite number`);
        }
        result[i] = num;
      }

      return result;
    }

    throw new Error(`Vector normalization failed: expected string or number[], got ${typeof value}`);
  }

  /**
   * Fetch all chunks for a given index ID (used for validation).
   * Ensures the embedding vector is normalized to a valid number[] before returning.
   */
  static async getChunksByIndexId(indexId: string): Promise<ClinicRagChunk[]> {
    if (!supabase || isOfflineMode) {
      const list = ((db.data as any).clinic_rag_chunks || []) as ClinicRagChunk[];
      return list
        .filter(c => c.index_id === indexId)
        .sort((a, b) => a.chunk_index - b.chunk_index)
        .map(c => ({
          ...c,
          embedding: this.normalizePgVector(c.embedding)
        }));
    }

    const { data, error } = await supabase
      .from('clinic_rag_chunks')
      .select('*')
      .eq('index_id', indexId)
      .order('chunk_index', { ascending: true });

    if (error) {
      console.error('[RagRepository.getChunksByIndexId] Supabase error:', error);
      throw new Error(`Failed to fetch chunks for index ${indexId}: ${error.message}`);
    }

    if (!data || !Array.isArray(data)) {
      return [];
    }

    return data.map((row: any) => ({
      ...row,
      embedding: this.normalizePgVector(row.embedding)
    })) as ClinicRagChunk[];
  }
}
