-- Migration: 20260917000000_rag_v2_indices.sql
-- Description: Phase 2B - Controlled RAG Migration: Schema Preparation
-- Creates dedicated RAG Index Registry (clinic_rag_indices) and Scoped Vector Store (clinic_rag_chunks),
-- along with match_clinic_knowledge_v2, activate_rag_index, and rollback_rag_index.
-- This migration is strictly additive and non-destructive. Legacy tables and RPCs remain untouched.

-- ==============================================================================
-- 1. EXTENSIONS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ==============================================================================
-- 2. CREATE TABLE: clinic_rag_indices (Dedicated Index Registry)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS clinic_rag_indices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  release_id TEXT NOT NULL REFERENCES clinic_knowledge_releases(id) ON DELETE RESTRICT,
  representation_version TEXT NOT NULL,
  embedding_model TEXT NOT NULL,
  embedding_dimension INTEGER NOT NULL,
  retrieval_threshold FLOAT NOT NULL DEFAULT 0.70,
  content_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('BUILDING', 'VALIDATING', 'READY', 'ACTIVE', 'SUPERSEDED', 'ROLLBACK', 'FAILED')),
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  total_chunks INTEGER NOT NULL DEFAULT 0,
  embedded_chunks INTEGER NOT NULL DEFAULT 0,
  validation_report JSONB DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validated_at TIMESTAMPTZ DEFAULT NULL,
  activated_at TIMESTAMPTZ DEFAULT NULL,
  rolled_back_at TIMESTAMPTZ DEFAULT NULL,
  CONSTRAINT uq_clinic_rag_indices_identity UNIQUE (clinic_id, release_id, representation_version, embedding_model, embedding_dimension),
  CONSTRAINT uq_clinic_rag_indices_id_clinic UNIQUE (id, clinic_id)
);

-- Active Index Invariant: Exactly one active RAG index per clinic
CREATE UNIQUE INDEX IF NOT EXISTS uq_clinic_rag_indices_active 
ON clinic_rag_indices(clinic_id) 
WHERE is_active = TRUE;

-- Registry query optimization index
CREATE INDEX IF NOT EXISTS idx_clinic_rag_indices_lookup 
ON clinic_rag_indices(clinic_id, release_id, status);

-- ==============================================================================
-- 3. IMMUTABILITY TRIGGER FOR clinic_rag_indices
-- ==============================================================================
CREATE OR REPLACE FUNCTION protect_rag_index_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.clinic_id <> OLD.clinic_id THEN
    RAISE EXCEPTION 'clinic_id is immutable';
  END IF;
  IF NEW.release_id <> OLD.release_id THEN
    RAISE EXCEPTION 'release_id is immutable';
  END IF;
  IF NEW.representation_version <> OLD.representation_version THEN
    RAISE EXCEPTION 'representation_version is immutable';
  END IF;
  IF NEW.embedding_model <> OLD.embedding_model THEN
    RAISE EXCEPTION 'embedding_model is immutable';
  END IF;
  IF NEW.embedding_dimension <> OLD.embedding_dimension THEN
    RAISE EXCEPTION 'embedding_dimension is immutable';
  END IF;
  IF NEW.content_hash <> OLD.content_hash THEN
    RAISE EXCEPTION 'content_hash is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_protect_rag_index_immutability ON clinic_rag_indices;
CREATE TRIGGER trigger_protect_rag_index_immutability
BEFORE UPDATE ON clinic_rag_indices
FOR EACH ROW
EXECUTE FUNCTION protect_rag_index_immutability();

-- ==============================================================================
-- 4. CREATE TABLE: clinic_rag_chunks (Scoped Vector Store)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS clinic_rag_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  index_id UUID NOT NULL,
  clinic_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_title TEXT NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding_input TEXT NOT NULL,
  chunk_content_hash TEXT NOT NULL,
  embedding VECTOR(768) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_clinic_rag_chunks_index FOREIGN KEY (index_id, clinic_id) REFERENCES clinic_rag_indices(id, clinic_id) ON DELETE CASCADE,
  CONSTRAINT fk_clinic_rag_chunks_clinic FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
  CONSTRAINT uq_clinic_rag_chunks_index_chunk UNIQUE (index_id, chunk_index)
);

-- Chunk query optimization index
CREATE INDEX IF NOT EXISTS idx_clinic_rag_chunks_lookup 
ON clinic_rag_chunks(index_id, clinic_id);

-- Note: No ANN/HNSW/IVFFlat index in Phase 2B. Exact KNN cosine search is retained.

-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE clinic_rag_indices ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_rag_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read rag indices for their clinic" ON clinic_rag_indices;
CREATE POLICY "Users can read rag indices for their clinic"
ON clinic_rag_indices
FOR SELECT
USING (
  clinic_id IN (
    SELECT clinic_id FROM users WHERE users.id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can read rag chunks for their clinic" ON clinic_rag_chunks;
CREATE POLICY "Users can read rag chunks for their clinic"
ON clinic_rag_chunks
FOR SELECT
USING (
  clinic_id IN (
    SELECT clinic_id FROM users WHERE users.id = auth.uid()
  )
);

-- All mutations (INSERT/UPDATE/DELETE) have no public policy, so only backend service_role can mutate.

-- ==============================================================================
-- 6. RETRIEVAL RPC: match_clinic_knowledge_v2
-- ==============================================================================
CREATE OR REPLACE FUNCTION match_clinic_knowledge_v2 (
  query_embedding vector(768),
  match_count int,
  p_clinic_id text,
  match_threshold float DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  chunk_text text,
  chunk_title text,
  similarity float,
  representation_version text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_active_index_id uuid;
  v_effective_threshold float;
  v_version text;
BEGIN
  -- 1. Locate the single active index for target clinic and verify published release
  SELECT i.id, COALESCE(match_threshold, i.retrieval_threshold), i.representation_version
    INTO v_active_index_id, v_effective_threshold, v_version
  FROM clinic_rag_indices i
  JOIN clinic_knowledge_releases r ON i.release_id = r.id
  WHERE i.clinic_id = p_clinic_id
    AND i.is_active = TRUE
    AND i.status = 'ACTIVE'
    AND r.status = 'PUBLISHED'
  LIMIT 1;

  -- 2. If no valid active index exists, return empty set (safe fallback)
  IF v_active_index_id IS NULL THEN
    RETURN;
  END IF;

  -- 3. Return matching chunks from the active index with exact cosine similarity
  RETURN QUERY
  SELECT
    c.id,
    c.chunk_text,
    c.chunk_title,
    (1 - (c.embedding <=> query_embedding))::float AS similarity,
    v_version AS representation_version
  FROM clinic_rag_chunks c
  WHERE c.index_id = v_active_index_id
    AND c.clinic_id = p_clinic_id
    AND (1 - (c.embedding <=> query_embedding)) > v_effective_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

REVOKE ALL ON FUNCTION match_clinic_knowledge_v2(vector(768), int, text, float) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION match_clinic_knowledge_v2(vector(768), int, text, float) TO service_role;

-- ==============================================================================
-- 7. DATABASE-ENFORCED ACTIVATION: activate_rag_index
-- ==============================================================================
CREATE OR REPLACE FUNCTION activate_rag_index (
  p_clinic_id text,
  p_candidate_index_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_candidate RECORD;
  v_release_status text;
  v_candidate_version integer;
  v_latest_release_id text;
  v_latest_version integer;
  v_actual_chunks integer;
  v_prev_active_id uuid;
BEGIN
  -- 1. Acquire transaction-level advisory lock per clinic to prevent race conditions
  PERFORM pg_advisory_xact_lock(hashtext('rag_activation_' || p_clinic_id));

  -- 2. Locate candidate index
  SELECT id, clinic_id, release_id, status, total_chunks, embedded_chunks
  INTO v_candidate
  FROM clinic_rag_indices
  WHERE id = p_candidate_index_id AND clinic_id = p_clinic_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidate index % not found for clinic %', p_candidate_index_id, p_clinic_id;
  END IF;

  -- 3. Verify candidate status is READY
  IF v_candidate.status <> 'READY' THEN
    RAISE EXCEPTION 'Candidate index % is in status %, required READY', p_candidate_index_id, v_candidate.status;
  END IF;

  -- 4. Verify completeness
  IF v_candidate.total_chunks <= 0 OR v_candidate.embedded_chunks <> v_candidate.total_chunks THEN
    RAISE EXCEPTION 'Candidate index % incomplete: total_chunks=%, embedded_chunks=%', 
      p_candidate_index_id, v_candidate.total_chunks, v_candidate.embedded_chunks;
  END IF;

  SELECT COUNT(*) INTO v_actual_chunks
  FROM clinic_rag_chunks
  WHERE index_id = p_candidate_index_id AND clinic_id = p_clinic_id;

  IF v_actual_chunks <> v_candidate.total_chunks THEN
    RAISE EXCEPTION 'Chunk count mismatch: index claims % chunks, but % found in chunks table', 
      v_candidate.total_chunks, v_actual_chunks;
  END IF;

  -- 5. Verify associated release is PUBLISHED
  SELECT status, version INTO v_release_status, v_candidate_version
  FROM clinic_knowledge_releases
  WHERE id = v_candidate.release_id AND clinic_id = p_clinic_id;

  IF v_release_status <> 'PUBLISHED' THEN
    RAISE EXCEPTION 'Associated release % is not PUBLISHED (current: %)', v_candidate.release_id, v_release_status;
  END IF;

  -- 6. Verify candidate is for the latest published release version
  SELECT id, version INTO v_latest_release_id, v_latest_version
  FROM clinic_knowledge_releases
  WHERE clinic_id = p_clinic_id AND status = 'PUBLISHED'
  ORDER BY version DESC LIMIT 1;

  IF v_candidate.release_id <> v_latest_release_id THEN
    RAISE EXCEPTION 'Candidate references release % (v%), but latest published release is % (v%)', 
      v_candidate.release_id, v_candidate_version, v_latest_release_id, v_latest_version;
  END IF;

  -- 7. Safely demote existing active index (if any)
  SELECT id INTO v_prev_active_id
  FROM clinic_rag_indices
  WHERE clinic_id = p_clinic_id AND is_active = TRUE;

  IF v_prev_active_id IS NOT NULL THEN
    UPDATE clinic_rag_indices
    SET is_active = FALSE,
        status = 'SUPERSEDED'
    WHERE id = v_prev_active_id;
  END IF;

  -- 8. Promote candidate to ACTIVE
  UPDATE clinic_rag_indices
  SET is_active = TRUE,
      status = 'ACTIVE',
      activated_at = NOW()
  WHERE id = p_candidate_index_id;

  RETURN jsonb_build_object(
    'success', true,
    'clinic_id', p_clinic_id,
    'activated_index_id', p_candidate_index_id,
    'superseded_index_id', v_prev_active_id,
    'activated_at', NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION activate_rag_index(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION activate_rag_index(text, uuid) TO service_role;

-- ==============================================================================
-- 8. DATABASE-ENFORCED ROLLBACK: rollback_rag_index
-- ==============================================================================
CREATE OR REPLACE FUNCTION rollback_rag_index (
  p_clinic_id text,
  p_reason text DEFAULT 'Manual rollback'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_active_id uuid;
  v_prev_id uuid;
  v_prev_release_id text;
BEGIN
  -- 1. Acquire transaction-level advisory lock per clinic
  PERFORM pg_advisory_xact_lock(hashtext('rag_activation_' || p_clinic_id));

  -- 2. Locate active index
  SELECT id INTO v_active_id
  FROM clinic_rag_indices
  WHERE clinic_id = p_clinic_id AND is_active = TRUE;

  IF v_active_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'clinic_id', p_clinic_id,
      'message', 'No active index found to rollback'
    );
  END IF;

  -- 3. Demote active index to ROLLBACK
  UPDATE clinic_rag_indices
  SET is_active = FALSE,
      status = 'ROLLBACK',
      rolled_back_at = NOW(),
      error_message = p_reason
  WHERE id = v_active_id;

  -- 4. Locate previous SUPERSEDED index whose release is still PUBLISHED
  SELECT i.id, i.release_id INTO v_prev_id, v_prev_release_id
  FROM clinic_rag_indices i
  JOIN clinic_knowledge_releases r ON i.release_id = r.id
  WHERE i.clinic_id = p_clinic_id
    AND i.status = 'SUPERSEDED'
    AND r.status = 'PUBLISHED'
  ORDER BY i.activated_at DESC NULLS LAST, i.created_at DESC
  LIMIT 1;

  -- 5. Restore previous index if found, else leave inactive for legacy fallback
  IF v_prev_id IS NOT NULL THEN
    UPDATE clinic_rag_indices
    SET is_active = TRUE,
        status = 'ACTIVE',
        activated_at = NOW()
    WHERE id = v_prev_id;

    RETURN jsonb_build_object(
      'success', true,
      'clinic_id', p_clinic_id,
      'rolled_back_index_id', v_active_id,
      'restored_index_id', v_prev_id,
      'fallback_to_legacy', false,
      'reason', p_reason
    );
  ELSE
    RETURN jsonb_build_object(
      'success', true,
      'clinic_id', p_clinic_id,
      'rolled_back_index_id', v_active_id,
      'restored_index_id', null,
      'fallback_to_legacy', true,
      'message', 'No previous active index available. Application will route to legacy knowledge chunks.',
      'reason', p_reason
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION rollback_rag_index(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rollback_rag_index(text, text) TO service_role;
