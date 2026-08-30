-- Migration: 20260830000000_ai_foundation.sql
-- Description: Safe, non-destructive additive schema modifications for AI Foundation tables.

-- ==============================================================================
-- 1. ALTER EXISTING ai_agents
-- ==============================================================================
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS provider_agent_id TEXT;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS primary_language TEXT;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();


-- ==============================================================================
-- 2. ALTER EXISTING calls
-- ==============================================================================
ALTER TABLE calls ADD COLUMN IF NOT EXISTS provider_session_id TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS provider_agent_id TEXT;

-- Use a partial unique index. Some older call records might not have a provider_session_id.
-- A partial unique index enforces uniqueness ONLY where the column is populated, avoiding failures.
CREATE UNIQUE INDEX IF NOT EXISTS idx_calls_provider_session_id 
ON calls(provider_session_id) 
WHERE provider_session_id IS NOT NULL;


-- ==============================================================================
-- 3. CREATE platform_ai_config
-- ==============================================================================
-- Stores global platform-wide AI defaults and API configurations.
CREATE TABLE IF NOT EXISTS platform_ai_config (
  id TEXT PRIMARY KEY,
  platform_ai_enabled BOOLEAN DEFAULT true,
  provider TEXT,
  model TEXT,
  voice_provider TEXT,
  voice_name TEXT,
  temperature NUMERIC,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- There should normally be only one config record (e.g. id = 'platform_ai_default').


-- ==============================================================================
-- 4. CREATE clinic_ai_rules
-- ==============================================================================
CREATE TABLE IF NOT EXISTS clinic_ai_rules (
  id TEXT PRIMARY KEY,
  clinic_id TEXT REFERENCES clinics(id),
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  rule_content TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinic_ai_rules_clinic_id ON clinic_ai_rules(clinic_id);


-- ==============================================================================
-- 5. CREATE clinic_knowledge_base
-- ==============================================================================
CREATE TABLE IF NOT EXISTS clinic_knowledge_base (
  id TEXT PRIMARY KEY,
  clinic_id TEXT REFERENCES clinics(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  status TEXT,
  version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinic_knowledge_base_clinic_id ON clinic_knowledge_base(clinic_id);


-- ==============================================================================
-- 6. CREATE clinic_ai_tools
-- ==============================================================================
CREATE TABLE IF NOT EXISTS clinic_ai_tools (
  id TEXT PRIMARY KEY,
  clinic_id TEXT REFERENCES clinics(id),
  tool_name TEXT NOT NULL,
  tool_type TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  configuration JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinic_ai_tools_clinic_id ON clinic_ai_tools(clinic_id);


-- ==============================================================================
-- 7. ENABLE ROW LEVEL SECURITY (RLS)
-- ==============================================================================
-- Ensure RLS is active on all new tables and modified tables.
ALTER TABLE platform_ai_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_ai_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_ai_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- 8. RLS POLICIES (DEFENSE IN DEPTH)
-- ==============================================================================
-- IMPORTANT:
-- The previous schema.sql used `CREATE POLICY ... FOR ALL USING (true);`.
-- This allowed arbitrary unauthenticated reads and writes if the Anon key was used directly.
-- Since the frontend exclusively queries through the Clinic-1st Backend (which uses the
-- service_role key to bypass RLS and perform strict JWT-based tenant isolation),
-- we DROP the flawed permissive policies. 
--
-- By default, tables with RLS enabled and NO policies have a "Deny All" stance.
-- This guarantees that the Anon key CANNOT be used to access tenant data.
-- Data access is restricted entirely to the backend service.

DROP POLICY IF EXISTS "Allow public access for migration" ON platform_ai_config;
DROP POLICY IF EXISTS "Allow public access for migration" ON clinic_ai_rules;
DROP POLICY IF EXISTS "Allow public access for migration" ON clinic_knowledge_base;
DROP POLICY IF EXISTS "Allow public access for migration" ON clinic_ai_tools;
DROP POLICY IF EXISTS "Allow public access for migration" ON ai_agents;
DROP POLICY IF EXISTS "Allow public access for migration" ON calls;
