const fs = require('fs');

// Fix duplicates
function removeDuplicateImports(file) {
  let content = fs.readFileSync(file, 'utf8');
  let lines = content.split('\n');
  let seen = new Set();
  let newLines = [];
  for (let line of lines) {
    if (line.startsWith('import {')) {
      if (seen.has(line)) continue;
      seen.add(line);
    }
    newLines.push(line);
  }
  fs.writeFileSync(file, newLines.join('\n'));
}

['server/routes/auth.routes.ts', 'server/routes/clinic.routes.ts', 'server/routes/platform.routes.ts', 'server/routes/knowledgeCompiler.routes.ts', 'server/routes/voice.routes.ts', 'server/voice/tools/create-appointment.ts'].forEach(removeDuplicateImports);

// Fix auth.routes.ts
let auth = fs.readFileSync('server/routes/auth.routes.ts', 'utf8');
auth = auth.replace(/await AppointmentService\.list\(firstClinic\.id, \{ date: today \}\)\.length/g, '(await AppointmentService.list(firstClinic.id, { date: today })).length');
auth = auth.replace(/const user = await UserService\.getByEmail/g, 'const user: any = await UserService.getByEmail');
auth = auth.replace(/const updated = await UserService\.updateUser\(user\.id, \{/g, 'const updated: any = await UserService.updateUser(user.id, {');
auth = auth.replace(/user\.password_hash/g, '(user as any).password_hash');
auth = auth.replace(/const updated = await UserService\.update\(user\.id, \{/g, 'const updated: any = await UserService.update(user.id, {');
fs.writeFileSync('server/routes/auth.routes.ts', auth);

// Fix clinic.routes.ts
let clinic = fs.readFileSync('server/routes/clinic.routes.ts', 'utf8');
clinic = clinic.replace(/const enrichedAppointments = appointments\.map\(\(apt\) => \{/g, 'const enrichedAppointments = await Promise.all(appointments.map(async (apt) => {');
clinic = clinic.replace(/          service_duration: service\?\.duration_minutes \|\| 30,\n        \};\n      \}\);/g, `          service_duration: service?.duration_minutes || 30,\n        };\n      }));`);
clinic = clinic.replace(/const appointments = await AppointmentService\.list\(clinicId\)\.filter/g, 'const appointments = (await AppointmentService.list(clinicId)).filter');
fs.writeFileSync('server/routes/clinic.routes.ts', clinic);

// Fix voice.routes.ts
let voice = fs.readFileSync('server/routes/voice.routes.ts', 'utf8');
voice = voice.replace(/allAppts\.map\(\(a\) => \{/g, 'await Promise.all(allAppts.map(async (a) => {');
voice = voice.replace(/const doctor = await DoctorService\.getById\(clinic_id, a\.doctor_id\); return \{ \.\.\.a, doctor: doctor\?\.name \};\n        \}\)/g, 
`const doctor = await DoctorService.getById(clinic_id, a.doctor_id); return { ...a, doctor: doctor?.name };
        }))`);
fs.writeFileSync('server/routes/voice.routes.ts', voice);

// Fix voice-engine.ts imports
let engine = fs.readFileSync('server/voice/voice-engine.ts', 'utf8');
engine = engine.replace(/import \{ db \} from '\.\.\/\.\.\/db';/g, "import { db } from '../db';");
engine = engine.replace(/import \{ ClinicService \} from '\.\.\/\.\.\/services\/clinic\.service';/g, "import { ClinicService } from '../services/clinic.service';");
engine = engine.replace(/import \{ AppointmentService \} from '\.\.\/\.\.\/services\/appointment\.service';/g, "import { AppointmentService } from '../services/appointment.service';");
fs.writeFileSync('server/voice/voice-engine.ts', engine);

