import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

async function run() {
  const res = await fetch(`${url}/rest/v1/?apikey=${key}`);
  const openapi = await res.json();
  console.log(JSON.stringify(openapi, null, 2));
}
run().catch(console.error);
