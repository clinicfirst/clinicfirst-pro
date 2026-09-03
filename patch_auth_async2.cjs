const fs = require('fs');
let code = fs.readFileSync('server/auth.ts', 'utf8');

code = code.replace(
  "const { UserService } = require('./services/user.service');",
  ""
);

code = code.replace(
  "import { db } from './db';",
  "import { db } from './db';\nimport { UserService } from './services/user.service';"
);

fs.writeFileSync('server/auth.ts', code);
console.log('patched auth.ts imports');
