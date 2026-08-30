import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const URL = 'http://localhost:3000';
  const CLINICFIRST_AI_TOOL_SECRET = process.env.CLINICFIRST_AI_TOOL_SECRET || 'test-secret';
  
  const clinicB_id = 'clinic_1787923240249_cqgw';
  
  console.log('✅ Setup complete');

  // Test 1: Agent A, check Dental Consultation on today
  const today = new Date().toISOString().split('T')[0];
  let resA = await fetch(`${URL}/api/voice/webhook/sarvam/sarvam_agent_123`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CLINICFIRST_AI_TOOL_SECRET}`
    },
    body: JSON.stringify({
      tool: 'check_availability',
      service: 'General Checkup',
      date: today
    })
  });
  console.log('Agent A (Valid service):', resA.status, await resA.json());

  // Test 2: Agent A, invalid service
  let resA2 = await fetch(`${URL}/api/voice/webhook/sarvam/sarvam_agent_123`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CLINICFIRST_AI_TOOL_SECRET}`
    },
    body: JSON.stringify({
      tool: 'check_availability',
      service: 'MRI Scan',
      date: today
    })
  });
  console.log('Agent A (Invalid service):', resA2.status, await resA2.json());

  // Test 3: Agent B with Agent A's provider_agent_id (Attack simulation)
  let resAttack = await fetch(`${URL}/api/voice/webhook/sarvam/sarvam_agent_123`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CLINICFIRST_AI_TOOL_SECRET}`
    },
    body: JSON.stringify({
      tool: 'check_availability',
      service: 'General Checkup',
      date: today,
      clinic_id: clinicB_id
    })
  });
  console.log('Agent A (clinic_id injected in payload):', resAttack.status, await resAttack.json());

  // Test 4: Missing Bearer Token
  let resNoToken = await fetch(`${URL}/api/voice/webhook/sarvam/sarvam_agent_123`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      tool: 'check_availability',
      service: 'General Checkup',
      date: today
    })
  });
  console.log('Missing Token:', resNoToken.status, await resNoToken.json());
  
  // Test 5: Unknown Agent ID
  let resUnknownAgent = await fetch(`${URL}/api/voice/webhook/sarvam/sarvam_agent_999`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CLINICFIRST_AI_TOOL_SECRET}`
    },
    body: JSON.stringify({
      tool: 'check_availability',
      service: 'General Checkup',
      date: today
    })
  });
  console.log('Unknown Agent:', resUnknownAgent.status, await resUnknownAgent.json());

  // Test 6: Check availability for doctor by name
  let resDoctor = await fetch(`${URL}/api/voice/webhook/sarvam/sarvam_agent_123`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CLINICFIRST_AI_TOOL_SECRET}`
    },
    body: JSON.stringify({
      tool: 'check_availability',
      doctor: 'Smith', // We need a real doctor name, but we will see what happens
      date: today
    })
  });
  console.log('Agent A (Doctor Name match):', resDoctor.status, await resDoctor.json());

}
run().catch(console.error);
