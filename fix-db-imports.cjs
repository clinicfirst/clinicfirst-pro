const fs = require('fs');

let dbTs = fs.readFileSync('server/db.ts', 'utf8');
dbTs = dbTs.replace(/import \{ syncToSupabase, fetchFromSupabase, setLastSyncedState \} from '\.\/supabaseDiff';/g, '');
dbTs = dbTs.replace(/syncToSupabase\(payload\);/g, '// syncToSupabase(payload);');
dbTs = dbTs.replace(/setLastSyncedState\(this\.data\);/g, '// setLastSyncedState(this.data);');
dbTs = dbTs.replace(/const supabaseData = await fetchFromSupabase\(\);/g, 'const supabaseData = null; // Removed');

fs.writeFileSync('server/db.ts', dbTs);
