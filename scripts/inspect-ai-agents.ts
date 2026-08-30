import { db } from '../server/db';
console.log(db.data.ai_agents.map(a => ({ clinic_id: a.clinic_id, provider_agent_id: a.provider_agent_id })));
