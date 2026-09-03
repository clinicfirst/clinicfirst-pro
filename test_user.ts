import { UserService } from './server/services/user.service';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const user = await UserService.getById('usr_1787923240250_irur');
  console.log("User:", user);
}
run().catch(console.error);
