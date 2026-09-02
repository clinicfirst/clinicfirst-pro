import { supabase } from './server/supabaseDiff';
async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { sql: "SELECT 1;" });
  console.log("Error:", error);
}
run();
