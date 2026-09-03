import { db } from '../../db';
import { ClinicService } from '../../services/clinic.service';
import { AppointmentService } from '../../services/appointment.service';
import { PatientService } from '../../services/patient.service';

export async function getPatientByPhone(clinicId: string, phone: string) {
  if (!phone) {
    return { error: 'Phone number is required to search for patient.' };
  }

  const patient = await PatientService.getByPhone(clinicId, phone);
  if (!patient) {
    return {
      found: false,
      message: 'No patient record found with this phone number. Ask if they are a new patient.',
    };
  }

  // Get active upcoming appointments
  const allAppointments = (await AppointmentService.list(clinicId));
  const patientAppointments = allAppointments
    .filter(
      (a) =>
        a.patient_id === patient.id &&
        ['CONFIRMED', 'REQUESTED', 'RESCHEDULED'].includes(a.status)
    )
    .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));

  return {
    found: true,
    patient_id: patient.id,
    name: patient.name,
    phone: patient.phone,
    email: patient.email || '',
    dob: patient.dob || '',
    preferred_language: patient.preferred_language,
    notes: patient.notes || '',
    upcoming_appointments: patientAppointments.map((a) => ({
      appointment_id: a.id,
      date: a.date,
      start_time: a.start_time,
      doctor_name: a.doctor?.name,
      service_name: a.service?.name,
      status: a.status,
    })),
  };
}

export async function createPatient(
  clinicId: string,
  params: {
    name: string;
    phone: string;
    email?: string;
    dob?: string;
    gender?: 'Male' | 'Female' | 'Other' | 'Prefer not to say';
    preferred_language?: string;
  }
) {
  if (!params.name || !params.phone) {
    return { error: 'Patient name and phone number are required.' };
  }

  const existing = await PatientService.getByPhone(clinicId, params.phone);
  if (existing) {
    return {
      success: true,
      patient_id: existing.id,
      name: existing.name,
      phone: existing.phone,
      message: 'Existing patient record retrieved.',
    };
  }

  const result = await PatientService.create(clinicId, {
    name: params.name.trim(),
    phone: params.phone.trim(),
    email: params.email?.trim(),
    dob: params.dob,
    gender: params.gender || 'Prefer not to say',
    preferred_language: params.preferred_language || 'English',
    notes: 'Registered via AI Receptionist voice call',
  });

  if (!result.success || !result.patient) {
    return {
      error: result.error || 'Failed to create patient record.',
    };
  }

  return {
    success: true,
    patient_id: result.patient.id,
    name: result.patient.name,
    phone: result.patient.phone,
    message: 'New patient record successfully created.',
  };
}
