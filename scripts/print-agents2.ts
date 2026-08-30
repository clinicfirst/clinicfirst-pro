import { db } from '../server/db';
async function run() {
  await db.ensureHydrated();
  console.log(db.data.ai_agents.map(a => ({ clinic: a.clinic_id, agent: a.provider_agent_id })));
}
run();
