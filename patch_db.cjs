const fs = require('fs');

let code = fs.readFileSync('server/db.ts', 'utf-8');

// Remove createAppointment
code = code.replace(
  /\s*public createAppointment[\s\S]*?return \{\s*success: true,\s*appointment: this\.getAppointmentById\(appointment\.clinic_id, appointment\.id\),\s*\};\s*\}/g,
  ""
);

// Remove updateAppointment
code = code.replace(
  /\s*public updateAppointment[\s\S]*?return \{\s*success: true,\s*appointment: this\.getAppointmentById\(clinic_id, id\),\s*\};\s*\}/g,
  ""
);

// Remove checkDoubleBooking
code = code.replace(
  /\s*private checkDoubleBooking[\s\S]*?return !!conflict;\s*\}/g,
  ""
);

fs.writeFileSync('server/db.ts', code);
console.log("DB patched");
