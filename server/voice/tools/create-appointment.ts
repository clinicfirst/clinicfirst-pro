import { EscalationService } from "../../services/escalation.service";
import { db } from '../../db';
import { ClinicService } from '../../services/clinic.service';
import { supabase } from '../../supabaseDiff';
import { Appointment } from '../../../src/types';
import { AppointmentService, AppointmentMutationSource } from '../../services/appointment.service';
import { AiAgentService } from '../../services/ai-agent.service';

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
  const source: AppointmentMutationSource = { type: 'AI', name: 'AI Receptionist' };
  const result = await AppointmentService.book(clinicId, params, source);

  if (!result.success) {
    return { 
      error: result.error, 
      error_code: result.error_code, 
      suggest_retry_availability: result.suggest_retry_availability 
    };
  }

  return {
    success: true,
    appointment_id: result.appointment?.id,
    patient_name: result.patient_name,
    doctor_name: result.doctor_name,
    service_name: result.service_name,
    date: result.date,
    start_time: result.start_time,
    end_time: result.end_time,
    confirmation_message: `Appointment successfully confirmed for ${result.patient_name} with ${result.doctor_name} for ${result.service_name} on ${result.date} at ${result.start_time}.`,
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
  const source: AppointmentMutationSource = { type: 'AI', name: 'AI Receptionist' };
  const result = await AppointmentService.reschedule(clinicId, params.appointmentId, {
    newDate: params.newDate,
    newStartTime: params.newStartTime,
    reason: params.reason
  }, source);

  if (!result.success) {
    return { 
      error: result.error, 
      error_code: result.error_code, 
      suggest_retry_availability: result.suggest_retry_availability 
    };
  }

  return {
    success: true,
    appointment_id: result.appointment?.id,
    patient_name: result.patient_name,
    doctor_name: result.doctor_name,
    new_date: result.new_date,
    new_start_time: result.new_start_time,
    message: `Appointment successfully rescheduled to ${result.new_date} at ${result.new_start_time}.`,
  };
}

export async function cancelAppointment(
  clinicId: string,
  params: {
    appointmentId: string;
    reason?: string;
  }
) {
  const source: AppointmentMutationSource = { type: 'AI', name: 'AI Receptionist' };
  const result = await AppointmentService.updateStatus(clinicId, params.appointmentId, {
    status: 'CANCELLED',
    notes: params.reason
  }, source);

  if (!result.success) {
    return { error: result.error, error_code: result.error_code };
  }

  return {
    success: true,
    appointment_id: result.appointment?.id,
    message: `Appointment on ${result.date} at ${result.start_time} has been cancelled as requested.`,
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
  const clinic = (await ClinicService.getById(clinicId));
  const agent = await AiAgentService.getAgentByClinic(clinicId);

  const escalation = await EscalationService.createEscalation(clinicId, {
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
