import { db, hashPassword } from '../server/db';

const p = hashPassword('password123');
db.data.users.push({
  id: 'user_test_admin',
  clinic_id: 'clinic_apex_101',
  email: 'testadmin@apexclinic.com',
  name: 'Test Admin',
  role: 'CLINIC_ADMIN',
  password_hash: p,
  status: 'ACTIVE',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});
db.flush();
console.log("User created.");
