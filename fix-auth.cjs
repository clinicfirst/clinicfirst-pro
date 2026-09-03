const fs = require('fs');
let auth = fs.readFileSync('server/routes/auth.routes.ts', 'utf8');
auth = auth.replace(/const updated: any = await UserService\.update\(user\.id, \{\n\s*password_hash: newHash,\n\s*must_change_password: false,\n\s*\}\);/g, 
`const updated: any = await UserService.update(user.id, {
      password_hash: newHash,
      must_change_password: false,
    } as any);`);
fs.writeFileSync('server/routes/auth.routes.ts', auth);

let create = fs.readFileSync('server/voice/tools/create-appointment.ts', 'utf8');
create = create.replace(/import \{ AppointmentService \} from '\.\.\/\.\.\/services\/appointment\.service';\n/g, '');
fs.writeFileSync('server/voice/tools/create-appointment.ts', create);
