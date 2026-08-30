import { supabase } from './server/supabaseDiff';

async function test() {
  if (!supabase) {
    console.log("No supabase client");
    return;
  }
  
  const tables = ['clinics', 'ai_agents', 'calls', 'platform_ai_config'];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    console.log(`Table ${table}: data length = ${data?.length}, error = ${error?.message}`);
  }
}
test();
