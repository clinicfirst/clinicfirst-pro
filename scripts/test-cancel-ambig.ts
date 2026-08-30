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

  console.log('\n--- 1. Book Appt 1 at 09:25 ---');
  await fetch(url, {
    method: 'POST', headers,
    body: JSON.stringify({
      tool: 'book_appointment', patient_name: 'Rahul Second', patient_phone: '9876543211',
      service: 'General Health', doctor: 'Elena', date: dateStr, time: '09:25'
    })
  });

  console.log('\n--- 2. Book Appt 2 at 10:15 ---');
  await fetch(url, {
    method: 'POST', headers,
    body: JSON.stringify({
      tool: 'book_appointment', patient_name: 'Rahul Second', patient_phone: '9876543211',
      service: 'General Health', doctor: 'Elena', date: dateStr, time: '10:15'
    })
  });

  console.log('\n--- 3. Test Ambiguous Cancellation (No time provided) ---');
  let res = await fetch(url, {
    method: 'POST', headers,
    body: JSON.stringify({
      tool: 'cancel_appointment', patient_phone: '9876543211', date: dateStr
    })
  });
  console.log(JSON.stringify(await res.json(), null, 2));
}
run().catch(console.error);
