const fs = require('fs');
let content = fs.readFileSync('server/voice/voice-engine.ts', 'utf8');
content = content.replace(/\/\/ db\.logAiUsage\(\{[\s\S]*?\}\);/, '/* db.logAiUsage block removed */');
fs.writeFileSync('server/voice/voice-engine.ts', content);
