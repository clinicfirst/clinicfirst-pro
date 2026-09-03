import { supabase } from './server/supabaseDiff';

async function run() {
  const { data, error } = await supabase.from('calls').select('*').limit(1);
  if (error) {
    console.error(error);
  } else {
    console.log(Object.keys(data[0] || {}));
  }
}
run();
