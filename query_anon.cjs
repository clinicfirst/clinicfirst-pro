const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);
async function run() {
  const { data, error } = await supabase.from('users').select('*').eq('clinic_id', 'clinic_1787923240249_cqgw');
  console.log('Error:', error);
  console.log('Users:', data);
}
run();
