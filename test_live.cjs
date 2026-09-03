const https = require('https');
const token = process.env.SANJEEVANI_TOKEN;

function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'clinicfirst.vercel.app',
      port: 443,
      path,
      method,
      headers: { 'Authorization': `Bearer ${token}` }
    };
    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data+=c);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  console.log("4. Check appointment booking availability (Concurrent test):");
  const futureDate = "2026-09-05"; // Saturday
  
  const p1 = makeRequest('/api/clinic/appointments', 'POST', JSON.stringify({
    patient_id: "pat_1788000052066_oyox", // existing patient
    doctor_id: "doc_1787923357367_643s",
    service_id: "srv_1787923389642_o9t1",
    date: futureDate,
    start_time: "14:00",
    end_time: "14:30",
    created_via: "ai_receptionist"
  }));
  
  const p2 = makeRequest('/api/clinic/appointments', 'POST', JSON.stringify({
    patient_id: "pat_1788000080756_vurm", // different patient
    doctor_id: "doc_1787923357367_643s",
    service_id: "srv_1787923389642_o9t1",
    date: futureDate,
    start_time: "14:00",
    end_time: "14:30",
    created_via: "ai_receptionist"
  }));
  
  const [res1, res2] = await Promise.all([p1, p2]);
  console.log("Concurrent Booking 1:", res1);
  console.log("Concurrent Booking 2:", res2);
}
run().catch(console.error);
