const fs = require('fs');
let voice = fs.readFileSync('server/routes/voice.routes.ts', 'utf8');
voice = voice.replace(/          \}\)\)\n        \}\);/g, '          }))),\n        });');
fs.writeFileSync('server/routes/voice.routes.ts', voice);
