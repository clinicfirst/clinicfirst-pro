const fs = require('fs');
let code = fs.readFileSync('server/app.ts', 'utf8');
code = code.replace("import { supabase } from './supabaseDiff';", "import { supabase } from './supabaseDiff';\nimport { requireAuth } from './auth';");
fs.writeFileSync('server/app.ts', code);
