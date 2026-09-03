const fs = require('fs');
let db = fs.readFileSync('server/db.ts', 'utf8');
db = db.replace(/import initialFallbackJson from '\.\.\/data\/clinicfirst\.json';/, 'const initialFallbackJson: any = {};');
fs.writeFileSync('server/db.ts', db);
