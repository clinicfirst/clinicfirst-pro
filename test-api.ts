import { db } from './server/db.ts';

const clinicId = "clinic_apex"; // Assuming standard clinic ID
const today = new Date().toISOString().split('T')[0];
const appointments = db.getAppointments(clinicId, { date: today });
console.log(JSON.stringify(appointments, null, 2));
