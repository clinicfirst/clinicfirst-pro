-- Run this in your Supabase SQL Editor

-- 1. Enable pgcrypto for UUIDs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS calls CASCADE;
DROP TABLE IF EXISTS ai_agents CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS doctor_services CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS doctor_leaves CASCADE;
DROP TABLE IF EXISTS doctor_schedules CASCADE;
DROP TABLE IF EXISTS doctors CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS clinics CASCADE;
DROP TABLE IF EXISTS platform_knowledge_base CASCADE;

-- 3. Create Tables
CREATE TABLE clinics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  city TEXT,
  timezone TEXT,
  currency TEXT,
  currency_symbol TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  operating_hours JSONB
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  clinic_id TEXT REFERENCES clinics(id),
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  status TEXT,
  must_change_password BOOLEAN DEFAULT false,
  password_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE doctors (
  id TEXT PRIMARY KEY,
  clinic_id TEXT REFERENCES clinics(id),
  name TEXT NOT NULL,
  specialization TEXT,
  qualification TEXT,
  phone TEXT,
  email TEXT,
  consultation_duration_minutes INTEGER,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE doctor_schedules (
  id TEXT PRIMARY KEY,
  clinic_id TEXT REFERENCES clinics(id),
  doctor_id TEXT REFERENCES doctors(id),
  day_of_week INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  break_start TEXT,
  break_end TEXT,
  buffer_minutes INTEGER
);

CREATE TABLE doctor_leaves (
  id TEXT PRIMARY KEY,
  clinic_id TEXT REFERENCES clinics(id),
  doctor_id TEXT REFERENCES doctors(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT
);

CREATE TABLE services (
  id TEXT PRIMARY KEY,
  clinic_id TEXT REFERENCES clinics(id),
  name TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  fee NUMERIC,
  status TEXT,
  assigned_doctor_ids JSONB
);

CREATE TABLE doctor_services (
  id TEXT PRIMARY KEY,
  clinic_id TEXT REFERENCES clinics(id),
  doctor_id TEXT REFERENCES doctors(id),
  service_id TEXT REFERENCES services(id)
);

CREATE TABLE patients (
  id TEXT PRIMARY KEY,
  clinic_id TEXT REFERENCES clinics(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  dob DATE,
  gender TEXT,
  preferred_language TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE appointments (
  id TEXT PRIMARY KEY,
  clinic_id TEXT REFERENCES clinics(id),
  patient_id TEXT REFERENCES patients(id),
  doctor_id TEXT REFERENCES doctors(id),
  service_id TEXT REFERENCES services(id),
  date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status TEXT NOT NULL,
  created_via TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_agents (
  id TEXT PRIMARY KEY,
  clinic_id TEXT REFERENCES clinics(id),
  name TEXT NOT NULL,
  greeting TEXT,
  voice_provider TEXT,
  voice_config JSONB,
  languages JSONB,
  status TEXT,
  escalation_contact JSONB,
  instructions_note TEXT
);

CREATE TABLE calls (
  id TEXT PRIMARY KEY,
  clinic_id TEXT REFERENCES clinics(id),
  patient_id TEXT REFERENCES patients(id),
  agent_id TEXT REFERENCES ai_agents(id),
  doctor_id TEXT REFERENCES doctors(id),
  service_id TEXT REFERENCES services(id),
  appointment_id TEXT REFERENCES appointments(id),
  direction TEXT,
  start_time TIMESTAMPTZ,
  duration_seconds INTEGER,
  status TEXT,
  summary TEXT,
  outcome TEXT,
  transcript JSONB,
  language_detected TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  clinic_id TEXT,
  actor_user_id TEXT,
  actor_name TEXT,
  action TEXT,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE platform_knowledge_base (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT,
  content TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Set up Row Level Security (RLS) - Basic Tenant Isolation
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access for migration" ON clinics FOR ALL USING (true);
CREATE POLICY "Allow public access for migration" ON users FOR ALL USING (true);
CREATE POLICY "Allow public access for migration" ON doctors FOR ALL USING (true);
CREATE POLICY "Allow public access for migration" ON doctor_schedules FOR ALL USING (true);
CREATE POLICY "Allow public access for migration" ON doctor_leaves FOR ALL USING (true);
CREATE POLICY "Allow public access for migration" ON services FOR ALL USING (true);
CREATE POLICY "Allow public access for migration" ON doctor_services FOR ALL USING (true);
CREATE POLICY "Allow public access for migration" ON patients FOR ALL USING (true);
CREATE POLICY "Allow public access for migration" ON appointments FOR ALL USING (true);
CREATE POLICY "Allow public access for migration" ON ai_agents FOR ALL USING (true);
CREATE POLICY "Allow public access for migration" ON calls FOR ALL USING (true);
CREATE POLICY "Allow public access for migration" ON audit_logs FOR ALL USING (true);
CREATE POLICY "Allow public access for migration" ON platform_knowledge_base FOR ALL USING (true);

