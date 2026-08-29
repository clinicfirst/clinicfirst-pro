const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./data/clinicfirst.json', 'utf8'));
const clinicId = "clinic_1787923240249_cqgw";

const clinic = data.clinics.find(c => c.id === clinicId);
console.log("Clinic:", JSON.stringify(clinic, null, 2));

const users = data.users.filter(u => u.clinic_id === clinicId);
console.log("Doctors (from users):", users.filter(u => u.role === 'CLINIC_ADMIN' || u.role === 'CLINIC_STAFF').length, "Total Users:", users.length);

const doctors = data.doctors.filter(d => d.clinic_id === clinicId);
console.log("Doctors:", JSON.stringify(doctors, null, 2));

const agents = data.ai_agents.filter(a => a.clinic_id === clinicId);
console.log("Agents:", JSON.stringify(agents, null, 2));

