const https = require('https');
const { execSync } = require('child_process');

const token = execSync('node sign_jwt.cjs').toString().trim();

const body = JSON.stringify({
  provider_agent_id: 'sarvam_agent_456',
  status: 'ACTIVE',
  enabled: true
});

const options = {
  hostname: 'clinicfirst.vercel.app',
  port: 443,
  path: '/api/clinic/ai-agent',
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
};

const req = https.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.write(body);
req.end();
