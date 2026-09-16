const fs = require('fs');
const path = 'server/routes/knowledgeCompiler.routes.ts';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('import { RagService }')) {
  content = content.replace(
    'import { KnowledgeService } from "../services/knowledge.service";',
    'import { KnowledgeService } from "../services/knowledge.service";\nimport { RagService } from "../services/rag.service";'
  );
}

const updateCall = "await KnowledgeService.updateKnowledgeReleaseStatus(clinic_id, releaseId, 'PUBLISHED', publishedBy);";
const replacement = `await KnowledgeService.updateKnowledgeReleaseStatus(clinic_id, releaseId, 'PUBLISHED', publishedBy);

    // Phase 1C: Index for RAG
    try {
      await RagService.indexRelease(clinic_id, releaseId, content);
    } catch (ragErr) {
      console.error('[knowledgeCompilerRouter] RAG Indexing failed, but release was published:', ragErr);
      // We don't fail the publishing request if RAG indexing temporarily fails
    }`;

content = content.replace(updateCall, replacement);
fs.writeFileSync(path, content);
