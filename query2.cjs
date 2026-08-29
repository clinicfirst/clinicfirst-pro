const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./data/clinicfirst.json', 'utf8'));
const clinicId = "clinic_1787923240249_cqgw";

const clinic = data.clinics.find(c => c.id === clinicId);
console.log("Clinic ID:", clinic?.id);
console.log("Clinic Name:", clinic?.name);
console.log("Clinic Phone:", clinic?.phone);
console.log("Clinic Email:", clinic?.email);

const users = data.users.filter(u => u.clinic_id === clinicId);
console.log("Total Clinic Users:", users.length);
console.log("Doctors (from users):", users.filter(u => u.role === 'CLINIC_ADMIN' || u.role === 'CLINIC_STAFF').length); // Actually, we should check data.doctors

const doctors = data.doctors.filter(d => d.clinic_id === clinicId);
console.log("Doctors Count:", doctors.length);
console.log("Doctors:", doctors.map(d => d.name).join(', '));

const agents = data.ai_agents.filter(a => a.clinic_id === clinicId);
console.log("Agents:", agents.length > 0 ? agents[0].name + " (Status: " + agents[0].status + ")" : "None");

