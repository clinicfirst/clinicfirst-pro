const fs = require('fs');

let clinic = fs.readFileSync('server/routes/clinic.routes.ts', 'utf8');
clinic = clinic.replace(/const enrichedAppointments = allAppointments\.map\(\(apt\) => \{/g, 'const enrichedAppointments = await Promise.all(allAppointments.map(async (apt) => {');
// Wait, map returns an array of promises now. So we must use await Promise.all()
// We also have another map for appointments
clinic = clinic.replace(/const enrichedAppointments = appointments\.map\(\(apt\) => \{/g, 'const enrichedAppointments = await Promise.all(appointments.map(async (apt) => {');

// Fix Set maps: const myPatientIds = new Set((await AppointmentService.list(clinicId, { doctor_id: req.user.doctor_id })).map(a => a.patient_id));
clinic = clinic.replace(/const myPatientIds = new Set\(await AppointmentService\.list\(clinicId, \{ doctor_id: req\.user\.doctor_id \}\)\.map\(a => a\.patient_id\)\);/g, 'const myPatientIds = new Set((await AppointmentService.list(clinicId, { doctor_id: req.user.doctor_id })).map(a => a.patient_id));');

clinic = clinic.replace(/const appointments = await AppointmentService\.list\(clinicId\)\.filter\(\(a\) => a\.patient_id === patientId\);/g, 'const appointments = (await AppointmentService.list(clinicId)).filter((a) => a.patient_id === patientId);');

fs.writeFileSync('server/routes/clinic.routes.ts', clinic);

let voice = fs.readFileSync('server/routes/voice.routes.ts', 'utf8');
// Fix await DoctorService.getById in synchronous contexts in voice.routes.ts.
// Actually let's just make sure those are inside async functions or we change map to Promise.all.
// Let's replace the inline doctor lookup with just keeping existingAppt.doctor_id for now, or fetch earlier.
// Wait, in voice.routes.ts lines 315 and 427, it's inside `allAppts.map(...)`.
voice = voice.replace(/return \{\s*...a,\s*doctor: \(await DoctorService\.getById\(clinic_id, a\.doctor_id\)\)\?.name,\s*\};/g, 
  "const doctor = await DoctorService.getById(clinic_id, a.doctor_id); return { ...a, doctor: doctor?.name };");
voice = voice.replace(/allAppts\.map\(a => \{/g, 'await Promise.all(allAppts.map(async a => {');
voice = voice.replace(/allAppts\.map\(\(a\) => \{/g, 'await Promise.all(allAppts.map(async (a) => {');
// But the closing bracket is '})' which maps to Promise.all ... })
voice = voice.replace(/doctor: \(await DoctorService\.getById\(clinic_id, existingAppt\.doctor_id\)\)\?.name/g, "doctor: (await DoctorService.getById(clinic_id, existingAppt.doctor_id))?.name"); // It is async already?

fs.writeFileSync('server/routes/voice.routes.ts', voice);
