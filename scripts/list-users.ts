import { db } from '../server/db';
console.log(db.data.users.map(u => ({ email: u.email, role: u.role, clinic_id: u.clinic_id })));
