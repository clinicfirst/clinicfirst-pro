const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./data/clinicfirst.json', 'utf8'));
const clinicId = "clinic_1787923240249_cqgw";

const agent = data.ai_agents.find(a => a.clinic_id === clinicId);
console.log("Agent full:", JSON.stringify(agent, null, 2));

