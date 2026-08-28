const fs = require('fs');
try {
  fs.writeFileSync('data/clinicfirst.json', fs.readFileSync('data/clinicfirst.json', 'utf8'));
  console.log("Success writing to data/clinicfirst.json");
} catch (e) {
  console.log("Error:", e.message);
}
