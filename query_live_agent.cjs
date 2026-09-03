const https = require('https');
const token = process.env.SANJEEVANI_TOKEN;

function makeRequest(path, method = 'GET') {
  return new Promise((resolve) => {
    const options = {
      hostname: 'clinicfirst.vercel.app',
      port: 443,
      path,
      method,
      headers: { 'Authorization': `Bearer ${token}` }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data+=c);
      res.on('end', () => resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null }));
    });
    req.end();
  });
}

async function run() {
  console.log("=== GET /api/clinic/ai-agent ===");
  console.log(await makeRequest('/api/clinic/ai-agent'));
}

run().catch(console.error);
