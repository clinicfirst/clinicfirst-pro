import { db } from '../db';
import { supabase } from '../supabaseDiff';
import { Appointment } from '../../src/types';

export type AppointmentMutationSource = 
  | { type: 'AI'; agentId?: string; name: string }
  | { type: 'HUMAN_RECEPTIONIST' | 'CLINIC_ADMIN'; userId: string; name: string };

export type BookParams = {
  patientId: string;
  doctorId: string;
  serviceId: string;
  date: string;
  startTime: string;
  notes?: string;
};

export type RescheduleParams = {
  newDate: string;
  newStartTime: string;
  reason?: string;
};

export type StatusParams = {
  status: 'CONFIRMED' | 'CANCELLED' | 'REQUESTED' | 'COMPLETED' | 'NO_SHOW';
  notes?: string;
};

export class AppointmentService {
  static async book(clinicId: string, params: BookParams, source: AppointmentMutationSource) {
    const { patientId, doctorId, serviceId, date, startTime, notes } = params;
    
    // 1. Business Validation
    if (!patientId || !doctorId || !serviceId || !date || !startTime) {
      return { success: false, error_code: 'VALIDATION_ERROR', error: 'Missing required parameters.' };
    }

    const doctor = db.getDoctorById(clinicId, doctorId);
    if (!doctor || doctor.status !== 'ACTIVE') {
      return { success: false, error_code: 'DOCTOR_NOT_FOUND', error: 'Doctor not found or currently inactive.' };
    }

    const service = db.getServiceById(clinicId, serviceId);
    if (!service || service.status !== 'ACTIVE') {
      return { success: false, error_code: 'SERVICE_NOT_FOUND', error: 'Service not found or currently inactive.' };
    }

    const patient = db.getPatientById(clinicId, patientId);
    if (!patient) {
      return { success: false, error_code: 'PATIENT_NOT_FOUND', error: 'Patient not found.' };
    }

    // Leave check
    const isOnLeave = db.data.doctor_leaves.find(
      (l) =>
        l.clinic_id === clinicId &&
        l.doctor_id === doctorId &&
        date >= l.start_date &&
        date <= l.end_date
    );
    if (isOnLeave) {
      return { success: false, error_code: 'VALIDATION_ERROR', error: `Doctor is on scheduled leave on ${date} (${isOnLeave.reason}).` };
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
      created_via: source.type === 'AI' ? 'ai_receptionist' : 'staff',
      notes: notes || `Booked via ${source.type === 'AI' ? 'AI Receptionist' : 'web dashboard'}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 2. Authoritative PostgreSQL Mutation
    if (!supabase) {
      return { success: false, error_code: 'DATABASE_ERROR', error: 'Database connection not available.' };
    }

    const { notes: _notes, ...pgPayload } = appointmentPayload;
    const { error: pgError } = await supabase.from('appointments').insert(pgPayload);

    if (pgError) {
      if (pgError.code === '23P01') {
        return { 
          success: false, 
          error_code: 'SLOT_NO_LONGER_AVAILABLE', 
          suggest_retry_availability: true, 
          error: 'The requested time slot is no longer available.' 
        };
      }
      return { success: false, error_code: 'DATABASE_ERROR', error: 'Failed to book appointment due to a database error.' };
    }

    // 3. Post-commit Side Effects
    // Update local memory
    db.data.appointments.push(appointmentPayload);
    db.flush();

    // Log audit
    db.logAudit({
      clinic_id: clinicId,
      actor_user_id: source.type === 'AI' ? (source.agentId || 'ai_receptionist') : source.userId,
      actor_name: source.name,
      action: source.type === 'AI' ? 'APPOINTMENT_BOOKED_BY_AI' : 'APPOINTMENT_BOOKED_BY_STAFF',
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
      appointment: appointmentPayload,
      patient_name: patient.name,
      doctor_name: doctor.name,
      service_name: service.name,
      date,
      start_time: startTime,
      end_time: endTime,
    };
  }

  static async reschedule(clinicId: string, appointmentId: string, params: RescheduleParams, source: AppointmentMutationSource) {
    const { newDate, newStartTime, reason } = params;

    if (!appointmentId || !newDate || !newStartTime) {
      return { success: false, error_code: 'VALIDATION_ERROR', error: 'appointmentId, newDate, and newStartTime are required.' };
    }

    const existing = db.getAppointmentById(clinicId, appointmentId);
    if (!existing) {
      return { success: false, error_code: 'APPOINTMENT_NOT_FOUND', error: 'Appointment not found.' };
    }

    const service = db.getServiceById(clinicId, existing.service_id);
    const duration = service?.duration_minutes || 30;

    const [h, m] = newStartTime.split(':').map(Number);
    const totalMin = h * 60 + m + duration;
    const endH = Math.floor(totalMin / 60);
    const endM = totalMin % 60;
    const newEndTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

    // 1. Business Validation
    const isOnLeave = db.data.doctor_leaves.find(
      (l) =>
        l.clinic_id === clinicId &&
        l.doctor_id === existing.doctor_id &&
        newDate >= l.start_date &&
        newDate <= l.end_date
    );
    if (isOnLeave) {
      return { success: false, error_code: 'VALIDATION_ERROR', error: `Doctor is on scheduled leave on ${newDate} (${isOnLeave.reason}).` };
    }

    // 2. Authoritative PostgreSQL Mutation
    if (!supabase) {
      return { success: false, error_code: 'DATABASE_ERROR', error: 'Database connection not available.' };
    }

    const newNotes = `${existing.notes || ''} | Rescheduled via ${source.type === 'AI' ? 'AI' : 'Staff'}: ${reason || 'Update'}`;
    const updatedFields = {
      date: newDate,
      start_time: newStartTime,
      end_time: newEndTime,
      status: 'RESCHEDULED' as const,
      updated_at: new Date().toISOString(),
    };

    const { error: pgError } = await supabase
      .from('appointments')
      .update(updatedFields)
      .eq('id', appointmentId)
      .eq('clinic_id', clinicId);

    if (pgError) {
      if (pgError.code === '23P01') {
        return { 
          success: false, 
          error_code: 'SLOT_NO_LONGER_AVAILABLE', 
          suggest_retry_availability: true, 
          error: 'The requested time slot is no longer available.' 
        };
      }
      return { success: false, error_code: 'DATABASE_ERROR', error: 'Failed to reschedule appointment due to a database error.' };
    }

    // 3. Post-commit Side Effects
    // Update local memory
    const idx = db.data.appointments.findIndex((a) => a.id === appointmentId);
    let updatedAppointment: any = existing;
    if (idx >= 0) {
      db.data.appointments[idx] = {
        ...db.data.appointments[idx],
        ...updatedFields,
        notes: newNotes,
      };
      updatedAppointment = db.data.appointments[idx];
      db.flush();
    }

    db.logAudit({
      clinic_id: clinicId,
      actor_user_id: source.type === 'AI' ? (source.agentId || 'ai_receptionist') : source.userId,
      actor_name: source.name,
      action: source.type === 'AI' ? 'APPOINTMENT_RESCHEDULED_BY_AI' : 'APPOINTMENT_RESCHEDULED_BY_STAFF',
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
      appointment: updatedAppointment,
      patient_name: existing.patient?.name,
      doctor_name: existing.doctor?.name,
      new_date: newDate,
      new_start_time: newStartTime,
    };
  }

  static async updateStatus(clinicId: string, appointmentId: string, params: StatusParams, source: AppointmentMutationSource) {
    const { status, notes } = params;

    if (!appointmentId || !status) {
      return { success: false, error_code: 'VALIDATION_ERROR', error: 'appointmentId and status are required.' };
    }

    const existing = db.getAppointmentById(clinicId, appointmentId);
    if (!existing) {
      return { success: false, error_code: 'APPOINTMENT_NOT_FOUND', error: 'Appointment not found.' };
    }

    if (!supabase) {
      return { success: false, error_code: 'DATABASE_ERROR', error: 'Database connection not available.' };
    }

    // Determine notes update logic
    let newNotes = existing.notes;
    if (notes) {
      if (status === 'CANCELLED') {
        newNotes = `${existing.notes || ''} | Cancelled via ${source.type === 'AI' ? 'AI Receptionist' : 'Staff'}: ${notes}`;
      } else {
        newNotes = notes;
      }
    } else if (status === 'CANCELLED' && source.type === 'AI') {
      newNotes = `${existing.notes || ''} | Cancelled via AI Receptionist`;
    }

    const updatedFields = {
      status,
      updated_at: new Date().toISOString(),
    };

    // Authoritative PostgreSQL Mutation
    const { error: pgError } = await supabase
      .from('appointments')
      .update(updatedFields)
      .eq('id', appointmentId)
      .eq('clinic_id', clinicId);

    if (pgError) {
      return { success: false, error_code: 'DATABASE_ERROR', error: 'Failed to update appointment status due to a database error.' };
    }

    // Sync local memory
    const idx = db.data.appointments.findIndex((a) => a.id === appointmentId);
    let updatedAppointment: any = existing;
    if (idx >= 0) {
      db.data.appointments[idx] = {
        ...db.data.appointments[idx],
        ...updatedFields,
        notes: newNotes,
      };
      updatedAppointment = db.data.appointments[idx];
      db.flush();
    }

    let actionLabel = `APPOINTMENT_STATUS_${status}`;
    if (status === 'CANCELLED' && source.type === 'AI') {
       actionLabel = 'APPOINTMENT_CANCELLED_BY_AI';
    }

    db.logAudit({
      clinic_id: clinicId,
      actor_user_id: source.type === 'AI' ? (source.agentId || 'ai_receptionist') : source.userId,
      actor_name: source.name,
      action: actionLabel,
      target_type: 'APPOINTMENT',
      target_id: appointmentId,
      metadata: { status, reason: notes },
    });

    return {
      success: true,
      appointment: updatedAppointment,
      patient_name: existing.patient?.name,
      doctor_name: existing.doctor?.name,
      date: existing.date,
      start_time: existing.start_time
    };
  }
}
