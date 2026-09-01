import { supabase } from '../server/supabaseDiff';

async function run() {
  await supabase.from('appointments').delete().eq('date', '2088-06-20');
  console.log("Cleaned up test appointments for 2088-06-20");
}
run().catch(console.error);
