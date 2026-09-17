import { RagIndexStatus, ClinicRagIndex, ClinicRagChunk } from '../../../src/types';

export interface DocumentChunkMetadata {
  chunk_index: number;
  chunk_title: string;
  chunk_text: string;
  embedding_input: string;
  chunk_content_hash: string;
}

export interface DocumentChunkWithEmbedding extends DocumentChunkMetadata {
  embedding: number[];
}

export interface RagValidationCheck {
  check: string;
  passed: boolean;
  details?: string;
}

export interface RagValidationReport {
  timestamp: string;
  all_passed: boolean;
  checks: RagValidationCheck[];
  total_expected_chunks: number;
  total_validated_chunks: number;
  representation_version: string;
  embedding_model: string;
  embedding_dimension: number;
}

export interface IndexBuildResult {
  success: boolean;
  index_id?: string;
  clinic_id: string;
  release_id: string;
  status: RagIndexStatus;
  chunks_count: number;
  reused_existing?: boolean;
  duration_ms?: number;
  error?: string;
  validation_report?: RagValidationReport;
}

export interface EmbeddingOptions {
  model?: string;
  dimension?: number;
  maxRetries?: number;
  timeoutMs?: number;
  concurrency?: number;
  customEmbedder?: (text: string) => Promise<number[]>;
}
