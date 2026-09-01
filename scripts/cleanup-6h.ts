import { supabase } from '../server/supabaseDiff';

async function run() {
  await supabase.from('appointments').delete().eq('date', '2088-05-15');
  console.log("Cleaned up test appointments for 2088-05-15");
}
run().catch(console.error);
