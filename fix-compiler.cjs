const fs = require('fs');

let content = fs.readFileSync('server/routes/knowledgeCompiler.routes.ts', 'utf8');
content = content.replace(
  /const knowledgeItems = \(db\.data\.clinic_knowledge_base \|\| \[\]\)\.filter\(\s*\(k\) => k\.clinic_id === clinicId && k\.status === 'PUBLISHED'\s*\);/m,
  "const knowledgeItems = await KnowledgeService.listClinicKnowledge(clinicId, 'PUBLISHED');"
);

if (!content.includes('import { KnowledgeService }')) {
  content = content.replace(/import \{ db \} from '\.\.\/db';/, "import { db } from '../db';\nimport { KnowledgeService } from '../services/knowledge.service';");
}

fs.writeFileSync('server/routes/knowledgeCompiler.routes.ts', content);
