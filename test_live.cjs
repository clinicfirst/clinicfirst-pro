const https = require('https');
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3JfMTc4NzkyMzI0MDI1MF9pcnVyIiwiZW1haWwiOiJhZG1pbkBjbGluaWMuY29tIiwicm9sZSI6IkNMSU5JQ19BRE1JTiIsImNsaW5pY19pZCI6ImNsaW5pY18xNzg3OTIzMjQwMjQ5X2NxZ3ciLCJuYW1lIjoiRHIuIFVqd2FsYSBNYXNrZSIsImlhdCI6MTc4ODQ0MDQxNywiZXhwIjoxNzg4NTI2ODE3fQ.lB2Uqz1WscxCFBUL-NPkW1IMl9GQa1h-r75Uu_ccr54';

const options = {
  hostname: 'clinicfirst.vercel.app',
  port: 443,
  path: '/api/clinic/me/ai-widget-config',
  method: 'GET',
  headers: { 'Authorization': `Bearer ${token}` }
};

const req = https.request(options, res => {
  let data = '';
  res.on('data', c => data+=c);
  res.on('end', () => console.log('Live AI Widget Config:', res.statusCode, data));
});
req.end();

const req2 = https.request({ ...options, path: '/api/clinic/appointments' }, res => {
  let data = '';
  res.on('data', c => data+=c);
  res.on('end', () => console.log('Live Appointments:', res.statusCode, data.substring(0, 100)));
});
req2.end();
