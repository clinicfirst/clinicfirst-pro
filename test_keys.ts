import dotenv from 'dotenv';
dotenv.config();

console.log("SUPABASE_SERVICE_ROLE_KEY:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log("VITE_SUPABASE_ANON_KEY:", !!process.env.VITE_SUPABASE_ANON_KEY);
