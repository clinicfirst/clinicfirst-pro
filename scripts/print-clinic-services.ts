import { db } from '../server/db';
async function run() {
  await db.ensureHydrated();
  const clinicId = 'clinic_apex_101';
  console.log('Services:', db.getServices(clinicId).map(s => s.name));
  console.log('Doctors:', db.getDoctors(clinicId).map(d => d.name));
}
run();
