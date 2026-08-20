import { db } from '../../db';
import { Appointment } from '../../../src/types';

export async function createAppointment(
  clinicId: string,
  params: {
    patientId: string;
    doctorId: string;
    serviceId: string;
    date: string;
    startTime: string;
    notes?: string;
  }
) {
  const { patientId, doctorId, serviceId, date, startTime, notes } = params;

  if (!patientId || !doctorId || !serviceId || !date || !startTime) {
    return { error: 'Missing required parameters: patientId, doctorId, serviceId, date, startTime are all required.' };
  }

  const doctor = db.getDoctorById(clinicId, doctorId);
  if (!doctor || doctor.status !== 'ACTIVE') {
    return { error: 'Doctor not found or currently inactive.' };
  }

  const service = db.getServiceById(clinicId, serviceId);
  if (!service || service.status !== 'ACTIVE') {
    return { error: 'Service not found or currently inactive.' };
  }

  const patient = db.getPatientById(clinicId, patientId);
  if (!patient) {
    return { error: 'Patient not found. Please register patient first.' };
  }

  // Calculate end time
  const [h, m] = startTime.split(':').map(Number);
  const totalMin = h * 60 + m + service.duration_minutes;
  const endH = Math.floor(totalMin / 60);
  const endM = totalMin % 60;
  const endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

  const appointmentPayload: Appointment = {
    id: `apt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    clinic_id: clinicId,
    patient_id: patientId,
    doctor_id: doctorId,
    service_id: serviceId,
    date,
    start_time: startTime,
    end_time: endTime,
    status: 'CONFIRMED',
    created_via: 'ai_receptionist',
    notes: notes || 'Booked via AI Receptionist voice interaction',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const result = db.createAppointment(appointmentPayload);
  if (!result.success) {
    return { error: result.error };
  }

  // Log audit
  db.logAudit({
    clinic_id: clinicId,
    actor_user_id: 'ai_receptionist',
    actor_name: 'AI Receptionist',
    action: 'APPOINTMENT_BOOKED_BY_AI',
    target_type: 'APPOINTMENT',
    target_id: appointmentPayload.id,
    metadata: {
      patient_name: patient.name,
      doctor_name: doctor.name,
      service_name: service.name,
      date,
      start_time: startTime,
    },
  });

  return {
    success: true,
    appointment_id: appointmentPayload.id,
    patient_name: patient.name,
    doctor_name: doctor.name,
    service_name: service.name,
    date,
    start_time: startTime,
    end_time: endTime,
    confirmation_message: `Appointment successfully confirmed for ${patient.name} with ${doctor.name} for ${service.name} on ${date} at ${startTime}.`,
  };
}

export async function rescheduleAppointment(
  clinicId: string,
  params: {
    appointmentId: string;
    newDate: string;
    newStartTime: string;
    reason?: string;
  }
) {
  const { appointmentId, newDate, newStartTime, reason } = params;
  if (!appointmentId || !newDate || !newStartTime) {
    return { error: 'appointmentId, newDate, and newStartTime are required.' };
  }

  const existing = db.getAppointmentById(clinicId, appointmentId);
  if (!existing) {
    return { error: 'Appointment not found.' };
  }

  const service = db.getServiceById(clinicId, existing.service_id);
  const duration = service?.duration_minutes || 30;

  const [h, m] = newStartTime.split(':').map(Number);
  const totalMin = h * 60 + m + duration;
  const endH = Math.floor(totalMin / 60);
  const endM = totalMin % 60;
  const newEndTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

  const result = db.updateAppointment(clinicId, appointmentId, {
    date: newDate,
    start_time: newStartTime,
    end_time: newEndTime,
    status: 'RESCHEDULED',
    notes: `${existing.notes || ''} | Rescheduled via AI: ${reason || 'Patient request'}`,
  });

  if (!result.success) {
    return { error: result.error };
  }

  db.logAudit({
    clinic_id: clinicId,
    actor_user_id: 'ai_receptionist',
    actor_name: 'AI Receptionist',
    action: 'APPOINTMENT_RESCHEDULED_BY_AI',
    target_type: 'APPOINTMENT',
    target_id: appointmentId,
    metadata: {
      old_date: existing.date,
      old_time: existing.start_time,
      new_date: newDate,
      new_time: newStartTime,
    },
  });

  return {
    success: true,
    appointment_id: appointmentId,
    patient_name: existing.patient?.name,
    doctor_name: existing.doctor?.name,
    new_date: newDate,
    new_start_time: newStartTime,
    message: `Appointment successfully rescheduled to ${newDate} at ${newStartTime}.`,
  };
}

export async function cancelAppointment(
  clinicId: string,
  params: {
    appointmentId: string;
    reason?: string;
  }
) {
  const { appointmentId, reason } = params;
  if (!appointmentId) {
    return { error: 'appointmentId is required to cancel.' };
  }

  const existing = db.getAppointmentById(clinicId, appointmentId);
  if (!existing) {
    return { error: 'Appointment not found.' };
  }

  const result = db.updateAppointment(clinicId, appointmentId, {
    status: 'CANCELLED',
    notes: `${existing.notes || ''} | Cancelled via AI Receptionist: ${reason || 'Patient requested cancellation'}`,
  });

  if (!result.success) {
    return { error: result.error };
  }

  db.logAudit({
    clinic_id: clinicId,
    actor_user_id: 'ai_receptionist',
    actor_name: 'AI Receptionist',
    action: 'APPOINTMENT_CANCELLED_BY_AI',
    target_type: 'APPOINTMENT',
    target_id: appointmentId,
    metadata: {
      patient_name: existing.patient?.name,
      doctor_name: existing.doctor?.name,
      date: existing.date,
      reason,
    },
  });

  return {
    success: true,
    appointment_id: appointmentId,
    message: `Appointment on ${existing.date} at ${existing.start_time} has been cancelled as requested.`,
  };
}

export async function escalateToStaff(
  clinicId: string,
  params: {
    callId?: string;
    reason: string;
    priority?: 'urgent' | 'normal';
    patientName?: string;
    patientPhone?: string;
    contextSummary: string;
  }
) {
  const clinic = db.getClinicById(clinicId);
  const agent = db.getAiAgent(clinicId);

  const escalation = db.createEscalation({
    id: `esc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    clinic_id: clinicId,
    call_id: params.callId || 'call_direct',
    reason: params.reason,
    priority: params.priority || 'normal',
    context_summary: params.contextSummary,
    status: 'pending',
    created_at: new Date().toISOString(),
  });

  const contactPhone = agent?.escalation_contact?.phone || clinic?.phone || 'Front Desk';
  const contactName = agent?.escalation_contact?.name || 'Reception Staff';

  return {
    escalated: true,
    escalation_id: escalation.id,
    contact_phone: contactPhone,
    contact_name: contactName,
    message: `I have notified our clinic staff (${contactName}) regarding your request. You may also connect directly at ${contactPhone}.`,
  };
}
