import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const URL = 'http://localhost:3000';
  const CLINICFIRST_AI_TOOL_SECRET = process.env.CLINICFIRST_AI_TOOL_SECRET || 'test-secret';
  
  const today = new Date();
  while(today.getDay() !== 1) {
    today.setDate(today.getDate() + 1);
  }
  const dateStr = today.toISOString().split('T')[0];
  
  const headers = { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${CLINICFIRST_AI_TOOL_SECRET}`
  };
  
  const url = `${URL}/api/voice/webhook/sarvam/sarvam_agent_123`;

  console.log('\n--- 1. Testing No Appointment Found ---');
  let res = await fetch(url, {
    method: 'POST', headers,
    body: JSON.stringify({
      tool: 'cancel_appointment',
      patient_phone: '9998887776', // Different patient from our previous bookings
      date: dateStr
    })
  });
  console.log(await res.json());

  console.log('\n--- 2. Testing Ambiguous Cancellation (No Date/Time provided) ---');
  // Need to make sure Rahul Second has > 1 appt, or just see if the one we booked works.
  // We booked Rahul Second at 11:00 and 14:00 (if we ran both scripts)
  res = await fetch(url, {
    method: 'POST', headers,
    body: JSON.stringify({
      tool: 'cancel_appointment',
      patient_phone: '9876543211',
    })
  });
  console.log(await res.json());

  console.log('\n--- 3. Testing Valid Cancellation (Date + Time provided) ---');
  res = await fetch(url, {
    method: 'POST', headers,
    body: JSON.stringify({
      tool: 'cancel_appointment',
      patient_phone: '9876543211',
      date: dateStr,
      time: '14:00'
    })
  });
  console.log(await res.json());

  console.log('\n--- 4. Testing Already Cancelled Idempotency ---');
  res = await fetch(url, {
    method: 'POST', headers,
    body: JSON.stringify({
      tool: 'cancel_appointment',
      patient_phone: '9876543211',
      date: dateStr,
      time: '14:00'
    })
  });
  console.log(await res.json());
}
run().catch(console.error);
