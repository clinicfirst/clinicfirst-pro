import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const URL = 'http://localhost:3000';
  const CLINICFIRST_AI_TOOL_SECRET = process.env.CLINICFIRST_AI_TOOL_SECRET || 'test-secret';
  
  const today = new Date();
  while(today.getDay() !== 1) { // next monday
    today.setDate(today.getDate() + 1);
  }
  const dateStr = today.toISOString().split('T')[0];

  console.log('Testing new booking on', dateStr, 'at 14:00');

  // Successful booking
  let res2 = await fetch(`${URL}/api/voice/webhook/sarvam/sarvam_agent_123`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CLINICFIRST_AI_TOOL_SECRET}`
    },
    body: JSON.stringify({
      tool: 'book_appointment',
      patient_name: 'Rahul Second',
      patient_phone: '9876543211', // different phone
      service: 'General Health',
      doctor: 'Elena',
      date: dateStr,
      time: '14:00'
    })
  });
  console.log('Success Booking:', await res2.json());

  // Idempotency check
  let res3 = await fetch(`${URL}/api/voice/webhook/sarvam/sarvam_agent_123`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CLINICFIRST_AI_TOOL_SECRET}`
    },
    body: JSON.stringify({
      tool: 'book_appointment',
      patient_name: 'Rahul Second',
      patient_phone: '9876543211', // same phone
      service: 'General Health',
      doctor: 'Elena',
      date: dateStr,
      time: '14:00' // same time
    })
  });
  console.log('Idempotent Booking:', await res3.json());
  
  // Double booking check (different patient)
  let res4 = await fetch(`${URL}/api/voice/webhook/sarvam/sarvam_agent_123`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CLINICFIRST_AI_TOOL_SECRET}`
    },
    body: JSON.stringify({
      tool: 'book_appointment',
      patient_name: 'Priya Different',
      patient_phone: '9998887776',
      service: 'General Health',
      doctor: 'Elena',
      date: dateStr,
      time: '14:00' // same time, different patient -> should fail
    })
  });
  console.log('Double Booking Prevention:', await res4.json());
  
}
run().catch(console.error);
