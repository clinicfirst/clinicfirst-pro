import { generateToken } from '../server/auth';
const token = generateToken({
  id: 'usr_platform_admin_1',
  role: 'PLATFORM_ADMIN'
});
console.log(token);
