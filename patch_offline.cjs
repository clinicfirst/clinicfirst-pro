const fs = require('fs');
let content = fs.readFileSync('server/services/rag.service.ts', 'utf8');
content = content.replace(
  'return ["(Offline mode: Semantic search is disabled. Standard clinic rules apply.)"];',
  'return [];'
);
fs.writeFileSync('server/services/rag.service.ts', content);
