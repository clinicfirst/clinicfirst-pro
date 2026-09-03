const https = require('https');
const token = process.env.SANJEEVANI_TOKEN;
const options = { hostname: 'clinicfirst.vercel.app', port: 443, path: '/api/clinic/schedules?doctor_id=doc_1787923357367_643s', method: 'GET', headers: { 'Authorization': `Bearer ${token}` } };
https.get(options, res => { let data = ''; res.on('data', c => data+=c); res.on('end', () => console.log(data)); });
