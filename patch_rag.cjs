const fs = require('fs');
let content = fs.readFileSync('server/services/rag.service.ts', 'utf8');

// Fix embedding model
content = content.replace(
  "const RAG_EMBEDDING_MODEL = process.env.RAG_EMBEDDING_MODEL || 'text-embedding-004';",
  "const RAG_EMBEDDING_MODEL = process.env.RAG_EMBEDDING_MODEL || 'gemini-embedding-2';"
);

// Fix indexRelease safety
const oldIndexLogic = `
      // First, delete old chunks for this clinic
      await supabase
        .from('clinic_knowledge_chunks')
        .delete()
        .eq('clinic_id', clinicId);

      // Insert new chunks
      const { error } = await supabase
        .from('clinic_knowledge_chunks')
        .insert(recordsToInsert);

      if (error) {
        throw error;
      }
`;

const newIndexLogic = `
      // Insert new chunks FIRST
      const { error } = await supabase
        .from('clinic_knowledge_chunks')
        .insert(recordsToInsert);

      if (error) {
        throw error;
      }

      // Then cleanly delete older releases
      await supabase
        .from('clinic_knowledge_chunks')
        .delete()
        .eq('clinic_id', clinicId)
        .neq('release_id', releaseId);
`;

content = content.replace(oldIndexLogic, newIndexLogic);

fs.writeFileSync('server/services/rag.service.ts', content);
