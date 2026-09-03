const fs = require('fs');

// 1. auth.routes.ts
let auth = fs.readFileSync('server/routes/auth.routes.ts', 'utf8');
auth = auth.replace(/password_hash:\s*hashPassword\(String\(newPassword\)\.trim\(\)\),\n\s*\}/g, 'password_hash: hashPassword(String(newPassword).trim()),\n      } as any');
fs.writeFileSync('server/routes/auth.routes.ts', auth);

// 2 & 3. clinic.routes.ts
let clinic = fs.readFileSync('server/routes/clinic.routes.ts', 'utf8');
clinic = clinic.replace(/const enrichedAppointments = appointments\.map\(\(apt\) => \{/g, 'const enrichedAppointments = await Promise.all(appointments.map(async (apt) => {');
clinic = clinic.replace(/          service_duration: service\?\.duration_minutes \|\| 30,\n        \};\n      \}\);/g, `          service_duration: service?.duration_minutes || 30,\n        };\n      }));`);
clinic = clinic.replace(/const appointments = await AppointmentService\.list\(clinicId\)\.filter/g, 'const appointments = (await AppointmentService.list(clinicId)).filter');
fs.writeFileSync('server/routes/clinic.routes.ts', clinic);

// 4. voice/tools/create-appointment.ts
let create = fs.readFileSync('server/voice/tools/create-appointment.ts', 'utf8');
let createLines = create.split('\n');
let seen = new Set();
let newLines = [];
for (let line of createLines) {
  if (line.startsWith('import {')) {
    if (seen.has(line)) continue;
    seen.add(line);
  }
  newLines.push(line);
}
fs.writeFileSync('server/voice/tools/create-appointment.ts', newLines.join('\n'));

