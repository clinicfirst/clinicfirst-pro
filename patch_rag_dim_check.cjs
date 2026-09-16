const fs = require('fs');
let content = fs.readFileSync('server/services/rag.service.ts', 'utf8');

const oldCheck = `const embedding = await this.generateEmbedding(text);`;
const newCheck = `const embedding = await this.generateEmbedding(text);
        if (embedding.length !== RAG_EMBEDDING_DIMENSION) {
          throw new Error(\`Embedding dimension mismatch: expected \${RAG_EMBEDDING_DIMENSION}, got \${embedding.length}\`);
        }`;

content = content.replace(oldCheck, newCheck);
fs.writeFileSync('server/services/rag.service.ts', content);
