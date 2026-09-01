import { supabase } from '../server/supabaseDiff';

async function run() {
  const { error } = await supabase.from('appointments').insert({
    id: `apt_err_test`,
    clinic_id: 'clinic_apex_101',
    patient_id: 'pat_miller_1',
    doctor_id: 'doc_elena_1',
    service_id: 'srv_cardiac_eval_1',
    date: '2088-05-15',
    start_time: '10:00',
    end_time: '10:30',
    status: 'CONFIRMED',
    created_via: 'ai_receptionist',
    notes: 'Test',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  console.log("Error:", error);
}
run().catch(console.error);
