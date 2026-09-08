CREATE TABLE IF NOT EXISTS escalations (
  id TEXT PRIMARY KEY,
  clinic_id TEXT REFERENCES clinics(id),
  call_id TEXT REFERENCES calls(id),
  reason TEXT,
  priority TEXT,
  context_summary TEXT,
  status TEXT DEFAULT 'pending',
  resolved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_escalations_clinic_id ON escalations(clinic_id);
CREATE INDEX IF NOT EXISTS idx_escalations_created_at ON escalations(created_at DESC);

ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access for migration" ON escalations FOR ALL USING (true);

