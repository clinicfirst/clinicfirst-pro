import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const URL = 'http://localhost:3000';
  const CLINICFIRST_AI_TOOL_SECRET = process.env.CLINICFIRST_AI_TOOL_SECRET || 'test-secret';
  
  const today = new Date();
  while(today.getDay() !== 1) { today.setDate(today.getDate() + 1); }
  const dateStr = today.toISOString().split('T')[0];
  
  const headers = { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${CLINICFIRST_AI_TOOL_SECRET}`
  };
  const url = `${URL}/api/voice/webhook/sarvam/sarvam_agent_123`;

  console.log('\n--- 1. Cancel exact appt 09:25 ---');
  let res = await fetch(url, {
    method: 'POST', headers,
    body: JSON.stringify({
      tool: 'cancel_appointment', patient_phone: '9876543211', date: dateStr, time: '09:25'
    })
  });
  console.log(await res.json());

  console.log('\n--- 2. Try to cancel 09:25 again (Already Cancelled idempotency check) ---');
  res = await fetch(url, {
    method: 'POST', headers,
    body: JSON.stringify({
      tool: 'cancel_appointment', patient_phone: '9876543211', date: dateStr, time: '09:25'
    })
  });
  console.log(await res.json());

  console.log('\n--- 3. Cancel the other one (10:15) without time (should succeed as only 1 active left) ---');
  res = await fetch(url, {
    method: 'POST', headers,
    body: JSON.stringify({
      tool: 'cancel_appointment', patient_phone: '9876543211', date: dateStr
    })
  });
  console.log(await res.json());

  console.log('\n--- 4. Try to cancel when all are already cancelled ---');
  res = await fetch(url, {
    method: 'POST', headers,
    body: JSON.stringify({
      tool: 'cancel_appointment', patient_phone: '9876543211', date: dateStr
    })
  });
  console.log(await res.json());
}
run().catch(console.error);
