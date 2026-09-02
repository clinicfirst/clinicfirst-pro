import { generateToken } from '../server/auth';
import { db } from '../server/db';
const token = generateToken({
  id: 'usr_platform_admin_1',
  role: 'PLATFORM_ADMIN',
  clinic_id: null
});
console.log(token);
