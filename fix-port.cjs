const fs = require('fs');
let server = fs.readFileSync('server.ts', 'utf8');
server = server.replace(/const PORT = parseInt\(process\.env\.PORT \|\| '3000'\);/g, 'const PORT = 3000;');
fs.writeFileSync('server.ts', server);
