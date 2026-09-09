const fs = require('fs');
let voice = fs.readFileSync('server/routes/voice.routes.ts', 'utf8');

voice = voice.replace(
  `        if (!upstreamResponse.ok) {`,
  `        if (!upstreamResponse.ok) {
          console.log(\`[Sarvam Handshake Proxy] UPSTREAM ERROR \${upstreamResponse.status}: \`, responseData);`
);

fs.writeFileSync('server/routes/voice.routes.ts', voice);
