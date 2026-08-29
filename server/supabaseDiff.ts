import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = url && key ? createClient(url, key) : null;

let lastState: any = null;

export async function syncToSupabase(currentState: any) {
  if (!supabase) return;
  if (!lastState) {
    // Deep clone
    lastState = JSON.parse(JSON.stringify(currentState));
    return;
  }
  
  // Find differences table by table
  const tables = [
    'clinics', 'users', 'doctors', 'doctor_schedules', 'doctor_leaves',
    'services', 'doctor_services', 'patients', 'appointments', 'ai_agents',
    'calls', 'audit_logs', 'platform_knowledge_base'
  ];

  for (const table of tables) {
    const currentRecords = currentState[table] || [];
    const lastRecords = lastState[table] || [];
    
    // Find new or updated
    for (const record of currentRecords) {
      const lastRecord = lastRecords.find((r: any) => r.id === record.id);
      if (!lastRecord || JSON.stringify(record) !== JSON.stringify(lastRecord)) {
        // Upsert
        let sanitized = { ...record };
        if (table === 'users') { delete sanitized.doctor_id; delete sanitized.permissions; }
        if (table === 'calls') { delete sanitized.active_ai_config_version; delete sanitized.end_time; }
        if (table === 'patients' && sanitized.dob === "") sanitized.dob = null;
        if (table === 'appointments') { delete sanitized.notes; }
        
        supabase.from(table).upsert(sanitized).then(({error}) => {
            if (error) console.error(`[Supabase Sync] Error upserting ${table}:`, error.message);
        });
      }
    }
    
    // Find deleted
    for (const lastRecord of lastRecords) {
      if (!currentRecords.find((r: any) => r.id === lastRecord.id)) {
        supabase.from(table).delete().eq('id', lastRecord.id).then();
      }
    }
  }
  
  lastState = JSON.parse(JSON.stringify(currentState));
}
