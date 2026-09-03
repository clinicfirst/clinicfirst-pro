const fs = require('fs');
let code = fs.readFileSync('server/auth.ts', 'utf8');

code = code.replace(
  "const user = await UserService.getById(payload.sub);",
  "let user = null;\n  try { user = await UserService.getById(payload.sub); } catch(e) { return res.status(500).json({error: 'Database error validating session'}); }"
);

fs.writeFileSync('server/auth.ts', code);
console.log('patched auth.ts try-catch');
