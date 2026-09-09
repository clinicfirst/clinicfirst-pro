const fs = require('fs');

// Patch clinic.routes.ts
let clinic = fs.readFileSync('server/routes/clinic.routes.ts', 'utf8');

clinic = clinic.replace(
  `const useProxy = Boolean(process.env.SARVAM_API_KEY);`,
  `// Enforce proxy mode in production to prevent silent browser fallback
      const useProxy = true;`
);

clinic = clinic.replace(
  `baseUrl: useProxy ? proxyBaseUrl : undefined,`,
  `baseUrl: proxyBaseUrl,`
);

// Diagnostic log inside clinic config
clinic = clinic.replace(
  `return res.json({`,
  `console.log('[AI Widget Config] VERCEL_ENV:', process.env.VERCEL_ENV, 'SARVAM_API_KEY exists:', Boolean(process.env.SARVAM_API_KEY));
      
      return res.json({`
);

fs.writeFileSync('server/routes/clinic.routes.ts', clinic);

// Patch voice.routes.ts
let voice = fs.readFileSync('server/routes/voice.routes.ts', 'utf8');

const diagLog = `
      console.log(\`[Sarvam Proxy Diagnostics]\`);
      console.log(\`  - VERCEL_ENV: \${process.env.VERCEL_ENV || 'unknown'}\`);
      console.log(\`  - NODE_ENV: \${process.env.NODE_ENV}\`);
      console.log(\`  - SARVAM_API_KEY exists: \${Boolean(sarvamApiKey)}\`);
      console.log(\`  - SARVAM_ORG_ID exists: \${Boolean(process.env.SARVAM_ORG_ID)}\`);
      console.log(\`  - SARVAM_WORKSPACE_ID exists: \${Boolean(process.env.SARVAM_WORKSPACE_ID)}\`);
      console.log(\`  - Requested Clinic: \${clinicId}\`);
      console.log(\`  - Requested App/Agent: \${app_id}\`);
`;

voice = voice.replace(
  `// Verify server-side master credential`,
  diagLog + `\n      // Verify server-side master credential`
);

fs.writeFileSync('server/routes/voice.routes.ts', voice);
console.log('Patched routes.');
