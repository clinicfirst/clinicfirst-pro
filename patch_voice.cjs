const fs = require('fs');

let voice = fs.readFileSync('server/routes/voice.routes.ts', 'utf8');

voice = voice.replace(
  `      console.log(\`  - SARVAM_API_KEY exists: \${Boolean(sarvamApiKey)}\`);`,
  `      console.log(\`  - SARVAM_API_KEY exists: \${Boolean(process.env.SARVAM_API_KEY)}\`);`
);

fs.writeFileSync('server/routes/voice.routes.ts', voice);
