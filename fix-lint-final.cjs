const fs = require('fs');

// auth.routes.ts
let auth = fs.readFileSync('server/routes/auth.routes.ts', 'utf8');
auth = auth.replace(/await UserService\.updateUser\(user\.id, \{([\s\S]*?)password_hash: hashPassword\(String\(newPassword\)\.trim\(\)\),([\s\S]*?)\}/g, 
'await UserService.updateUser(user.id, {$1password_hash: hashPassword(String(newPassword).trim()),$2} as any');
auth = auth.replace(/await UserService\.update\(user\.id, \{([\s\S]*?)password_hash: hashPassword\(String\(newPassword\)\.trim\(\)\)([\s\S]*?)\} as any/g, 
'await UserService.update(user.id, {$1password_hash: hashPassword(String(newPassword).trim())$2} as any');
fs.writeFileSync('server/routes/auth.routes.ts', auth);

// clinic.routes.ts line 1222
let clinicLines = fs.readFileSync('server/routes/clinic.routes.ts', 'utf8').split('\n');
clinicLines = clinicLines.map(line => {
  if (line.includes('const appointments = (await AppointmentService.list(clinicId)).filter')) {
    // maybe it is `const appointments = await AppointmentService.list(clinicId).filter` instead
    return line.replace(/await AppointmentService\.list\(clinicId\)\.filter/g, '(await AppointmentService.list(clinicId)).filter');
  }
  // Let's replace ANY `await AppointmentService.list(...).filter` in the file just in case
  if (line.includes('await AppointmentService.list') && line.includes('.filter')) {
     return line.replace(/await AppointmentService\.list\((.*?)\)\.filter/g, '(await AppointmentService.list($1)).filter');
  }
  return line;
});
fs.writeFileSync('server/routes/clinic.routes.ts', clinicLines.join('\n'));

// create-appointment.ts
let create = fs.readFileSync('server/voice/tools/create-appointment.ts', 'utf8');
let lines = create.split('\n');
let newLines = [];
let seen = new Set();
for (let line of lines) {
  if (line.startsWith('import { AppointmentService }')) {
    if (seen.has('AppointmentService')) continue;
    seen.add('AppointmentService');
  }
  newLines.push(line);
}
fs.writeFileSync('server/voice/tools/create-appointment.ts', newLines.join('\n'));

