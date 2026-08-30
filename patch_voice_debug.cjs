const fs = require('fs');
let code = fs.readFileSync('server/routes/voice.routes.ts', 'utf-8');

code = code.replace(
  "const exactSlot = slotsResponse.slots.find(s => s.time === time && (!resolvedDoctorId || s.doctorId === resolvedDoctorId));",
  "const exactSlot = slotsResponse.slots.find(s => s.time === time && (!resolvedDoctorId || s.doctorId === resolvedDoctorId));\n      console.log('Searching for time:', time, 'resolvedDoctorId:', resolvedDoctorId, 'slots sample:', slotsResponse.slots.slice(0, 5));"
);

fs.writeFileSync('server/routes/voice.routes.ts', code);
console.log('Patched for debug');
