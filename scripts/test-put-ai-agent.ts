import { config } from 'dotenv';
config();
import fetch from 'node-fetch';
import { generateToken } from '../server/auth';
import { db } from '../server/db';

async function run() {
  const URL = 'http://localhost:3000';
  
  const adminA = db.data.users.find(u => u.email === 'admin@apexclinic.com');
  const tokenA = generateToken(adminA!);

  // Just fetch the current config to see what provider_agent_id it has.
  let res = await fetch(`${URL}/api/clinic/me/ai-widget-config`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  console.log('GET ai-widget-config:', await res.json());

}
run().catch(console.error);
