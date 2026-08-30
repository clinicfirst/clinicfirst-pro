import { db } from '../server/db';
async function run() {
  await db.ensureHydrated();
  console.log(db.data.ai_agents);
}
run();
