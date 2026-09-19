import path from 'path';
import {
  loadAndValidateCandidateCorpus,
  CandidateChunk,
  CandidateExport
} from './eval-candidate-phase2g.data';
import {
  PHASE2G_GROUND_TRUTH_MATRIX_V2,
  Phase2GTestCase
} from './eval-matrix-phase2g.data';
import {
  loadEmbeddingCache,
  CACHE_FILE_PATH
} from './eval-phase2g-runner';

export const EXPERIMENT_THRESHOLDS = [0.60, 0.62, 0.64, 0.65, 0.66, 0.67, 0.68, 0.70] as const;
export type ExperimentThreshold = typeof EXPERIMENT_THRESHOLDS[number];

export const THRESHOLD_JSON_RESULT_PATH = path.resolve(
  process.cwd(),
  'server/scripts/results/phase2g-threshold-sensitivity.json'
);
export const THRESHOLD_MD_RESULT_PATH = path.resolve(
  process.cwd(),
  'server/scripts/results/phase2g-threshold-sensitivity.md'
);

export interface ThresholdCaseResult {
  case_id: string;
  category: string;
  query: string;
  expected_chunk_ids: string[];
  must_abstain: boolean;
  threshold: number;
  returned_count: number;
  ranked_chunk_ids: string[];
  ranked_chunk_titles: string[];
  ranked_similarities: number[];
  top_similarity: number;
  recall_at_3: number;
  recall_at_5: number;
  precision_at_3: number;
  mrr: number;
  correct_abstention: boolean;
  false_abstention: boolean;
  false_retrieval: boolean;
  relevant_retrieved: boolean;
  relevant_similarities: number[];
  non_relevant_similarities: number[];
}

export interface ThresholdAggregateMetrics {
  threshold: number;
  total_cases: number;
  answerable_cases: number;
  abstention_cases: number;
  mean_recall_at_3: number;
  mean_recall_at_5: number;
  mean_precision_at_3: number;
  mean_mrr: number;
  correct_abstention_count: number;
  false_abstention_count: number;
  false_retrieval_count: number;
}

export interface ThresholdSafetyCaseReport {
  threshold: number;
  bq05_emergency: {
    retrieved: boolean;
    relevant_similarity: number;
    top_similarity: number;
    top_chunk_title: string;
    rank: number | null;
  };
  bq06_medical_safety: {
    retrieved: boolean;
    relevant_similarity: number;
    top_similarity: number;
    top_chunk_title: string;
    rank: number | null;
  };
  bq09_security: {
    retrieved: boolean;
    top_similarity: number;
    top_chunk_title: string;
    returned_count: number;
    false_retrieval: boolean;
    correct_abstention: boolean;
  };
  notes: string;
}

export interface ThresholdAbstentionReport {
  threshold: number;
  bq01_availability: { returned_count: number; top_similarity: number; abstained: boolean; false_retrieval: boolean };
  bq03_cancellation: { returned_count: number; top_similarity: number; abstained: boolean; false_retrieval: boolean };
  bq04_rescheduling: { returned_count: number; top_similarity: number; abstained: boolean; false_retrieval: boolean };
  bq07_mri_pet: { returned_count: number; top_similarity: number; abstained: boolean; false_retrieval: boolean };
  bq08_neurologist: { returned_count: number; top_similarity: number; abstained: boolean; false_retrieval: boolean };
  bq10_other_tenant: {
    returned_count: number;
    top_similarity: number;
    abstained: boolean;
    false_retrieval: boolean;
    top_chunk_title?: string;
    is_cross_tenant_leakage: boolean; // Explicit: semantic false retrieval on local corpus is NOT foreign-tenant leakage
  };
}

export interface ThresholdBookingReport {
  threshold: number;
  bq02_booking: {
    returned_count: number;
    top_similarity: number;
    false_retrieval: boolean;
    top_chunk_title?: string;
  };
}

export interface ThresholdTransition {
  from_threshold: number;
  to_threshold: number;
  newly_retrievable_cases: string[];
  new_false_retrievals: string[];
  contaminated_abstentions: string[];
  recovered_false_abstentions: string[];
}

export interface ThresholdSensitivityResult {
  evaluation_version: string;
  candidate_index_id: string;
  candidate_content_hash: string;
  candidate_status: string;
  candidate_is_active: boolean;
  evaluated_at: string;
  thresholds: number[];
  threshold_aggregates: Record<string, ThresholdAggregateMetrics>;
  safety_cases: Record<string, ThresholdSafetyCaseReport>;
  abstention_cases: Record<string, ThresholdAbstentionReport>;
  booking_cases: Record<string, ThresholdBookingReport>;
  transitions: ThresholdTransition[];
  case_details_by_threshold: Record<string, ThresholdCaseResult[]>;
  findings: {
    lowest_threshold_both_bq05_bq06: number | null;
    threshold_where_false_retrievals_worsen: number;
    problem_characterization: string;
    production_recommendation_assessment: string;
  };
  zero_api_call_audit: {
    api_calls_made: number;
    embeddings_generated: number;
    db_mutations: number;
    candidate_activated: boolean;
  };
}

export interface LoadedEvaluationData {
  candidateExport: CandidateExport;
  chunks: CandidateChunk[];
  chunkVectors: number[][];
  v2QueryVectors: Record<string, number[]>;
  matrix: Phase2GTestCase[];
}

/**
 * Loads pre-existing candidate embeddings and V2 query embeddings with ZERO API calls.
 */
export function loadOfflineEvaluationVectors(): LoadedEvaluationData {
  // 1. Load authoritative candidate corpus
  const candidateExport = loadAndValidateCandidateCorpus();
  const chunks = candidateExport.chunks;
  const chunkVectors = chunks.map(c => c.embedding);

  // Validate chunk vectors
  if (chunkVectors.length !== 30) {
    throw new Error(`Expected 30 chunk vectors, found ${chunkVectors.length}`);
  }
  for (let i = 0; i < chunkVectors.length; i++) {
    const vec = chunkVectors[i];
    if (!Array.isArray(vec) || vec.length !== 768) {
      throw new Error(`Candidate chunk ${i} embedding dimension invalid: ${vec?.length}`);
    }
    for (const val of vec) {
      if (typeof val !== 'number' || !Number.isFinite(val)) {
        throw new Error(`Candidate chunk ${i} contains non-finite float value`);
      }
    }
  }

  // 2. Load pre-cached V2 query vectors
  const cache = loadEmbeddingCache();
  const v2QueryVectors: Record<string, number[]> = {};

  for (const tc of PHASE2G_GROUND_TRUTH_MATRIX_V2) {
    const vec = cache.v2_query_embeddings?.[tc.id];
    if (!vec || !Array.isArray(vec) || vec.length !== 768) {
      throw new Error(`Missing or invalid cached V2 query embedding for case ${tc.id}`);
    }
    for (const val of vec) {
      if (typeof val !== 'number' || !Number.isFinite(val)) {
        throw new Error(`Query embedding for case ${tc.id} contains non-finite float value`);
      }
    }
    v2QueryVectors[tc.id] = vec;
  }

  return {
    candidateExport,
    chunks,
    chunkVectors,
    v2QueryVectors,
    matrix: PHASE2G_GROUND_TRUTH_MATRIX_V2
  };
}
