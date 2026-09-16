const fs = require('fs');
let content = fs.readFileSync('server/routes/voice.routes.ts', 'utf8');
content = content.replace(
  'const agent = await AiAgentService.getAgentByProviderId(provider_agent_id);',
  'const agent = await AiAgentService.getAgentByProviderAgentId(provider_agent_id);'
);
fs.writeFileSync('server/routes/voice.routes.ts', content);
