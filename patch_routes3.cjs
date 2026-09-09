const fs = require('fs');

let clinic = fs.readFileSync('server/routes/clinic.routes.ts', 'utf8');

clinic = clinic.replace(
  `const proxyBaseUrl = '/api/voice/sarvam-proxy/';\n      return res.json({`,
  `const proxyBaseUrl = '/api/voice/sarvam-proxy/';\n      console.log('[AI Widget Config] VERCEL_ENV:', process.env.VERCEL_ENV, 'SARVAM_API_KEY exists:', Boolean(process.env.SARVAM_API_KEY));\n      return res.json({`
);

fs.writeFileSync('server/routes/clinic.routes.ts', clinic);
