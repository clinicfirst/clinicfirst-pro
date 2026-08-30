import { config } from 'dotenv';
config();
import fetch from 'node-fetch';
import { generateToken } from '../server/auth';
import { db } from '../server/db';

async function run() {
  const URL = 'http://localhost:3000';
  
  // Get Clinic A config
  const adminA = db.data.users.find(u => u.email === 'admin@apexclinic.com');
  const tokenA = generateToken(adminA!);

  let resA = await fetch(`${URL}/api/clinic/me/ai-widget-config`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  console.log('Clinic A -> Agent A result:', await resA.json());

  // Get Clinic B config
  const adminB = db.data.users.find(u => u.email === 'admin@clinic.com');
  const tokenB = generateToken(adminB!);

  let resB = await fetch(`${URL}/api/clinic/me/ai-widget-config`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  console.log('Clinic B -> Agent B result:', await resB.json());
  
  // Attack Test
  let resAttack = await fetch(`${URL}/api/clinic/me/ai-widget-config?clinic_id=clinic_1787923240249_cqgw`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  console.log('Clinic A -> Attack Clinic B result:', await resAttack.json());

}
run().catch(console.error);
