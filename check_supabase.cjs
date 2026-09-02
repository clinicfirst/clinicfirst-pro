const { createClient } = require('@supabase/supabase-js');
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from('clinic_knowledge_releases').select('*').limit(1);
  if (error) {
    console.error("Error querying table:", error);
  } else {
    console.log("Table exists! Data:", data);
  }
}
check();
