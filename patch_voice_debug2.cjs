const fs = require('fs');
let code = fs.readFileSync('server/routes/voice.routes.ts', 'utf-8');

code = code.replace(
  "return res.json({",
  "return res.json({\n           debug_time: time,\n           debug_resolved_doc: resolvedDoctorId,\n           debug_slots: slotsResponse.slots.slice(0, 15).map(s => s.time),"
);

fs.writeFileSync('server/routes/voice.routes.ts', code);
console.log('Patched for debug2');
