const http = require('http');

async function test(name, token) {
  const payload = JSON.stringify({ tool: 'check_availability', date: '2025-01-01' });
  const headers = { 'Content-Type': 'application/json', 'Content-Length': payload.length };
  if (token !== undefined) headers['Authorization'] = `Bearer ${token}`;

  const options = {
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/voice/webhook/sarvam/fake_agent',
    method: 'POST',
    headers
  };

  await new Promise(resolve => {
    const req = http.request(options, (res) => {
      console.log(`${name}: ${res.statusCode}`);
      resolve();
    });
    req.write(payload);
    req.end();
  });
}

async function run() {
  await test('Missing Auth', undefined);
  await test('Wrong Secret', 'wrong_secret');
  await test('Empty Secret', '');
}
run();
