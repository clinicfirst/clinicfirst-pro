-- Phase 1C: RAG v1 Knowledge Storage

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create the chunks table
CREATE TABLE IF NOT EXISTS clinic_knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    release_id UUID NOT NULL REFERENCES clinic_knowledge_releases(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding VECTOR(768),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create index for performance
CREATE INDEX IF NOT EXISTS clinic_knowledge_chunks_clinic_id_idx ON clinic_knowledge_chunks(clinic_id);

-- Note: HNSW or IVFFlat index could be added on the embedding column, 
-- but for small per-clinic knowledge bases, exact KNN is fast enough and 100% accurate.

-- 4. Create RLS Policies
ALTER TABLE clinic_knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Note: We assume the same RLS policy as other tables. Since this is queried server-side, 
-- service_role key will bypass RLS. For client safety, we can add a basic authenticated policy.
CREATE POLICY "Users can read chunks for their clinic"
    ON clinic_knowledge_chunks
    FOR SELECT
    USING (
        clinic_id IN (
            SELECT clinic_id FROM users WHERE users.id = auth.uid()
        )
    );

-- 5. RPC Function for similarity search
CREATE OR REPLACE FUNCTION match_clinic_knowledge (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_clinic_id text
)
RETURNS TABLE (
  id uuid,
  chunk_text text,
  similarity float
)
LANGUAGE plpgsql
AS $
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.chunk_text,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM clinic_knowledge_chunks c
  JOIN clinic_knowledge_releases r ON c.release_id = r.id
  WHERE c.clinic_id = p_clinic_id
    AND r.status = 'PUBLISHED'
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$;
