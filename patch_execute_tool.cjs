const fs = require('fs');
const path = 'server/voice/tools/index.ts';
let content = fs.readFileSync(path, 'utf8');

const target = "case 'escalateToStaff':\n        return await escalateToStaff(clinicId, args as any);";
const replacement = `case 'escalateToStaff':
        return await escalateToStaff(clinicId, args as any);
      case 'searchClinicKnowledge':
        return await searchClinicKnowledge(clinicId, args as any);`;

if (!content.includes("case 'searchClinicKnowledge':")) {
  content = content.replace(target, replacement);
  fs.writeFileSync(path, content);
}
