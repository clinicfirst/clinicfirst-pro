const fs = require('fs');
let code = fs.readFileSync('server/db.ts', 'utf-8');
code = code.replace(
  'private data: DatabaseSchema;',
  'public data: DatabaseSchema;'
);
fs.writeFileSync('server/db.ts', code);
console.log('Patched');
