const fs = require('fs');

function processFile(file) {
  let content = fs.readFileSync(file, 'utf8');

  // Add imports
  if (!content.includes('import { ClinicService }')) {
    content = content.replace(/import \{ db \} from '\.\.\/db';/, "import { db } from '../db';\nimport { ClinicService } from '../services/clinic.service';\nimport { UserService } from '../services/user.service';\nimport { AppointmentService } from '../services/appointment.service';\nimport { PatientService } from '../services/patient.service';\nimport { DoctorService } from '../services/doctor.service';");
  }

  content = content.replace(/db\.getClinics\(\)/g, 'await ClinicService.list()');
  content = content.replace(/db\.getClinicById\(([^)]+)\)/g, 'await ClinicService.getById($1)');
  content = content.replace(/db\.updateClinic\(([^,]+),\s*([^)]+)\)/g, 'await ClinicService.update($1, $2)');
  content = content.replace(/db\.createClinic\(([^)]+)\)/g, 'throw new Error("createClinic not implemented")'); // We can fix createClinic later

  content = content.replace(/db\.getUsers\(([^)]*)\)/g, 'await UserService.list($1)');
  content = content.replace(/db\.getUserById\(([^)]+)\)/g, 'await UserService.getById($1)');
  content = content.replace(/db\.getUserByEmail\(([^)]+)\)/g, 'await UserService.getByEmail($1)');
  content = content.replace(/db\.updateUser\(([^,]+),\s*([^)]+)\)/g, 'await UserService.update($1, $2)');

  content = content.replace(/db\.getAppointments\(([^,)]+)(?:,\s*([^)]+))?\)/g, 'await AppointmentService.list($1, $2)');
  content = content.replace(/db\.getPatientById\(([^,]+),\s*([^)]+)\)/g, 'await PatientService.getById($1, $2)');
  content = content.replace(/db\.getDoctorById\(([^,]+),\s*([^)]+)\)/g, 'await DoctorService.getById($1, $2)');

  fs.writeFileSync(file, content);
}

['server/routes/auth.routes.ts', 'server/routes/clinic.routes.ts', 'server/routes/platform.routes.ts', 'server/routes/knowledgeCompiler.routes.ts'].forEach(processFile);

