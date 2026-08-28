const http = require('http');

const putData = JSON.stringify({
  name: "Siya",
  greeting: "Hello from CLI",
  voice_provider: "gemini_live",
  status: "ACTIVE",
  languages: ["English"],
  escalation_contact: {
    phone: "",
    email: "",
    name: ""
  },
  instructions_note: "CLI testing"
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/clinic/ai-agent',
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(putData),
    'Authorization': 'Bearer ' + 'test' // Needs token
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data));
});

req.write(putData);
req.end();
