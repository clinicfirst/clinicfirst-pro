const http = require('http');
async function run() {
  const largePayload = JSON.stringify({ tool: 'check_availability', data: 'A'.repeat(150 * 1024) });
  const options = {
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/voice/webhook/sarvam/fake_agent',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-secret',
      'Content-Length': largePayload.length
    }
  };
  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log(`Large payload status: ${res.statusCode}`);
      console.log(`Large payload body: ${body}`);
    });
  });
  req.on('error', console.error);
  req.write(largePayload);
  req.end();
}
run();
