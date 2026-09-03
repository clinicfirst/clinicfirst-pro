const fs = require('fs');

let appTs = fs.readFileSync('server/app.ts', 'utf8');
appTs = appTs.replace(/await db\.ensureHydrated\(\);/g, '// await db.ensureHydrated();');
fs.writeFileSync('server/app.ts', appTs);

let supabaseDiff = fs.readFileSync('server/supabaseDiff.ts', 'utf8');
supabaseDiff = supabaseDiff.replace(/export async function syncToSupabase\([\s\S]*/, '');
supabaseDiff = supabaseDiff.replace(/export async function fetchFromSupabase\([\s\S]*?export function syncToSupabase/, 'export async function syncToSupabase'); // This is a bit risky. Let's just rewrite the file.
fs.writeFileSync('server/supabaseDiff.ts', supabaseDiff);
