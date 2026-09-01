import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const URL = 'http://localhost:3000';
  const CLINICFIRST_AI_TOOL_SECRET = process.env.CLINICFIRST_AI_TOOL_SECRET || 'test-secret';
  
  const today = new Date();
  while(today.getDay() !== 1) { today.setDate(today.getDate() + 1); }
  const dateStr = today.toISOString().split('T')[0];
  const nextDateStr = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const headers = { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${CLINICFIRST_AI_TOOL_SECRET}`
  };
  const url = `${URL}/api/voice/webhook/sarvam/sarvam_agent_123`;

  console.log('\n--- 1. Book Appt 1 at 09:25 ---');
  await fetch(url, {
    method: 'POST', headers,
    body: JSON.stringify({
      tool: 'book_appointment', patient_name: 'Rahul Second', patient_phone: '9876543211',
      service: 'General Health', doctor: 'Elena', date: dateStr, time: '09:25'
    })
  });

  console.log('\n--- 2. Try Reschedule (Missing old time - Ambiguous) ---');
  let res = await fetch(url, {
    method: 'POST', headers,
    body: JSON.stringify({
      tool: 'reschedule_appointment', patient_phone: '9876543211', old_date: dateStr, new_date: nextDateStr, new_time: '10:00'
    })
  });
  console.log(JSON.stringify(await res.json(), null, 2));

  console.log('\n--- 3. Reschedule exact appt (09:25 -> 10:15 on same day) ---');
  res = await fetch(url, {
    method: 'POST', headers,
    body: JSON.stringify({
      tool: 'reschedule_appointment', patient_phone: '9876543211', old_date: dateStr, old_time: '09:25', new_date: dateStr, new_time: '10:15'
    })
  });
  console.log(await res.json());

  console.log('\n--- 4. Reschedule again (Idempotency check) ---');
  res = await fetch(url, {
    method: 'POST', headers,
    body: JSON.stringify({
      tool: 'reschedule_appointment', patient_phone: '9876543211', old_date: dateStr, old_time: '09:25', new_date: dateStr, new_time: '10:15'
    })
  });
  console.log(await res.json());
}
run().catch(console.error);
