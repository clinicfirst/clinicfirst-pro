const fetch = require('node-fetch');

async function run() {
  const loginRes = await fetch('http://127.0.0.1:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'reception@apexcardiology.com', password: 'ApexStaff2026!' })
  });
  const loginData = await loginRes.json();
  console.log('Login:', loginData);

  if (!loginData.token) return;

  const apptRes = await fetch('http://127.0.0.1:3000/api/clinic/appointments', {
    headers: { 'Authorization': `Bearer ${loginData.token}` }
  });
  console.log('Appointments:', apptRes.status, await apptRes.text());
  
  const docsRes = await fetch('http://127.0.0.1:3000/api/clinic/doctors', {
    headers: { 'Authorization': `Bearer ${loginData.token}` }
  });
  console.log('Doctors:', docsRes.status, await docsRes.text());
  
  const patientsRes = await fetch('http://127.0.0.1:3000/api/clinic/patients', {
    headers: { 'Authorization': `Bearer ${loginData.token}` }
  });
  console.log('Patients:', patientsRes.status, await patientsRes.text());
}
run();
