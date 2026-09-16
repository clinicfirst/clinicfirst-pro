const fs = require('fs');
const path = 'server/routes/voice.routes.ts';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('import { searchClinicKnowledge }')) {
  content = content.replace(
    'import { getAvailableSlots } from \'../voice/tools/get-available-slots\';',
    'import { getAvailableSlots } from \'../voice/tools/get-available-slots\';\nimport { searchClinicKnowledge } from \'../voice/tools/search-knowledge\';'
  );
}

const newEndpoint = `
// ============================================================================
// Sarvam Knowledge Retrieval Tool (RAG v1)
// POST /api/voice/knowledge/:provider_agent_id
// ============================================================================
voiceRouter.post('/knowledge/:provider_agent_id', async (req, res) => {
  try {
    const { provider_agent_id } = req.params;
    
    // 1. Authenticate Request
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Missing or invalid Authorization header' });
    }
    const token = authHeader.split(' ')[1];
    if (token !== process.env.CLINICFIRST_AI_TOOL_SECRET) {
      return res.status(401).json({ success: false, error: 'Unauthorized tool access' });
    }

    // 2. Resolve Tenant
    const agent = await AiAgentService.getAgentByProviderId(provider_agent_id);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found for this provider_agent_id' });
    }
    const clinic_id = agent.clinic_id;

    // 3. Extract parameters
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({
        success: false,
        error_code: "MISSING_QUERY",
        message: "A search query is required."
      });
    }

    // 4. Execute search
    const result = await searchClinicKnowledge(clinic_id, { query });
    return res.json(result);

  } catch (error: any) {
    console.error('[POST /api/voice/knowledge] Error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error while searching knowledge base.' });
  }
});
`;

if (!content.includes('/knowledge/:provider_agent_id')) {
  // Insert it before the webhook endpoint
  const target = "voiceRouter.post('/webhook/sarvam/:provider_agent_id'";
  content = content.replace(target, newEndpoint + '\n' + target);
  fs.writeFileSync(path, content);
}
