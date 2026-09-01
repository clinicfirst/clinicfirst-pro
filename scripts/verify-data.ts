import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function run() {
  const { data: appts, error } = await supabase.from('appointments').select('*');
  if (error) {
     console.error("Failed to fetch appointments:", error); 
     return;
  }
  
  let overlaps = 0;
  let nullDoctorId = 0;
  let invalidDate = 0;
  let nullStartTime = 0;
  let nullEndTime = 0;
  let malformedTime = 0;
  let negativeDuration = 0;
  let zeroDuration = 0;
  let unexpectedStatus = 0;

  const validStatuses = ['CONFIRMED', 'REQUESTED', 'RESCHEDULED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'];
  const activeStatuses = ['CONFIRMED', 'REQUESTED', 'RESCHEDULED'];
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  for (let i = 0; i < appts.length; i++) {
     const a = appts[i];
     
     if (!a.doctor_id) nullDoctorId++;
     if (!a.date || !dateRegex.test(a.date)) invalidDate++;
     if (!a.start_time) nullStartTime++;
     else if (!timeRegex.test(a.start_time)) malformedTime++;
     if (!a.end_time) nullEndTime++;
     else if (!timeRegex.test(a.end_time)) malformedTime++;
     
     if (!validStatuses.includes(a.status)) unexpectedStatus++;

     if (a.start_time && a.end_time && timeRegex.test(a.start_time) && timeRegex.test(a.end_time)) {
        if (a.end_time < a.start_time) negativeDuration++;
        else if (a.end_time === a.start_time) zeroDuration++;
     }

     if (activeStatuses.includes(a.status)) {
         for (let j = i + 1; j < appts.length; j++) {
            const b = appts[j];
            if (activeStatuses.includes(b.status) && a.clinic_id === b.clinic_id && a.doctor_id === b.doctor_id && a.date === b.date) {
               if (a.start_time < b.end_time && a.end_time > b.start_time) {
                   overlaps++;
               }
            }
         }
     }
  }

  console.log(`Total appointments: ${appts.length}`);
  console.log(`Overlapping active appointments: ${overlaps}`);
  console.log(`NULL doctor_id: ${nullDoctorId}`);
  console.log(`NULL/invalid date: ${invalidDate}`);
  console.log(`NULL start time: ${nullStartTime}`);
  console.log(`NULL end time: ${nullEndTime}`);
  console.log(`Malformed time strings: ${malformedTime}`);
  console.log(`End time < start time: ${negativeDuration}`);
  console.log(`Zero-duration appointments: ${zeroDuration}`);
  console.log(`Unexpected statuses: ${unexpectedStatus}`);
}
run().catch(console.error);
