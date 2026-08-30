import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const URL = 'http://localhost:3000';
  const CLINICFIRST_AI_TOOL_SECRET = process.env.CLINICFIRST_AI_TOOL_SECRET || 'test-secret';
  
  // Find a valid date (e.g. next Monday)
  let date = new Date();
  while(date.getDay() !== 1) {
    date.setDate(date.getDate() + 1);
  }
  const dateStr = date.toISOString().split('T')[0];

  let resA = await fetch(`${URL}/api/voice/webhook/sarvam/sarvam_agent_123`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CLINICFIRST_AI_TOOL_SECRET}`
    },
    body: JSON.stringify({
      tool: 'check_availability',
      service: 'General Health', // fuzzy match
      date: dateStr
    })
  });
  console.log(`Agent A (General Health on ${dateStr}):`, resA.status, JSON.stringify(await resA.json(), null, 2));

  let resDoctor = await fetch(`${URL}/api/voice/webhook/sarvam/sarvam_agent_123`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CLINICFIRST_AI_TOOL_SECRET}`
    },
    body: JSON.stringify({
      tool: 'check_availability',
      doctor: 'Elena', // fuzzy match
      date: dateStr
    })
  });
  console.log(`Agent A (Doctor Elena on ${dateStr}):`, resDoctor.status, JSON.stringify(await resDoctor.json(), null, 2));
}
run().catch(console.error);
