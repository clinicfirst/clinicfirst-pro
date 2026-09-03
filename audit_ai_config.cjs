const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const url = process.env.VITE_SUPABASE_URL || 'https://ydanlzyutvixyymwqgpg.supabase.co';
const key = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function run() {
  console.log("=== 1. AI Agents ===");
  const { data: agents, error: errAgents } = await supabase
    .from('ai_agents')
    .select('*');
  console.log("ai_agents err:", errAgents, "data:", agents);

  console.log("=== 2. Platform AI Config ===");
  const { data: platformConfig, error: errPlatform } = await supabase
    .from('platform_ai_config')
    .select('*');
  console.log("platform_ai_config err:", errPlatform, "data:", platformConfig);

  console.log("=== 3. Sanjeevani Clinic Record ===");
  const { data: clinic, error: errClinic } = await supabase
    .from('clinics')
    .select('*')
    .eq('id', 'clinic_1787923240249_cqgw');
  console.log("clinic err:", errClinic, "data:", clinic);
}

run().catch(console.error);
