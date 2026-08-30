import fs from 'fs';
import path from 'path';
import { supabase } from './supabaseDiff';

async function restoreToSupabase() {
  const dataPath = path.join(process.cwd(), 'data', 'clinicfirst.json');
  const rawData = fs.readFileSync(dataPath, 'utf-8');
  const state = JSON.parse(rawData);
  
  const tables = [
    'clinics', 'users', 'doctors', 'doctor_schedules', 'doctor_leaves',
    'services', 'doctor_services', 'patients', 'appointments', 'ai_agents',
    'calls', 'audit_logs', 'platform_knowledge_base', 'platform_ai_config',
    'clinic_ai_rules', 'clinic_knowledge_base', 'clinic_ai_tools'
  ];
  
  console.log('Force pushing local state to Supabase...');
  for (const table of tables) {
    let records = state[table as keyof typeof state];
    if (table === 'platform_ai_config' && !Array.isArray(records)) {
      records = records && Object.keys(records).length > 0 ? [records] : [];
    }

    if (Array.isArray(records) && records.length > 0) {
      console.log(`Pushing ${records.length} records to ${table}...`);
      for (const record of records) {
        let sanitized = { ...record };
        if (table === 'users') { delete (sanitized as any).doctor_id; delete (sanitized as any).permissions; }
        if (table === 'calls') { delete (sanitized as any).active_ai_config_version; delete (sanitized as any).end_time; }
        if (table === 'patients' && sanitized.dob === '') { sanitized.dob = null; }
        if (table === 'appointments') { delete (sanitized as any).notes; }
        
        const { error } = await supabase?.from(table).upsert(sanitized);
        if (error) {
          console.error(`Error inserting into ${table}:`, error.message);
        }
      }
    }
  }
  console.log('Done!');
}

restoreToSupabase();
