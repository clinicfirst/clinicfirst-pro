const fs = require('fs');
let code = fs.readFileSync('server/routes/voice.routes.ts', 'utf-8');

// I will re-write the book_appointment block to fix the order
const searchBlock = `
      // If doctor is not specified, we must pick one that is available for this service at this time.
      // But actually, getAvailableSlots handles no doctor provided by returning slots for all capable doctors.
      // We MUST have a doctor to book.
      
      // Let's run availability to find the specific slot.
      const slotsResponse = await getAvailableSlots(clinic_id, {
        doctorId: resolvedDoctorId,
        serviceId: resolvedServiceId,
        date: date
      });

      if (slotsResponse.error || !slotsResponse.slots) {
         return res.json({
           success: false,
           error_code: "SLOT_NO_LONGER_AVAILABLE",
           message: slotsResponse.error || "The requested date is unavailable.",
           suggest_retry_availability: true
         });
      }

      // Find the exact slot
      const exactSlot = slotsResponse.slots.find(s => s.time === time && (!resolvedDoctorId || s.doctorId === resolvedDoctorId));

      if (!exactSlot) {
         return res.json({
           success: false,
           error_code: "SLOT_NO_LONGER_AVAILABLE",
           message: "The requested time slot is no longer available. Please suggest another time.",
           suggest_retry_availability: true
         });
      }

      const finalDoctorId = exactSlot.doctorId;

      // Patient lookup/creation
      let patient = db.getPatientByPhone(clinic_id, patient_phone);
      if (!patient) {
        patient = {
          id: \`pat_\${Date.now()}_\${Math.random().toString(36).substring(2, 6)}\`,
          clinic_id,
          name: patient_name,
          phone: patient_phone,
          preferred_language: 'English',
          created_at: new Date().toISOString()
        };
        db.createPatient(patient);
      }

      // Idempotency check
      const existingAppt = db.data.appointments.find(a => 
        a.clinic_id === clinic_id && 
        a.patient_id === patient!.id &&
        a.doctor_id === finalDoctorId &&
        a.date === date && 
        a.start_time === time &&
        ['CONFIRMED', 'REQUESTED'].includes(a.status)
      );

      if (existingAppt) {
         return res.json({
           success: true,
           appointment_id: existingAppt.id,
           appointment_date: existingAppt.date,
           appointment_time: existingAppt.start_time,
           doctor: db.getDoctorById(clinic_id, existingAppt.doctor_id)?.name,
           service: db.getServiceById(clinic_id, existingAppt.service_id)?.name,
           message: "Appointment was already booked successfully."
         });
      }
`;

const replaceBlock = `
      // Patient lookup/creation (do this first for idempotency)
      let patient = db.getPatientByPhone(clinic_id, patient_phone);
      if (!patient) {
        patient = {
          id: \`pat_\${Date.now()}_\${Math.random().toString(36).substring(2, 6)}\`,
          clinic_id,
          name: patient_name,
          phone: patient_phone,
          preferred_language: 'English',
          created_at: new Date().toISOString()
        };
        db.createPatient(patient);
      }

      // Idempotency check
      // We check if THIS patient already has an appointment on this date & time for this service.
      const existingAppt = db.data.appointments.find(a => 
        a.clinic_id === clinic_id && 
        a.patient_id === patient!.id &&
        a.date === date && 
        a.start_time === time &&
        (!resolvedDoctorId || a.doctor_id === resolvedDoctorId) &&
        ['CONFIRMED', 'REQUESTED'].includes(a.status)
      );

      if (existingAppt) {
         return res.json({
           success: true,
           appointment_id: existingAppt.id,
           appointment_date: existingAppt.date,
           appointment_time: existingAppt.start_time,
           doctor: db.getDoctorById(clinic_id, existingAppt.doctor_id)?.name,
           service: db.getServiceById(clinic_id, existingAppt.service_id)?.name,
           message: "Appointment was already booked successfully."
         });
      }

      // Let's run availability to find the specific slot.
      const slotsResponse = await getAvailableSlots(clinic_id, {
        doctorId: resolvedDoctorId,
        serviceId: resolvedServiceId,
        date: date
      });

      if (slotsResponse.error || !slotsResponse.slots) {
         return res.json({
           success: false,
           error_code: "SLOT_NO_LONGER_AVAILABLE",
           message: slotsResponse.error || "The requested date is unavailable.",
           suggest_retry_availability: true
         });
      }

      // Find the exact slot
      const exactSlot = slotsResponse.slots.find(s => s.time === time && (!resolvedDoctorId || s.doctorId === resolvedDoctorId));

      if (!exactSlot) {
         return res.json({
           success: false,
           error_code: "SLOT_NO_LONGER_AVAILABLE",
           message: "The requested time slot is no longer available. Please suggest another time.",
           suggest_retry_availability: true
         });
      }

      const finalDoctorId = exactSlot.doctorId;
`;

if (code.includes('// Let\'s run availability to find the specific slot.')) {
  code = code.replace(searchBlock, replaceBlock);
}

fs.writeFileSync('server/routes/voice.routes.ts', code);
console.log('Patched Idempotency');
