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

  console.log('Testing book_appointment on', dateStr);

  // Missing info
  let res1 = await fetch(`${URL}/api/voice/webhook/sarvam/sarvam_agent_123`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CLINICFIRST_AI_TOOL_SECRET}`
    },
    body: JSON.stringify({
      tool: 'book_appointment',
      // missing patient_name etc.
    })
  });
  console.log('Missing info:', await res1.json());

  // Successful booking
  let res2 = await fetch(`${URL}/api/voice/webhook/sarvam/sarvam_agent_123`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CLINICFIRST_AI_TOOL_SECRET}`
    },
    body: JSON.stringify({
      tool: 'book_appointment',
      patient_name: 'Rahul Test',
      patient_phone: '9876543210',
      service: 'General Health',
      doctor: 'Elena',
      date: dateStr,
      time: '09:00'
    })
  });
  const res2json = await res2.json();
  console.log('Success Booking:', res2json);

  // Idempotency check
  let res3 = await fetch(`${URL}/api/voice/webhook/sarvam/sarvam_agent_123`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CLINICFIRST_AI_TOOL_SECRET}`
    },
    body: JSON.stringify({
      tool: 'book_appointment',
      patient_name: 'Rahul Test',
      patient_phone: '9876543210',
      service: 'General Health',
      doctor: 'Elena',
      date: dateStr,
      time: '09:00' // same time
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
      time: '09:00' // same time, different patient -> should fail
    })
  });
  console.log('Double Booking Prevention:', await res4.json());
  
}
run().catch(console.error);
