import { AppointmentService } from '../server/services/appointment.service';

async function run() {
  console.log("--- Starting Step 7 Concurrency Test ---");
  
  // Need to wait for db to fetch from Supabase on startup
  await new Promise(r => setTimeout(r, 2000));
  
  const clinicId = 'clinic_apex_101';
  const doctorId = 'doc_elena_1';
  const patientId = 'pat_miller_1';
  const serviceId = 'srv_cardiac_eval_1';
  const date = '2088-06-20';
  
  console.log("\nTest 1: Simultaneous Exact Overlap Booking (10:30)");
  const p1 = AppointmentService.book(clinicId, { patientId, doctorId, serviceId, date, startTime: '10:30' }, { type: 'AI', name: 'AI Receptionist' });
  const p2 = AppointmentService.book(clinicId, { patientId, doctorId, serviceId, date, startTime: '10:30' }, { type: 'HUMAN_RECEPTIONIST', userId: 'usr_clinic_admin_1', name: 'Admin' });
  
  const [res1, res2] = await Promise.all([p1, p2]);
  console.log("Result 1 (AI):", res1.success ? 'SUCCESS' : res1.error_code);
  console.log("Result 2 (Human):", res2.success ? 'SUCCESS' : res2.error_code);
  
  const successCount = (res1.success ? 1 : 0) + (res2.success ? 1 : 0);
  const rejectCount = (res1.error_code === 'SLOT_NO_LONGER_AVAILABLE' ? 1 : 0) + 
                      (res2.error_code === 'SLOT_NO_LONGER_AVAILABLE' ? 1 : 0);
                      
  if (successCount === 1 && rejectCount === 1) {
     console.log("Test 1 PASSED: Exactly one succeeded, exactly one rejected with SLOT_NO_LONGER_AVAILABLE");
  } else {
     console.error("Test 1 FAILED:", res1, res2);
  }
}
run().catch(console.error);
