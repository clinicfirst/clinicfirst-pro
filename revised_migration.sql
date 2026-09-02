-- 1. Table Creation
CREATE TABLE IF NOT EXISTS clinic_knowledge_releases (
  id TEXT PRIMARY KEY,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  document_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('COMPILED', 'PUBLISHED')),
  compiled_content TEXT NOT NULL,
  compiled_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  published_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(clinic_id, version)
);

-- 2. Lifecycle & Immutability Trigger
CREATE OR REPLACE FUNCTION protect_knowledge_release_immutability()
RETURNS TRIGGER AS $$
BEGIN
  -- A. Enforce Core Immutability
  IF NEW.clinic_id <> OLD.clinic_id THEN
    RAISE EXCEPTION 'clinic_id is immutable';
  END IF;
  IF NEW.version <> OLD.version THEN
    RAISE EXCEPTION 'version is immutable';
  END IF;
  IF NEW.document_hash <> OLD.document_hash THEN
    RAISE EXCEPTION 'document_hash is immutable';
  END IF;
  IF NEW.compiled_content <> OLD.compiled_content THEN
    RAISE EXCEPTION 'compiled_content is immutable';
  END IF;
  IF NEW.compiled_at <> OLD.compiled_at THEN
    RAISE EXCEPTION 'compiled_at is immutable';
  END IF;

  -- B. Enforce Lifecycle Transitions
  IF OLD.status = 'PUBLISHED' AND NEW.status = 'COMPILED' THEN
    RAISE EXCEPTION 'Cannot transition status from PUBLISHED backward to COMPILED';
  END IF;
  
  -- C. Enforce Mandatory Metadata on Publish
  IF NEW.status = 'PUBLISHED' AND NEW.published_at IS NULL THEN
    RAISE EXCEPTION 'published_at is mandatory when status is PUBLISHED';
  END IF;

  -- D. Protect Published Metadata
  IF OLD.status = 'PUBLISHED' THEN
    IF NEW.published_at IS DISTINCT FROM OLD.published_at THEN
      RAISE EXCEPTION 'published_at is immutable once published';
    END IF;
    
    -- Allow published_by to become NULL ONLY for ON DELETE SET NULL cascades when a user is deleted
    IF NEW.published_by IS DISTINCT FROM OLD.published_by AND NEW.published_by IS NOT NULL THEN
      RAISE EXCEPTION 'published_by is immutable once published';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_protect_knowledge_release_immutability ON clinic_knowledge_releases;
CREATE TRIGGER trigger_protect_knowledge_release_immutability
BEFORE UPDATE ON clinic_knowledge_releases
FOR EACH ROW
EXECUTE FUNCTION protect_knowledge_release_immutability();

-- 3. Row Level Security Setup
-- The backend API accesses this table exclusively using the SUPABASE_SERVICE_ROLE_KEY
-- which inherently bypasses RLS. To prevent data exfiltration or tampering from the browser via the Anon Key,
-- we explicitly lock down all public access at the database level.
ALTER TABLE clinic_knowledge_releases ENABLE ROW LEVEL SECURITY;

-- Explicitly deny all operations from Anon/Authenticated users. 
-- The Service Role key (backend) will bypass this constraint automatically.
DROP POLICY IF EXISTS "Deny all public access to clinic_knowledge_releases" ON clinic_knowledge_releases;

CREATE POLICY "Deny all public access to clinic_knowledge_releases" 
ON clinic_knowledge_releases 
FOR ALL 
USING (false);
