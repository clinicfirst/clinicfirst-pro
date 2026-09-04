-- Fix clinic_knowledge_releases id column default to prevent null constraint violations
ALTER TABLE IF EXISTS clinic_knowledge_releases 
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

-- Ensure status check constraint allows 'PUBLISH_FAILED' if used by application
ALTER TABLE IF EXISTS clinic_knowledge_releases 
  DROP CONSTRAINT IF EXISTS clinic_knowledge_releases_status_check;

ALTER TABLE IF EXISTS clinic_knowledge_releases 
  ADD CONSTRAINT clinic_knowledge_releases_status_check 
  CHECK (status IN ('COMPILED', 'PUBLISHED', 'PUBLISH_FAILED'));
