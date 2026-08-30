import fs from 'fs';
import path from 'path';
import { supabase } from './supabaseDiff';

async function restoreToSupabase() {
  const dataPath = path.join(process.cwd(), 'data', 'clinicfirst.json');
  const rawData = fs.readFileSync(dataPath, 'utf-8');
  const state = JSON.parse(rawData);
  
  if (state.platform_ai_config) {
    let sanitized = { ...state.platform_ai_config };
    delete (sanitized as any).api_key_configured;
    delete (sanitized as any).api_key_masked;
    delete (sanitized as any).internal_api_key;
    delete (sanitized as any).greeting_template;
    delete (sanitized as any).role_definition;
    delete (sanitized as any).escalation_rules;
    delete (sanitized as any).things_to_do;
    delete (sanitized as any).things_to_avoid;
    
    const { error } = await supabase?.from('platform_ai_config').upsert(sanitized);
    if (error) {
      console.error('Error inserting into platform_ai_config:', error.message);
    } else {
      console.log('Successfully inserted platform_ai_config');
    }
  }
}

restoreToSupabase();
