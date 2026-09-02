const { createClient } = require('@supabase/supabase-js');
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

console.log("URL:", url);
console.log("Has key:", !!key);
console.log("Is Anon?", key === process.env.VITE_SUPABASE_ANON_KEY);

const supabase = createClient(url, key);
async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' });
  console.log("RPC Error:", error);
}
run();
