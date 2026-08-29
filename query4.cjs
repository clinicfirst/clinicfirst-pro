const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./data/clinicfirst.json', 'utf8'));
const clinicId = "clinic_1787923240249_cqgw";

const clinic = data.clinics.find(c => c.id === clinicId);
console.log("Clinic Address:", clinic?.address);

