import { config } from 'dotenv';
config();
import fetch from 'node-fetch';

async function run() {
  const URL = 'http://localhost:3000';
  
  // Login as testadmin@apexclinic.com
  let res = await fetch(`${URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'testadmin@apexclinic.com', password: 'password123' })
  });
  if (!res.ok) {
    console.log('Login failed', await res.text());
    return;
  }
  const { token, clinic } = (await res.json()) as any;
  const clinicId = clinic.id;
  console.log('✅ Logged in as testadmin (Clinic A). Clinic ID:', clinicId);

  // Test 1: Get agent config correctly
  res = await fetch(`${URL}/api/clinic/me/ai-widget-config`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('Test 1 - Clinic A -> Clinic A agent config:', res.status, await res.json());

  // Test 2: Try to pass clinic_id in query params to get another clinic's config
  res = await fetch(`${URL}/api/clinic/me/ai-widget-config?clinic_id=clinic_1787923240249_cqgw`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('Test 2 - Clinic A passing clinic_id in query (should ignore and return Clinic A):', res.status, await res.json());

  // Test 3: Unauthenticated request
  res = await fetch(`${URL}/api/clinic/me/ai-widget-config`);
  console.log('Test 3 - Unauthenticated request:', res.status, await res.json());
}
run().catch(console.error);
