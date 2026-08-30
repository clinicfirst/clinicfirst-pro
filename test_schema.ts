import { supabase } from './server/supabaseDiff';

async function verify() {
  if (!supabase) return;
  
  const tests = [
    { table: 'platform_ai_config', columns: 'id, platform_ai_enabled, provider, model, voice_provider, voice_name, temperature, status, created_at, updated_at' },
    { table: 'clinic_ai_rules', columns: 'id, clinic_id, rule_name, rule_type, rule_content, priority, enabled, created_at, updated_at' },
    { table: 'clinic_knowledge_base', columns: 'id, clinic_id, title, content, category, status, version, created_at, updated_at' },
    { table: 'clinic_ai_tools', columns: 'id, clinic_id, tool_name, tool_type, enabled, configuration, created_at, updated_at' },
    { table: 'ai_agents', columns: 'provider_agent_id, enabled, primary_language, created_at, updated_at' },
    { table: 'calls', columns: 'provider_session_id, provider_agent_id' },
    { table: 'clinics', columns: 'id' },
    { table: 'users', columns: 'id' },
    { table: 'patients', columns: 'id' },
    { table: 'appointments', columns: 'id' },
  ];
  
  for (const test of tests) {
    const { data, error } = await supabase.from(test.table).select(test.columns).limit(1);
    console.log(`${test.table} -> Error: ${error ? error.message : 'None'}`);
  }
}
verify();
