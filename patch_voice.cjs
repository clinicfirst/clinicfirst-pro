const fs = require('fs');
let code = fs.readFileSync('server/routes/voice.routes.ts', 'utf-8');

// We need to import db create tools
if (!code.includes('createAppointment')) {
  code = code.replace(
    "import { getAvailableSlots } from '../voice/tools/get-available-slots';",
    "import { getAvailableSlots } from '../voice/tools/get-available-slots';\nimport { createAppointment } from '../voice/tools/create-appointment';"
  );
}

// Modify the tool supported check
code = code.replace(
  "if (tool !== 'check_availability') {",
  "if (tool !== 'check_availability' && tool !== 'book_appointment') {"
);

// We need to implement the book_appointment block
const block = `
    if (tool === 'book_appointment') {
      const { patient_name, patient_phone, time } = req.body;
      
      if (!patient_name || !patient_phone || !date || !time || !service) {
        return res.json({
          success: false,
          error_code: "MISSING_INFORMATION",
          message: "Patient name, mobile number, service, date, and time are required to book.",
          requires_clarification: true
        });
      }

      if (!resolvedServiceId) {
        return res.json({
           success: false,
           error_code: "INVALID_SERVICE",
           message: \`Service "\${service}" not found or ambiguous.\`,
           requires_clarification: true
        });
      }

      // If doctor is provided but ambiguous/not found
      if (doctor && typeof doctor === 'string' && !resolvedDoctorId) {
        return res.json({
           success: false,
           error_code: "INVALID_DOCTOR",
           message: \`Doctor "\${doctor}" not found or ambiguous.\`,
           requires_clarification: true
        });
      }

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

      // Book the appointment
      const result = await createAppointment(clinic_id, {
        patientId: patient.id,
        doctorId: finalDoctorId,
        serviceId: resolvedServiceId,
        date: date,
        startTime: time,
        notes: "Booked via Sarvam AI Receptionist"
      });

      if (result.error) {
         return res.json({
           success: false,
           error_code: "BOOKING_FAILED",
           message: result.error,
           suggest_retry_availability: true
         });
      }

      return res.json({
        success: true,
        appointment_id: result.appointment_id,
        appointment_date: result.date,
        appointment_time: result.start_time,
        doctor: result.doctor_name,
        service: result.service_name
      });
    }

    // 4. Call existing availability logic
`;

// Insert the block right before "4. Call existing availability logic"
code = code.replace("    // 4. Call existing availability logic", block);

fs.writeFileSync('server/routes/voice.routes.ts', code);
console.log('Patched');
