const fs = require('fs');
let content = fs.readFileSync('supabase/migrations/20260915000000_rag_v1_knowledge.sql', 'utf8');

const oldRPC = `CREATE OR REPLACE FUNCTION match_clinic_knowledge (
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
AS $$
BEGIN
  RETURN QUERY
  SELECT
    clinic_knowledge_chunks.id,
    clinic_knowledge_chunks.chunk_text,
    1 - (clinic_knowledge_chunks.embedding <=> query_embedding) AS similarity
  FROM clinic_knowledge_chunks
  WHERE clinic_knowledge_chunks.clinic_id = p_clinic_id
  AND 1 - (clinic_knowledge_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY clinic_knowledge_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;`;

const newRPC = `CREATE OR REPLACE FUNCTION match_clinic_knowledge (
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
AS $$
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
$$;`;

content = content.replace(oldRPC, newRPC);
fs.writeFileSync('supabase/migrations/20260915000000_rag_v1_knowledge.sql', content);
