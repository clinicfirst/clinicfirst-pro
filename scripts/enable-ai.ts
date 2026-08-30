import { db } from '../server/db';
const pc = db.data.platform_ai_config;
if (pc) pc.status = 'ACTIVE';

const agent = db.data.ai_agents.find(a => a.clinic_id === 'clinic_apex_101');
if (agent) {
  agent.status = 'ACTIVE';
  agent.provider_agent_id = 'sarvam_agent_123';
} else {
  db.data.ai_agents.push({
    id: 'agent_test_123',
    clinic_id: 'clinic_apex_101',
    name: 'Apex Receptionist',
    greeting: 'Hello from Apex.',
    voice_provider: 'sarvam',
    voice_config: {},
    languages: ['English'],
    status: 'ACTIVE',
    escalation_contact: {},
    provider_agent_id: 'sarvam_agent_123'
  });
}
db.flush();
console.log("AI enabled");
