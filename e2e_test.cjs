const http = require('http');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

async function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: method,
      headers: { ...headers }
    };
    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
        } catch(e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  console.log("Starting E2E Tests...");
  
  // 1. Health
  let res = await request('GET', '/api/health');
  console.log('1. Health:', res.status, res.body);

  // 2. Auth Login (we don't know password, we will use our signed JWT)
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3JfMTc4NzkyMzI0MDI1MF9pcnVyIiwiZW1haWwiOiJhZG1pbkBjbGluaWMuY29tIiwicm9sZSI6IkNMSU5JQ19BRE1JTiIsImNsaW5pY19pZCI6ImNsaW5pY18xNzg3OTIzMjQwMjQ5X2NxZ3ciLCJuYW1lIjoiRHIuIFVqd2FsYSBNYXNrZSIsImlhdCI6MTc4ODQ0MDQxNywiZXhwIjoxNzg4NTI2ODE3fQ.lB2Uqz1WscxCFBUL-NPkW1IMl9GQa1h-r75Uu_ccr54';
  
  res = await request('GET', '/api/clinic/me/ai-widget-config', { 'Authorization': `Bearer ${token}` });
  console.log('2. AI Widget Config:', res.status, res.body);
  
  res = await request('GET', '/api/clinic/1787923240249_cqgw/appointments', { 'Authorization': `Bearer ${token}` });
  console.log('3. Appointments Fetch:', res.status, res.body?.length || 0, 'appointments found');
  
  // Cross tenant
  res = await request('GET', '/api/clinic/clinic_apex_101/appointments', { 'Authorization': `Bearer ${token}` });
  console.log('4. Cross-tenant Security:', res.status, res.body);
  
}
run().catch(console.error);
