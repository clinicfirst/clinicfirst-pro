import fs from 'fs';
import path from 'path';
import { supabase } from './server/supabaseDiff';

async function verifyCounts() {
  const dataPath = path.join(process.cwd(), 'data', 'clinicfirst.json');
  const state = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  
  const tables = ['clinics', 'users', 'patients', 'appointments', 'calls', 'ai_agents'];
  
  for (const table of tables) {
    const localCount = Array.isArray(state[table]) ? state[table].length : 0;
    
    // We can only reliably count clinics, users, patients, appointments (which have USING true).
    // calls and ai_agents have no policies, so we might get 0 back with anon key.
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    
    console.log(`Table ${table}: Local Count = ${localCount}, Supabase Count = ${count}, Error: ${error?.message || 'None'}`);
  }
}
verifyCounts();
