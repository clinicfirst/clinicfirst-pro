const fs = require('fs');
let sdiff = fs.readFileSync('server/supabaseDiff.ts', 'utf8');
sdiff = sdiff.replace(/console\.error\('CRITICAL ERROR: SUPABASE_SERVICE_ROLE_KEY is missing\. Backend Supabase client failed closed\.'\);/g, 
"console.warn('Warning: SUPABASE_SERVICE_ROLE_KEY is missing. Local-only mode.');");
sdiff = sdiff.replace(/console\.error\('The backend will NOT fall back to anon credentials\. Database sync and mutation is disabled\.'\);/g, "");
fs.writeFileSync('server/supabaseDiff.ts', sdiff);
