const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
// We need to use the service role key or whatever key backend has
// Let's check what's in process.env or .env
const fs = require('fs');
let sKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!sKey && fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  const match = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
  if (match) sKey = match[1].trim();
}

console.log("Supabase URL:", url, "Has Service Key:", Boolean(sKey));
const supabase = createClient(url, sKey || process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: agents, error } = await supabase.from('ai_agents').select('*');
  console.log("Agents error:", error);
  console.log("Agents count:", agents ? agents.length : 0);
  if (agents) {
    agents.forEach(a => {
      console.log(`Clinic: ${a.clinic_id} | Agent ID: ${a.id} | Name: ${a.name} | Status: ${a.status} | Enabled: ${a.enabled} | Provider ID: ${a.provider_agent_id}`);
    });
  }

  const { data: platformConfig, error: pError } = await supabase.from('platform_ai_config').select('*');
  console.log("Platform config error:", pError);
  console.log("Platform config:", platformConfig);
}

run().catch(console.error);
