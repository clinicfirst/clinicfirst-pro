import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  '';
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  
  
  '';

if (url && !key) {
  console.error('CRITICAL ERROR: SUPABASE_SERVICE_ROLE_KEY is missing. Backend Supabase client failed closed.');
  console.error('The backend will NOT fall back to anon credentials. Database sync and mutation is disabled.');
}
export const supabase = url && key ? createClient(url, key) : null;

let lastState: any = null;

export function setLastSyncedState(state: any) {
  if (state) {
    lastState = JSON.parse(JSON.stringify(state));
  }
}

export async function fetchFromSupabase(): Promise<any | null> {
  if (!supabase) {
    return null;
  }

  const tables = [
    'clinics',
    'users',
    'doctors',
    'doctor_schedules',
    'doctor_leaves',
    'services',
    'doctor_services',
    'patients',
    'appointments',
    'ai_agents',
    'platform_knowledge_base',
    'platform_ai_config',
    'clinic_ai_rules',
    'clinic_knowledge_base',
    'clinic_knowledge_releases',
    'clinic_ai_tools',
  ];

  const results: Record<string, any[]> = {};

  await Promise.all(
    tables.map(async (table) => {
      try {
        const { data, error } = await supabase.from(table).select('*');
        if (!error && data) {
          results[table] = data;
        } else if (error) {
          // Table might not exist or error, keep empty array
          results[table] = [];
        }
      } catch (err) {
        results[table] = [];
      }
    })
  );

  return results;
}

export async function syncToSupabase(currentState: any) {
  if (!supabase || !currentState) return;
  if (!lastState) {
    lastState = JSON.parse(JSON.stringify(currentState));
    return;
  }

  const tables = [
    'clinics',
    'users',
    'doctors',
    'doctor_schedules',
    'doctor_leaves',
    'services',
    'doctor_services',
    'patients',
    'appointments',
    'ai_agents',
    'platform_knowledge_base',
    'platform_ai_config',
    'clinic_ai_rules',
    'clinic_knowledge_base',
    'clinic_knowledge_releases',
    'clinic_ai_tools',
  ];

  for (const table of tables) {
    let currentRecords = currentState[table] || [];
    if (table === 'platform_ai_config' && !Array.isArray(currentRecords)) {
      currentRecords = currentState[table] && Object.keys(currentState[table]).length > 0 ? [currentState[table]] : [];
    }

    let lastRecords = lastState[table] || [];
    if (table === 'platform_ai_config' && !Array.isArray(lastRecords)) {
      lastRecords = lastState[table] && Object.keys(lastState[table]).length > 0 ? [lastState[table]] : [];
    }

    // Find new or updated records
    for (const record of currentRecords) {
      const lastRecord = lastRecords.find((r: any) => r.id === record.id);
      if (!lastRecord || JSON.stringify(record) !== JSON.stringify(lastRecord)) {
        let sanitized = { ...record };
        if (table === 'users') {
          delete sanitized.doctor_id;
          delete sanitized.permissions;
        }
        if (table === 'calls') {
          delete sanitized.active_ai_config_version;
          delete sanitized.end_time;
        }
        if (table === 'patients' && sanitized.dob === '') {
          sanitized.dob = null;
        }
        if (table === 'appointments') {
          delete sanitized.notes;
        }

        try {
          const { error } = await supabase.from(table).upsert(sanitized);
          if (error) {
            console.error(`[Supabase Sync] Error upserting into ${table}:`, error.message);
          }
        } catch (e: any) {
          console.error(`[Supabase Sync] Exception upserting into ${table}:`, e.message);
        }
      }
    }

    // Find deleted records
    for (const lastRecord of lastRecords) {
      if (!currentRecords.find((r: any) => r.id === lastRecord.id)) {
        try {
          await supabase.from(table).delete().eq('id', lastRecord.id);
        } catch (e: any) {
          console.error(`[Supabase Sync] Error deleting from ${table}:`, e.message);
        }
      }
    }
  }

  lastState = JSON.parse(JSON.stringify(currentState));
}
