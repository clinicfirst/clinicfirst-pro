const fs = require('fs');
let code = fs.readFileSync('server/voice/tools/create-appointment.ts', 'utf-8');

const importSupabase = "import { supabase } from '../../supabaseDiff';\n";
if (!code.includes(importSupabase)) {
  code = importSupabase + code;
}

// ... actually I should rewrite the whole file for safety, let's just write a script to replace the functions.
