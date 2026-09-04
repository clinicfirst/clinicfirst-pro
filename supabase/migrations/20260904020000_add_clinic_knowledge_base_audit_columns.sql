-- Migration: Add missing audit columns to clinic_knowledge_base
ALTER TABLE clinic_knowledge_base ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE clinic_knowledge_base ADD COLUMN IF NOT EXISTS updated_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE clinic_knowledge_base ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE clinic_knowledge_base ADD COLUMN IF NOT EXISTS published_by TEXT REFERENCES users(id) ON DELETE SET NULL;
