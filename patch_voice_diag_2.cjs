const fs = require('fs');
let voice = fs.readFileSync('server/routes/voice.routes.ts', 'utf8');

voice = voice.replace(
  `        if (!upstreamResponse.ok) {`,
  `        if (!upstreamResponse.ok) {
          console.log(\`[Sarvam Handshake Proxy] UPSTREAM ERROR \${upstreamResponse.status}: \`, responseData);
          console.log(\`[Sarvam Handshake Proxy] URL was: \${targetUrl.toString()}\`);
          console.log(\`[Sarvam Handshake Proxy] Key length: \${sarvamApiKey ? sarvamApiKey.length : 0}\`);`
);

fs.writeFileSync('server/routes/voice.routes.ts', voice);
