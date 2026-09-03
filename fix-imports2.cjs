const fs = require('fs');
let clinic = fs.readFileSync('server/routes/clinic.routes.ts', 'utf8');
clinic = clinic.replace(/import \{ isSarvamApiConfigured \} from '\.\.\/config\/sarvam';\s+validateReceptionistPreferences,\s+generateSafeGreeting,\s+validateGreetingContent,\s+\} from '\.\.\/services\/aiValidator';/m, 
`import { isSarvamApiConfigured } from '../config/sarvam';
import {
  validateReceptionistPreferences,
  generateSafeGreeting,
  validateGreetingContent,
} from '../services/aiValidator';`);

// Fix synchronous maps in clinic.routes.ts line 565
clinic = clinic.replace(/const enrichedAppointments = await Promise\.all\(appointments\.map\(async \(apt\) => \{([\s\S]*?)service_duration: service\?\.duration_minutes \|\| 30,\n        \};\n      \}\)\);/g, 
`const enrichedAppointments = await Promise.all(appointments.map(async (apt) => {$1service_duration: service?.duration_minutes || 30,\n        };\n      }));`);

// Wait, the previous replace was:
// clinic = clinic.replace(/const enrichedAppointments = appointments\.map\(\(apt\) => \{/g, 'const enrichedAppointments = await Promise.all(appointments.map(async (apt) => {');
// If that failed, let's fix it by regex:
clinic = clinic.replace(/\.map\(\(apt\) => \{[\s\S]*?const patient = apt\.patient \|\| patientMap\.get\(apt\.patient_id\) \|\| await PatientService\.getById\(clinicId, apt\.patient_id\);/g, (match) => {
  return match;
}); // just checking if it is already async

fs.writeFileSync('server/routes/clinic.routes.ts', clinic);

// Fix voice.routes.ts map around 317 and 427
let voice = fs.readFileSync('server/routes/voice.routes.ts', 'utf8');
voice = voice.replace(/matching_appointments: activeAppts\.map\(a => \(\{/g, 'matching_appointments: await Promise.all(activeAppts.map(async a => ({');
voice = voice.replace(/doctor: \(await DoctorService\.getById\(clinic_id, a\.doctor_id\)\)\?.name,/g, 'doctor: (await DoctorService.getById(clinic_id, a.doctor_id))?.name,');
voice = voice.replace(/\}\)\),/g, '})))'); // this is very brittle, let's do it manually via regex
fs.writeFileSync('server/routes/voice.routes.ts', voice);
