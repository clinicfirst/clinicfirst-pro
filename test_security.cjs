const http = require('http');

async function run() {
  const payload = JSON.stringify({ tool: 'check_availability', date: '2025-01-01' });
  const options = {
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/voice/webhook/sarvam/fake_agent',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-secret', // Use fake for now, we just want to see rate limiting
      'Content-Length': payload.length
    }
  };

  let rateLimited = false;
  console.log("Testing 35 requests...");
  for (let i = 1; i <= 35; i++) {
    await new Promise(resolve => {
      const req = http.request(options, (res) => {
        if (i === 31 || res.statusCode === 429) {
          console.log(`Req ${i}: ${res.statusCode}`);
          rateLimited = res.statusCode === 429;
        }
        res.on('data', () => {});
        res.on('end', resolve);
      });
      req.on('error', resolve);
      req.write(payload);
      req.end();
    });
  }
  console.log("Rate Limit Works:", rateLimited);

  // Test large payload (150KB)
  const largePayload = JSON.stringify({ tool: 'check_availability', data: 'A'.repeat(150 * 1024) });
  const largeOptions = { ...options, headers: { ...options.headers, 'Content-Length': largePayload.length } };
  await new Promise(resolve => {
    const req = http.request(largeOptions, (res) => {
      console.log(`Large payload status: ${res.statusCode}`);
      resolve();
    });
    req.on('error', resolve);
    req.write(largePayload);
    req.end();
  });
}
run();
