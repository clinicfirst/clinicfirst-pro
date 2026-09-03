-- Migration: 20260903000000_clinic_ai_knowledge_hardening.sql
-- Description: Enforce dedicated tenant-scoped persistence model for clinic AI knowledge and audit metadata.

ALTER TABLE clinic_knowledge_base ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE clinic_knowledge_base ADD COLUMN IF NOT EXISTS updated_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE clinic_knowledge_base ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE clinic_knowledge_base ADD COLUMN IF NOT EXISTS published_by TEXT REFERENCES users(id) ON DELETE SET NULL;

-- Ensure index on clinic_id and category for efficient tenant-scoped filtering
CREATE INDEX IF NOT EXISTS idx_clinic_knowledge_base_clinic_cat 
ON clinic_knowledge_base(clinic_id, category);

-- Enable RLS
ALTER TABLE clinic_knowledge_base ENABLE ROW LEVEL SECURITY;
