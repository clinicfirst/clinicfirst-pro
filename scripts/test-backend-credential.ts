import { supabase } from '../server/supabaseDiff';

async function test() {
  if (supabase) {
    console.error('FAIL: supabase client was initialized even though SUPABASE_SERVICE_ROLE_KEY is missing.');
    process.exit(1);
  } else {
    console.log('PASS: Backend failed closed successfully when SUPABASE_SERVICE_ROLE_KEY is absent.');
  }
}
test();
