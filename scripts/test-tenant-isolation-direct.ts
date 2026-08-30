import { config } from 'dotenv';
config();
import fetch from 'node-fetch';
import { generateToken } from '../server/auth';
import { db } from '../server/db';

async function run() {
  const URL = 'http://localhost:3000';
  
  // Find Clinic Admin for Apex
  const admin = db.data.users.find(u => u.email === 'admin@apexclinic.com');
  const tokenA = generateToken(admin!);
  console.log('✅ Created token for Clinic A (clinic_apex_101)');

  // Unauthenticated test
  let res = await fetch(`${URL}/api/clinic/me/ai-widget-config`);
  console.log('Test Unauthenticated request:', res.status, await res.json());

  // Disabled platform test
  res = await fetch(`${URL}/api/clinic/me/ai-widget-config`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  console.log('Test Disabled Platform ->', res.status, await res.json());
  
}
run().catch(console.error);
