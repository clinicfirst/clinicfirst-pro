import { createAppointment } from '../server/voice/tools/create-appointment';
import { db } from '../server/db';

async function run() {
  console.log("--- Starting Step 6H Concurrency Test ---");
  
  // Need to wait for db to fetch from Supabase on startup
  await new Promise(r => setTimeout(r, 2000));
  
  const clinicId = 'clinic_apex_101';
  const doctorId = 'doc_elena_1';
  const patientId = 'pat_miller_1';
  const serviceId = 'srv_cardiac_eval_1';
  const date = '2088-05-15';
  
  console.log("\nTest 1: Simultaneous Exact Overlap Booking (10:00)");
  const p1 = createAppointment(clinicId, { patientId, doctorId, serviceId, date, startTime: '10:00' });
  const p2 = createAppointment(clinicId, { patientId, doctorId, serviceId, date, startTime: '10:00' });
  
  const [res1, res2] = await Promise.all([p1, p2]);
  console.log("Result 1:", res1);
  console.log("Result 2:", res2);
  
  const successCount = (res1.success ? 1 : 0) + (res2.success ? 1 : 0);
  const rejectCount = (res1.error_code === 'SLOT_NO_LONGER_AVAILABLE' ? 1 : 0) + 
                      (res2.error_code === 'SLOT_NO_LONGER_AVAILABLE' ? 1 : 0);
                      
  if (successCount === 1 && rejectCount === 1) {
     console.log("Test 1 PASSED: Exactly one succeeded, exactly one rejected with SLOT_NO_LONGER_AVAILABLE");
  } else {
     console.error("Test 1 FAILED:", successCount, rejectCount);
  }

  console.log("\nTest 2: Overlapping Variable Durations (10:15 for 30m vs existing 10:00 for 30m)");
  const res3 = await createAppointment(clinicId, { patientId, doctorId, serviceId, date, startTime: '10:15' });
  console.log("Result 3:", res3);
  if (res3.error_code === 'SLOT_NO_LONGER_AVAILABLE') {
     console.log("Test 2 PASSED: Rejected overlapping variable duration correctly.");
  } else {
     console.error("Test 2 FAILED:", res3);
  }
}
run().catch(console.error);
