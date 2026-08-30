import { config } from 'dotenv';
config();
import fetch from 'node-fetch';
import { generateToken } from '../server/auth';
import { db } from '../server/db';

async function run() {
  const URL = 'http://localhost:3000';
  
  // Set up Clinic A
  const clinicA_id = 'clinic_apex_101';
  let agentA = db.data.ai_agents.find(a => a.clinic_id === clinicA_id);
  if (agentA) {
    agentA.status = 'ACTIVE';
    agentA.provider_agent_id = 'sarvam_agent_A_real';
  }
  const adminA = db.data.users.find(u => u.email === 'admin@apexclinic.com');
  const tokenA = generateToken(adminA!);

  // Set up Clinic B
  const clinicB_id = 'clinic_1787923240249_cqgw';
  let agentB = db.data.ai_agents.find(a => a.clinic_id === clinicB_id);
  if (agentB) {
    agentB.status = 'ACTIVE';
    agentB.provider_agent_id = 'sarvam_agent_B_test';
  }
  const adminB = db.data.users.find(u => u.email === 'admin@clinic.com');
  const tokenB = generateToken(adminB!);

  // Make sure platform AI is active
  db.data.platform_ai_config!.status = 'ACTIVE';
  db.flush();

  console.log('✅ Setup complete');

  // Test 1: Clinic A -> Agent A
  let resA = await fetch(`${URL}/api/clinic/me/ai-widget-config`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  console.log('Clinic A config:', await resA.json());

  // Test 2: Clinic B -> Agent B
  let resB = await fetch(`${URL}/api/clinic/me/ai-widget-config`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  console.log('Clinic B config:', await resB.json());

  // Test 3: Attack Clinic A -> Clinic B
  let resAttack = await fetch(`${URL}/api/clinic/me/ai-widget-config?clinic_id=${clinicB_id}`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  console.log('Attack Clinic A -> Clinic B result:', await resAttack.json());

  // Test 4: Disable Platform AI
  db.data.platform_ai_config!.status = 'INACTIVE';
  db.flush();

  let resDisabled = await fetch(`${URL}/api/clinic/me/ai-widget-config`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  console.log('Platform Disabled result (Status: ' + resDisabled.status + '):', await resDisabled.json());

  // Restore Platform AI
  db.data.platform_ai_config!.status = 'ACTIVE';
  db.flush();
}
run().catch(console.error);
