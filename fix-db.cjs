const fs = require('fs');
let db = fs.readFileSync('server/db.ts', 'utf8');
db = db.replace(/import seedData from '\.\.\/data\/clinicfirst\.json';/, 'const seedData: any = {};');
fs.writeFileSync('server/db.ts', db);
