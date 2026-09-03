const fs = require('fs');

function fix(file) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('import { ClinicService }')) {
    content = `import { ClinicService } from '../services/clinic.service';\nimport { UserService } from '../services/user.service';\nimport { AppointmentService } from '../services/appointment.service';\nimport { PatientService } from '../services/patient.service';\nimport { DoctorService } from '../services/doctor.service';\n` + content;
  }
  fs.writeFileSync(file, content);
}

['server/routes/auth.routes.ts', 'server/routes/clinic.routes.ts', 'server/routes/platform.routes.ts', 'server/routes/knowledgeCompiler.routes.ts', 'server/routes/voice.routes.ts'].forEach(fix);
