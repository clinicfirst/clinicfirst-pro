const fs = require('fs');

let content = fs.readFileSync('server/routes/voice.routes.ts', 'utf8');

if (!content.includes('import { AppointmentService }')) {
  content = content.replace(/import \{ db \} from '\.\.\/db';/, "import { db } from '../db';\nimport { AppointmentService } from '../services/appointment.service';\nimport { DoctorService } from '../services/doctor.service';");
}

content = content.replace(/db\.getDoctorById\(([^,]+),\s*([^)]+)\)/g, '(await DoctorService.getById($1, $2))');

content = content.replace(/db\.data\.appointments\.find\(a =>/g, '(await AppointmentService.list(clinic_id)).find(a =>');
content = content.replace(/db\.data\.appointments\.filter\(a =>/g, '(await AppointmentService.list(clinic_id)).filter(a =>');

fs.writeFileSync('server/routes/voice.routes.ts', content);
