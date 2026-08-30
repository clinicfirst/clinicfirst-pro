import { Router } from 'express';
import { db } from '../db';
import { getAvailableSlots } from '../voice/tools/get-available-slots';
import { createAppointment, cancelAppointment } from '../voice/tools/create-appointment';

export const voiceRouter = Router();

// Sarvam API Tool Authentication
const CLINICFIRST_AI_TOOL_SECRET = process.env.CLINICFIRST_AI_TOOL_SECRET || '';

// A simple fuzzy match helper for strings
function fuzzyMatch(str1: string, str2: string) {
  if (!str1 || !str2) return false;
  return str1.toLowerCase().replace(/[^a-z0-9]/g, '').includes(str2.toLowerCase().replace(/[^a-z0-9]/g, '')) ||
         str2.toLowerCase().replace(/[^a-z0-9]/g, '').includes(str1.toLowerCase().replace(/[^a-z0-9]/g, ''));
}

voiceRouter.post('/webhook/sarvam/:provider_agent_id', async (req, res) => {
  try {
    const { provider_agent_id } = req.params;
    
    // 1. Validate Secret
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
    const token = authHeader.split(' ')[1];
    if (!CLINICFIRST_AI_TOOL_SECRET || token !== CLINICFIRST_AI_TOOL_SECRET) {
      return res.status(403).json({ error: 'Invalid tool secret' });
    }

    // 2. Resolve Agent and Clinic
    const agent = db.data.ai_agents.find(a => a.provider_agent_id === provider_agent_id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found for this provider_agent_id' });
    }
    
    const platformConfig = db.data.platform_ai_config;
    if (platformConfig?.status === 'INACTIVE') {
      return res.status(403).json({ error: 'Platform AI features are currently disabled.' });
    }

    if (agent.status !== 'ACTIVE' && agent.status !== 'TESTING') { 
      return res.status(403).json({ error: 'This AI Receptionist is currently disabled.' });
    }

    const clinic_id = agent.clinic_id;

    // 3. Process the tool invocation
    const { tool, service, doctor, date, preferred_time } = req.body;
    
    // Basic log
    console.log(`[Sarvam Webhook] Agent: ${provider_agent_id} | Clinic: ${clinic_id} | Tool: ${tool} | Payload:`, req.body);

    if (tool !== 'check_availability' && tool !== 'book_appointment' && tool !== 'cancel_appointment') {
      return res.status(400).json({ error: `Tool ${tool} not supported` });
    }

    let resolvedServiceId: string | undefined = undefined;
    let resolvedDoctorId: string | undefined = undefined;

    // Resolve service by name within the clinic
    if (service && typeof service === 'string') {
      const services = db.getServices(clinic_id);
      const matches = services.filter(s => fuzzyMatch(s.name, service) && s.status === 'ACTIVE');
      if (matches.length === 1) {
        resolvedServiceId = matches[0].id;
      } else if (matches.length > 1) {
        return res.json({ available: false, error: `Multiple services matched "${service}". Please clarify.`, slots: [] });
      } else {
        return res.json({ available: false, error: `Service "${service}" not found at this clinic.`, slots: [] });
      }
    }

    // Resolve doctor by name within the clinic
    if (doctor && typeof doctor === 'string') {
      const doctors = db.getDoctors(clinic_id);
      const matches = doctors.filter(d => fuzzyMatch(d.name, doctor) && d.status === 'ACTIVE');
      if (matches.length === 1) {
        resolvedDoctorId = matches[0].id;
      } else if (matches.length > 1) {
        return res.json({ available: false, error: `Multiple doctors matched "${doctor}". Please clarify.`, slots: [] });
      } else {
        return res.json({ available: false, error: `Doctor "${doctor}" not found at this clinic.`, slots: [] });
      }
    }

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
           message: `Service "${service}" not found or ambiguous.`,
           requires_clarification: true
        });
      }

      // If doctor is provided but ambiguous/not found
      if (doctor && typeof doctor === 'string' && !resolvedDoctorId) {
        return res.json({
           success: false,
           error_code: "INVALID_DOCTOR",
           message: `Doctor "${doctor}" not found or ambiguous.`,
           requires_clarification: true
        });
      }

      // Patient lookup/creation (do this first for idempotency)
      let patient = db.getPatientByPhone(clinic_id, patient_phone);
      if (!patient) {
        patient = {
          id: `pat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
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

    if (tool === 'cancel_appointment') {
      const { patient_phone, date, time } = req.body;
      
      if (!patient_phone) {
        return res.json({
          success: false,
          error_code: "MISSING_INFORMATION",
          message: "Patient mobile number is required to locate the appointment.",
          requires_clarification: true
        });
      }

      const patient = db.getPatientByPhone(clinic_id, patient_phone);
      if (!patient) {
        return res.json({
          success: false,
          error_code: "PATIENT_NOT_FOUND",
          message: "No patient found with this mobile number.",
          requires_clarification: true
        });
      }

      // Find appointments for this patient + clinic
      let allAppts = db.data.appointments.filter(a => 
        a.clinic_id === clinic_id && 
        a.patient_id === patient.id
      );

      if (date) allAppts = allAppts.filter(a => a.date === date);
      if (time) allAppts = allAppts.filter(a => a.start_time === time);
      if (resolvedDoctorId) allAppts = allAppts.filter(a => a.doctor_id === resolvedDoctorId);
      if (resolvedServiceId) allAppts = allAppts.filter(a => a.service_id === resolvedServiceId);

      if (allAppts.length === 0) {
        return res.json({
          success: false,
          error_code: "APPOINTMENT_NOT_FOUND",
          message: "No matching appointments found for this patient.",
          requires_clarification: true
        });
      }

      const activeAppts = allAppts.filter(a => !['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(a.status));

      if (activeAppts.length === 0) {
        // All matching appointments are already cancelled or completed
        const targetAppt = allAppts[0];
        if (targetAppt.status === 'CANCELLED') {
          return res.json({
            success: false,
            error_code: "ALREADY_CANCELLED",
            message: "This appointment has already been cancelled."
          });
        }
        return res.json({
          success: false,
          error_code: "CANCELLATION_NOT_ALLOWED",
          message: "This appointment cannot be cancelled because it is already marked as completed or no-show."
        });
      }

      if (activeAppts.length > 1) {
        return res.json({
          success: false,
          error_code: "AMBIGUOUS_APPOINTMENT",
          message: "Multiple active appointments match the criteria. Please ask the patient to clarify which one to cancel.",
          requires_clarification: true,
          matching_appointments: activeAppts.map(a => ({
            appointment_id: a.id,
            date: a.date,
            time: a.start_time,
            doctor: db.getDoctorById(clinic_id, a.doctor_id)?.name,
            service: db.getServiceById(clinic_id, a.service_id)?.name
          }))
        });
      }

      const targetAppt = activeAppts[0];

      // Check if it has already occurred
      const nowStr = new Date().toISOString().split('T')[0];
      if (targetAppt.date < nowStr) {
         return res.json({
          success: false,
          error_code: "CANCELLATION_NOT_ALLOWED",
          message: "This appointment cannot be cancelled because it is in the past."
        });
      }

      const result = await cancelAppointment(clinic_id, {
        appointmentId: targetAppt.id,
        reason: "Cancelled via Sarvam AI Receptionist"
      });

      if (result.error) {
        return res.json({
          success: false,
          error_code: "CANCELLATION_FAILED",
          message: result.error
        });
      }

      return res.json({
        success: true,
        appointment_id: targetAppt.id,
        status: "cancelled",
        appointment_date: targetAppt.date,
        appointment_time: targetAppt.start_time
      });
    }

    // 4. Call existing availability logic
    // Using date directly. getAvailableSlots expects YYYY-MM-DD
    const slotsResponse = await getAvailableSlots(clinic_id, {
      doctorId: resolvedDoctorId,
      serviceId: resolvedServiceId,
      date: date // YYYY-MM-DD
    });
    
    if (slotsResponse.error) {
      return res.json({ available: false, error: slotsResponse.error, slots: [] });
    }

    // 5. Structure the voice-friendly response
    let slots = slotsResponse.slots || [];
    
    if (preferred_time) {
       // Just returning all valid slots is generally better for the AI to pick from if preferred_time isn't exact,
       // but we could filter or highlight it. Let's just return what we have so the AI can decide.
    }

    // Return the response
    return res.json({
      available: slotsResponse.available,
      date: slotsResponse.date,
      reason: slotsResponse.reason,
      total_slots_found: slotsResponse.total_slots_found,
      slots: slots.map(s => ({
        start: s.time,
        end: s.endTime,
        doctor: s.doctorName
      }))
    });

  } catch (error: any) {
    console.error('[Sarvam Webhook Error]', error);
    return res.status(500).json({ error: 'Internal server error processing the tool' });
  }
});
