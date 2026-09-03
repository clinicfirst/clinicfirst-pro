const https = require('https');
const fs = require('fs');

const adminToken = fs.readFileSync('admin_token.txt', 'utf8').trim();
const baseUrl = 'https://clinicfirst.vercel.app'; 

async function request(path) {
  return new Promise(resolve => {
    https.get(`${baseUrl}${path}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, (res) => {
      let data = '';
      res.on('data', c => data+=c);
      res.on('end', () => resolve(data));
    });
  });
}

async function run() {
  const clinics = await request('/api/platform/clinics');
  console.log('Clinics Response:', clinics);
}
run();
