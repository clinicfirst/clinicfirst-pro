const fs = require('fs');
let db = fs.readFileSync('server/db.ts', 'utf8');

if (!db.includes('import { isOfflineMode }')) {
  db = db.replace(/import crypto from 'crypto';/, "import crypto from 'crypto';\nimport { isOfflineMode } from './supabaseDiff';");
}

db = db.replace(/private saveDatabase\(dataToSave\?: DatabaseSchema\) \{([\s\S]*?)try \{/g, 
`private saveDatabase(dataToSave?: DatabaseSchema) {$1if (!isOfflineMode) return;\n    try {`);

db = db.replace(/private loadDatabase\(\) \{([\s\S]*?)if \(IS_VERCEL/g, 
`private loadDatabase() {$1if (!isOfflineMode) return this.generateSeedData();\n    if (IS_VERCEL`);

fs.writeFileSync('server/db.ts', db);
