const fs = require('fs');
let code = fs.readFileSync('server/auth.ts', 'utf8');

code = code.replace(
  "export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {",
  "export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {"
);

code = code.replace(
  "const user = db.getUserById(payload.sub);",
  "const { UserService } = require('./services/user.service');\n  const user = await UserService.getById(payload.sub);"
);

fs.writeFileSync('server/auth.ts', code);
console.log('patched auth.ts');
