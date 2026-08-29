const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./data/clinicfirst.json', 'utf8'));
for (const key of Object.keys(data)) {
  if (Array.isArray(data[key]) && data[key].length > 0) {
    console.log(`\nTable: ${key}`);
    console.log(Object.keys(data[key][0]).map(k => `  ${k}: ${typeof data[key][0][k]}`).join('\n'));
  }
}
