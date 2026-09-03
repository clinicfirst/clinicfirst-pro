CREATE TABLE IF NOT EXISTS escalations (
  id TEXT PRIMARY KEY,
  clinic_id TEXT REFERENCES clinics(id),
  call_id TEXT REFERENCES calls(id),
  reason TEXT,
  priority TEXT,
  context_summary TEXT,
  status TEXT,
  resolved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;
