import { describe, it, expect } from 'vitest';
import {
  cosineSimilarity,
  rankChunksDeterministic,
  evaluateCaseRanking,
  calculateSeparationMetrics,
  RankedItem
} from '../scripts/eval-phase2g-runner';
import {
  loadAndValidateCandidateCorpus,
  EXPECTED_INDEX_ID,
  EXPECTED_CONTENT_HASH,
  EXPECTED_CHUNK_COUNT,
  EXPECTED_DIMENSION
} from '../scripts/eval-candidate-phase2g.data';
import {
  PHASE2G_GROUND_TRUTH_MATRIX_V2
} from '../scripts/eval-matrix-phase2g.data';

describe('Phase 2G Evaluator Unit Tests', () => {
  describe('Mathematical Cosine Similarity', () => {
    it('computes exact identity for identical vectors', () => {
      const vec = [1, 2, 3, 4];
      const sim = cosineSimilarity(vec, vec);
      expect(sim).toBeCloseTo(1.0, 6);
    });

    it('computes exact zero for orthogonal vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 6);
    });

    it('computes exact -1.0 for opposite vectors', () => {
      const a = [1, 2];
      const b = [-1, -2];
      expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 6);
    });

    it('handles zero norms gracefully without NaN', () => {
      const a = [0, 0, 0];
      const b = [1, 2, 3];
      expect(cosineSimilarity(a, b)).toBe(0);
    });

    it('throws on mismatched vector dimensions', () => {
      const a = [1, 2];
      const b = [1, 2, 3];
      expect(() => cosineSimilarity(a, b)).toThrow(/Vector dimension mismatch/);
    });
  });

  describe('Deterministic Tie-Breaking & Filtering', () => {
    const dummyChunks = [
      { id: 'c0', index_id: 'idx', clinic_id: 'cid', chunk_index: 0, chunk_title: 'T0', chunk_text: 'Text 0', embedding: [1, 0] },
      { id: 'c1', index_id: 'idx', clinic_id: 'cid', chunk_index: 1, chunk_title: 'T1', chunk_text: 'Text 1', embedding: [1, 0] },
      { id: 'c2', index_id: 'idx', clinic_id: 'cid', chunk_index: 2, chunk_title: 'T2', chunk_text: 'Text 2', embedding: [0, 1] },
      { id: 'c3', index_id: 'idx', clinic_id: 'cid', chunk_index: 3, chunk_title: 'T3', chunk_text: 'Text 3', embedding: [-1, 0] }
    ];
    const chunkVectors = dummyChunks.map(c => c.embedding);

    it('filters chunks below threshold', () => {
      const query = [1, 0];
      // sim: c0=1.0, c1=1.0, c2=0.0, c3=-1.0
      const ranked = rankChunksDeterministic(query, dummyChunks, chunkVectors, 0.5, 5);
      expect(ranked.length).toBe(2);
      expect(ranked.map(r => r.chunk_id)).toEqual(['c0', 'c1']);
    });

    it('breaks ties using ascending chunk_index', () => {
      const query = [1, 0];
      const ranked = rankChunksDeterministic(query, dummyChunks, chunkVectors, 0.5, 5);
      expect(ranked[0].chunk_index).toBe(0);
      expect(ranked[1].chunk_index).toBe(1);
    });

    it('respects top-k cap', () => {
      const query = [1, 0];
      const ranked = rankChunksDeterministic(query, dummyChunks, chunkVectors, 0.5, 1);
      expect(ranked.length).toBe(1);
      expect(ranked[0].chunk_id).toBe('c0');
    });
  });

  describe('Metric Calculations: Recall, Precision, MRR, Abstention', () => {
    it('evaluates clean positive retrieval hit', () => {
      const ranked: RankedItem[] = [
        { chunk_id: 'target-1', chunk_index: 0, chunk_title: 'Title', similarity: 0.85 },
        { chunk_id: 'other-2', chunk_index: 1, chunk_title: 'Title 2', similarity: 0.72 }
      ];
      const allScored = [
        { chunk_id: 'target-1', similarity: 0.85 },
        { chunk_id: 'other-2', similarity: 0.72 },
        { chunk_id: 'other-3', similarity: 0.40 }
      ];

      const res = evaluateCaseRanking(ranked, allScored, ['target-1'], false);
      expect(res.recall_at_3).toBe(1.0);
      expect(res.recall_at_5).toBe(1.0);
      expect(res.precision_at_3).toBeCloseTo(1 / 2, 4);
      expect(res.mrr).toBe(1.0);
      expect(res.false_abstention).toBe(false);
      expect(res.false_retrieval).toBe(false);
      expect(res.correct_abstention).toBe(false);
    });

    it('evaluates MRR correctly when relevant item is ranked second', () => {
      const ranked: RankedItem[] = [
        { chunk_id: 'noise', chunk_index: 0, chunk_title: 'N', similarity: 0.90 },
        { chunk_id: 'target', chunk_index: 1, chunk_title: 'T', similarity: 0.80 }
      ];
      const allScored = ranked;
      const res = evaluateCaseRanking(ranked, allScored, ['target'], false);
      expect(res.mrr).toBe(0.5);
      expect(res.recall_at_3).toBe(1.0);
      expect(res.precision_at_3).toBe(0.5);
    });

    it('evaluates correct abstention when expected_chunk_ids is empty and 0 results returned', () => {
      const ranked: RankedItem[] = [];
      const allScored = [
        { chunk_id: 'noise-1', similarity: 0.50 },
        { chunk_id: 'noise-2', similarity: 0.45 }
      ];
      const res = evaluateCaseRanking(ranked, allScored, [], true);
      expect(res.correct_abstention).toBe(true);
      expect(res.false_retrieval).toBe(false);
      expect(res.recall_at_5).toBe(1.0);
      expect(res.precision_at_3).toBe(1.0);
      expect(res.mrr).toBe(1.0);
    });

    it('evaluates false retrieval when expected_chunk_ids is empty but results exceed threshold', () => {
      const ranked: RankedItem[] = [
        { chunk_id: 'noise-1', chunk_index: 0, chunk_title: 'N', similarity: 0.75 }
      ];
      const allScored = ranked;
      const res = evaluateCaseRanking(ranked, allScored, [], true);
      expect(res.correct_abstention).toBe(false);
      expect(res.false_retrieval).toBe(true);
      expect(res.recall_at_5).toBe(0.0);
      expect(res.precision_at_3).toBe(0.0);
      expect(res.mrr).toBe(0.0);
    });

    it('evaluates false abstention when target is not in top-k', () => {
      const ranked: RankedItem[] = []; // target below threshold
      const allScored = [{ chunk_id: 'target', similarity: 0.55 }];
      const res = evaluateCaseRanking(ranked, allScored, ['target'], false);
      expect(res.false_abstention).toBe(true);
      expect(res.recall_at_5).toBe(0.0);
      expect(res.mrr).toBe(0.0);
    });
  });

  describe('Authoritative Candidate Export Integrity', () => {
    it('loads and verifies the candidate export file', () => {
      const data = loadAndValidateCandidateCorpus();
      expect(data.candidate_metadata.id).toBe(EXPECTED_INDEX_ID);
      expect(data.candidate_metadata.status).toBe('READY');
      expect(data.candidate_metadata.is_active).toBe(false);
      expect(data.candidate_metadata.content_hash).toBe(EXPECTED_CONTENT_HASH);
      expect(data.candidate_metadata.recomputed_content_hash).toBe(EXPECTED_CONTENT_HASH);
      expect(data.chunks_count).toBe(EXPECTED_CHUNK_COUNT);
      expect(data.chunks.length).toBe(EXPECTED_CHUNK_COUNT);

      for (let i = 0; i < EXPECTED_CHUNK_COUNT; i++) {
        expect(data.chunks[i].chunk_index).toBe(i);
        expect(data.chunks[i].embedding.length).toBe(EXPECTED_DIMENSION);
      }
    });
  });

  describe('Ground-Truth Matrix v2 Invariants', () => {
    it('verifies matrix composition and case counts', () => {
      expect(PHASE2G_GROUND_TRUTH_MATRIX_V2.length).toBe(30);

      const rqCases = PHASE2G_GROUND_TRUTH_MATRIX_V2.filter(c => c.id.startsWith('RQ-'));
      const bqCases = PHASE2G_GROUND_TRUTH_MATRIX_V2.filter(c => c.id.startsWith('BQ-'));

      expect(rqCases.length).toBe(20);
      expect(bqCases.length).toBe(10);

      // Verify all expected chunk IDs exist in the candidate corpus
      const candidateData = loadAndValidateCandidateCorpus();
      const validChunkIds = new Set(candidateData.chunks.map(c => c.id));

      for (const tc of PHASE2G_GROUND_TRUTH_MATRIX_V2) {
        expect(tc.id).toBeTruthy();
        expect(tc.query).toBeTruthy();
        for (const cid of tc.expected_chunk_ids) {
          expect(validChunkIds.has(cid)).toBe(true);
        }
      }
    });
  });
});
