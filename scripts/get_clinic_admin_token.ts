import { generateToken } from '../server/auth';
const token = generateToken({
  id: 'usr_apex_admin_1',
  role: 'CLINIC_ADMIN',
  clinic_id: 'clinic_apex_101',
  name: 'Clinic Admin',
  email: 'admin@apexclinic.com',
  status: 'ACTIVE',
  must_change_password: false,
  created_at: new Date().toISOString()
});
console.log(token);
