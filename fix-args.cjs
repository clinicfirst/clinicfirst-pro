const fs = require('fs');
let code = fs.readFileSync('server/routes/platform.routes.ts', 'utf8');
code = code.replace(/await KnowledgeService.createClinicKnowledge\(\{\s*clinic_id,([\s\S]*?)\}\);/g, "await KnowledgeService.createClinicKnowledge(clinic_id, { $1 });");
code = code.replace(/await KnowledgeService.updateClinicKnowledge\(([\s\S]*?), clinic_id\);/g, "await KnowledgeService.updateClinicKnowledge(clinic_id, $1);");
code = code.replace(/await KnowledgeService.deleteClinicKnowledge\(([\s\S]*?), clinic_id\);/g, "await KnowledgeService.deleteClinicKnowledge(clinic_id, $1);");
fs.writeFileSync('server/routes/platform.routes.ts', code);

let code2 = fs.readFileSync('server/routes/clinic.routes.ts', 'utf8');
code2 = code2.replace(/await KnowledgeService.createClinicKnowledge\(\{\s*clinic_id: clinicId,([\s\S]*?)\}\);/g, "await KnowledgeService.createClinicKnowledge(clinicId, { $1 });");
code2 = code2.replace(/await KnowledgeService.updateClinicKnowledge\(([\s\S]*?), clinicId\);/g, "await KnowledgeService.updateClinicKnowledge(clinicId, $1);");
code2 = code2.replace(/await KnowledgeService.deleteClinicKnowledge\(([\s\S]*?), clinicId\);/g, "await KnowledgeService.deleteClinicKnowledge(clinicId, $1);");
fs.writeFileSync('server/routes/clinic.routes.ts', code2);
