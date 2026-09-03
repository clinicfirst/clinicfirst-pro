const fs = require('fs');

let clinic = fs.readFileSync('server/routes/clinic.routes.ts', 'utf8');

clinic = clinic.replace(/const items = appointments\n        \.map\(\(apt\) => \{/g, 'const items = await Promise.all(appointments\n        .map(async (apt) => {');
// we also need to close it with `}))` instead of `})`
// let's find the end of that map block, which is followed by `.filter(i => i.status !== 'CANCELLED')` probably?
// Wait, is it `return { ... }; });`?
// Let's replace the end:
clinic = clinic.replace(/          \};\n        \}\);/g, '          };\n        }));');

// fix line 1222:
clinic = clinic.replace(/const appointments = await AppointmentService\.list\(clinicId\)\.filter\(\(a\) => a\.patient_id === patientId\);/g, 'const appointments = (await AppointmentService.list(clinicId)).filter((a) => a.patient_id === patientId);');

fs.writeFileSync('server/routes/clinic.routes.ts', clinic);

// auth.routes.ts
let auth = fs.readFileSync('server/routes/auth.routes.ts', 'utf8');
auth = auth.replace(/password_hash: hashPassword\(String\(newPassword\)\.trim\(\)\),\n\s*\}/g, 'password_hash: hashPassword(String(newPassword).trim()),\n      } as any');
fs.writeFileSync('server/routes/auth.routes.ts', auth);

// create-appointment.ts
let create = fs.readFileSync('server/voice/tools/create-appointment.ts', 'utf8');
let createLines = create.split('\n');
let seen = new Set();
let newLines = [];
for (let line of createLines) {
  if (line.trim().startsWith('import {')) {
    if (seen.has(line)) continue;
    seen.add(line);
  }
  newLines.push(line);
}
fs.writeFileSync('server/voice/tools/create-appointment.ts', newLines.join('\n'));

