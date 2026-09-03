const fs = require('fs');

// clinic.routes.ts
let clinic = fs.readFileSync('server/routes/clinic.routes.ts', 'utf8');
clinic = clinic.replace(/const items = await Promise\.all\(/g, 'const items = (await Promise.all(');
clinic = clinic.replace(/\}\)\)\n        \.sort/g, '})))\n        .sort');
clinic = clinic.replace(/const appointments = \(await AppointmentService\.list\(clinicId\)\)\.filter\(/g, 'const appointments = (await AppointmentService.list(clinicId)).filter('); // wait it might be missing parentheses
fs.writeFileSync('server/routes/clinic.routes.ts', clinic);

// auth.routes.ts
let auth = fs.readFileSync('server/routes/auth.routes.ts', 'utf8');
auth = auth.replace(/const updated: any = await UserService\.update\(user\.id, \{([\s\S]*?)password_hash: hashPassword\(String\(newPassword\)\.trim\(\)\),\n      \} as any\);/g, 
'const updated: any = await UserService.update(user.id, {$1password_hash: hashPassword(String(newPassword).trim())} as any);');
fs.writeFileSync('server/routes/auth.routes.ts', auth);

// create-appointment.ts
let create = fs.readFileSync('server/voice/tools/create-appointment.ts', 'utf8');
let lines = create.split('\n');
let newLines = [];
let seen = new Set();
for (let line of lines) {
  if (line.includes('import { AppointmentService }')) {
    if (seen.has('AppointmentService')) continue;
    seen.add('AppointmentService');
  }
  newLines.push(line);
}
fs.writeFileSync('server/voice/tools/create-appointment.ts', newLines.join('\n'));

