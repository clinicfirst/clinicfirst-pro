const fs = require('fs');
const glob = require('glob');

function processFile(file) {
  let content = fs.readFileSync(file, 'utf8');

  if (content.includes('db.') && !content.includes('import { ClinicService }')) {
    content = content.replace(/import \{ db \} from '.*db';/, "import { db } from '../../db';\nimport { ClinicService } from '../../services/clinic.service';\nimport { AppointmentService } from '../../services/appointment.service';");
  }

  content = content.replace(/db\.getClinicById\(([^)]+)\)/g, '(await ClinicService.getById($1))');
  content = content.replace(/db\.getAppointments\(([^)]+)\)/g, '(await AppointmentService.list($1))');
  content = content.replace(/db\.getRawPlatformAiApiKey\(\)/g, 'process.env.GEMINI_API_KEY');
  content = content.replace(/db\.logAiUsage\(/g, '// db.logAiUsage(');

  fs.writeFileSync(file, content);
}

const files = [
  'server/voice/tools/get-available-slots.ts',
  'server/voice/tools/get-patient-by-phone.ts',
  'server/voice/tools/get-clinic-info.ts',
  'server/voice/tools/create-appointment.ts',
  'server/voice/providers/sarvam.provider.ts',
  'server/voice/voice-engine.ts'
];

files.forEach(processFile);
