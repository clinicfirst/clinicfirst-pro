import { db } from '../server/db';
import { generateToken } from '../server/auth';
import fetch from 'node-fetch';

async function test() {
  const adminUser = db.data.users.find(u => u.role === 'PLATFORM_ADMIN');
  const clinicUser = db.data.users.find(u => u.role === 'CLINIC_ADMIN' && u.clinic_id);
  
  if (!adminUser || !clinicUser) {
    console.error("Missing test users");
    process.exit(1);
  }

  const otherClinicId = db.data.clinics.find(c => c.id !== clinicUser.clinic_id)?.id;
  
  const clinicToken = generateToken(adminUser); // Let's use actual users' tokens
  const cAdminToken = generateToken(clinicUser);
  
  const url = `http://localhost:3000/api/compiler/${clinicUser.clinic_id}/releases`;
  
  // 1. Unauthenticated
  let res = await fetch(url);
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  console.log("Unauthenticated -> 401");

  // 2. Authenticated (correct clinic)
  res = await fetch(url, { headers: { 'Authorization': `Bearer ${cAdminToken}` } });
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  console.log("Clinic Admin -> Own Clinic -> 200");

  // 3. Cross-clinic
  const crossUrl = `http://localhost:3000/api/compiler/${otherClinicId}/releases`;
  res = await fetch(crossUrl, { headers: { 'Authorization': `Bearer ${cAdminToken}` } });
  if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  console.log("Clinic Admin -> Cross-Clinic -> 403");

  // 4. Platform Admin -> Other Clinic
  res = await fetch(crossUrl, { headers: { 'Authorization': `Bearer ${clinicToken}` } });
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  console.log("Platform Admin -> Any Clinic -> 200");

  console.log("ALL TESTS PASSED");
}
test().catch(console.error);
