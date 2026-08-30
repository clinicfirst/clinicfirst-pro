const fs = require('fs');
const content = fs.readFileSync('server/app.ts', 'utf8');
const importAddition = `
import { voiceRouter } from './routes/voice.routes';
`;
let newContent = content.replace(
  "import { aiRouter } from './routes/ai.routes';",
  "import { aiRouter } from './routes/ai.routes';\nimport { voiceRouter } from './routes/voice.routes';"
);

newContent = newContent.replace(
  "app.use('/ai', aiRouter);",
  "app.use('/ai', aiRouter);\n\napp.use('/api/voice', voiceRouter);\napp.use('/voice', voiceRouter);"
);

fs.writeFileSync('server/app.ts', newContent);
