const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/clinic/ai-agent',
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer test' // Wait, I need a valid token.
  }
};
