const { createClient } = require('@supabase/supabase-js');
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.log("FAILURE: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing from the environment variables.");
  process.exit(1);
}

const supabase = createClient(url, key);

async function testConnection() {
  console.log(`Testing connection to: ${url}`);
  try {
    // Attempting a simple query. If the table doesn't exist, Supabase returns a PostgREST error (which still proves connectivity).
    // If connection fails completely, it throws a network error.
    const { data, error } = await supabase.from('clinics').select('*').limit(1);
    
    if (error && error.code === 'PGRST204') {
       console.log("SUCCESS: Reached Supabase API successfully! (Note: 'clinics' table not found, but connection works)");
    } else if (error && error.code === '42P01') {
       console.log("SUCCESS: Reached Supabase API successfully! (Note: 'clinics' table does not exist yet, which is expected)");
    } else if (error) {
       console.log("SUCCESS: Reached Supabase API, but got an API error:", error.message, error.code);
    } else {
       console.log("SUCCESS: Connected to Supabase and fetched data:", data);
    }
  } catch (err) {
    console.log("FAILURE: Exception occurred while trying to connect:", err.message);
  }
}

testConnection();
