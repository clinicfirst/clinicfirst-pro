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

  console.log('\n--- 1. Reschedule exact appt (10:15 -> 10:40 on same day) ---');
  let res = await fetch(url, {
    method: 'POST', headers,
    body: JSON.stringify({
      tool: 'reschedule_appointment', patient_phone: '9876543211', old_date: dateStr, old_time: '10:15', new_date: dateStr, new_time: '10:40'
    })
  });
  console.log(await res.json());

  console.log('\n--- 2. Reschedule again (Idempotency check) ---');
  res = await fetch(url, {
    method: 'POST', headers,
    body: JSON.stringify({
      tool: 'reschedule_appointment', patient_phone: '9876543211', old_date: dateStr, old_time: '10:15', new_date: dateStr, new_time: '10:40'
    })
  });
  console.log(await res.json());
}
run().catch(console.error);
