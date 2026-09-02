const fs = require('fs');
let code = fs.readFileSync('server/supabaseDiff.ts', 'utf8');
code = code.replace(
  "export const supabase = url && key ? createClient(url, key) : null;",
  `if (url && !key) {
  console.error('CRITICAL ERROR: SUPABASE_SERVICE_ROLE_KEY is missing. Backend Supabase client failed closed.');
  console.error('The backend will NOT fall back to anon credentials. Database sync and mutation is disabled.');
}
export const supabase = url && key ? createClient(url, key) : null;`
);
fs.writeFileSync('server/supabaseDiff.ts', code);
