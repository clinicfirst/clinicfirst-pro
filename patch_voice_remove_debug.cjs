const fs = require('fs');
let code = fs.readFileSync('server/routes/voice.routes.ts', 'utf-8');

code = code.replace(
  "suggest_retry_availability: true,\n           debug_slots: slotsResponse.slots.slice(0, 50).map(s => s.time) // debug to see why it fails",
  "suggest_retry_availability: true"
);

fs.writeFileSync('server/routes/voice.routes.ts', code);
console.log('Patched out debug');
