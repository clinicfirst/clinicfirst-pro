import { getClinicInfo } from './get-clinic-info';
import { getPatientByPhone, createPatient } from './get-patient-by-phone';
import { getClinicDoctors, getClinicServices } from './get-clinic-doctors';
import { getAvailableSlots } from './get-available-slots';
import {
  createAppointment,
  rescheduleAppointment,
  cancelAppointment,
  escalateToStaff,
} from './create-appointment';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export const AI_RECEPTIONIST_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'getClinicInfo',
    description: 'Get clinic contact information, address, operating hours, and open status.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'getPatientByPhone',
    description: 'Look up a patient by their phone number to check registration and existing upcoming appointments.',
    parameters: {
      type: 'OBJECT',
      properties: {
        phone: {
          type: 'STRING',
          description: 'The patient phone number (e.g. 555-019-2834 or +1-555-019-2834)',
        },
      },
      required: ['phone'],
    },
  },
  {
    name: 'createPatient',
    description: 'Register a new patient record when a caller is a first-time patient.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Full legal or preferred name of the patient' },
        phone: { type: 'STRING', description: 'Patient contact phone number' },
        email: { type: 'STRING', description: 'Optional email address' },
        dob: { type: 'STRING', description: 'Date of birth YYYY-MM-DD if provided' },
        gender: { type: 'STRING', description: 'Male, Female, Other, or Prefer not to say' },
        preferred_language: { type: 'STRING', description: 'Preferred language, e.g. English, Spanish' },
      },
      required: ['name', 'phone'],
    },
  },
  {
    name: 'getClinicDoctors',
    description: 'Retrieve the list of active doctors and their specializations at the clinic.',
    parameters: {
      type: 'OBJECT',
      properties: {
        specialization: {
          type: 'STRING',
          description: 'Optional filter by specialty (e.g. cardiology, pediatrics, internal medicine)',
        },
      },
    },
  },
  {
    name: 'getClinicServices',
    description: 'Retrieve the list of clinical services, fees, and consultation durations offered.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'getAvailableSlots',
    description: 'Calculate and return available appointment time slots for a doctor/service on a given date (YYYY-MM-DD).',
    parameters: {
      type: 'OBJECT',
      properties: {
        date: { type: 'STRING', description: 'Target date in YYYY-MM-DD format' },
        doctorId: { type: 'STRING', description: 'Optional specific doctor ID' },
        serviceId: { type: 'STRING', description: 'Optional specific service ID' },
      },
      required: ['date'],
    },
  },
  {
    name: 'createAppointment',
    description: 'Confirm and book an appointment for a patient with a doctor and service at a specific date and time.',
    parameters: {
      type: 'OBJECT',
      properties: {
        patientId: { type: 'STRING', description: 'The unique patient ID' },
        doctorId: { type: 'STRING', description: 'The unique doctor ID' },
        serviceId: { type: 'STRING', description: 'The service ID' },
        date: { type: 'STRING', description: 'Appointment date in YYYY-MM-DD format' },
        startTime: { type: 'STRING', description: 'Appointment start time in HH:MM (24-hour) format' },
        notes: { type: 'STRING', description: 'Reason for visit or special notes' },
      },
      required: ['patientId', 'doctorId', 'serviceId', 'date', 'startTime'],
    },
  },
  {
    name: 'rescheduleAppointment',
    description: 'Reschedule an existing confirmed appointment to a new date and time.',
    parameters: {
      type: 'OBJECT',
      properties: {
        appointmentId: { type: 'STRING', description: 'The ID of the existing appointment' },
        newDate: { type: 'STRING', description: 'New date in YYYY-MM-DD format' },
        newStartTime: { type: 'STRING', description: 'New start time in HH:MM format' },
        reason: { type: 'STRING', description: 'Reason for rescheduling' },
      },
      required: ['appointmentId', 'newDate', 'newStartTime'],
    },
  },
  {
    name: 'cancelAppointment',
    description: 'Cancel an existing confirmed appointment upon patient request.',
    parameters: {
      type: 'OBJECT',
      properties: {
        appointmentId: { type: 'STRING', description: 'The ID of the appointment to cancel' },
        reason: { type: 'STRING', description: 'Reason for cancellation' },
      },
      required: ['appointmentId'],
    },
  },
  {
    name: 'escalateToStaff',
    description: 'Escalate the call to human clinic staff when complex assistance, medical emergency, or front-desk intervention is required.',
    parameters: {
      type: 'OBJECT',
      properties: {
        reason: { type: 'STRING', description: 'Why the call is being escalated' },
        priority: { type: 'STRING', description: 'urgent or normal' },
        contextSummary: { type: 'STRING', description: 'Summary of the conversation so far' },
      },
      required: ['reason', 'contextSummary'],
    },
  },
];

/**
 * Shared tool execution dispatcher for all voice providers.
 */
export async function executeVoiceTool(clinicId: string, name: string, args: Record<string, any>) {
  switch (name) {
    case 'getClinicInfo':
      return await getClinicInfo(clinicId);
    case 'getPatientByPhone':
      return await getPatientByPhone(clinicId, args.phone);
    case 'createPatient':
      return await createPatient(clinicId, args as any);
    case 'getClinicDoctors':
      return await getClinicDoctors(clinicId, args.specialization);
    case 'getClinicServices':
      return await getClinicServices(clinicId);
    case 'getAvailableSlots':
      return await getAvailableSlots(clinicId, args as any);
    case 'createAppointment':
      return await createAppointment(clinicId, args as any);
    case 'rescheduleAppointment':
      return await rescheduleAppointment(clinicId, args as any);
    case 'cancelAppointment':
      return await cancelAppointment(clinicId, args as any);
    case 'escalateToStaff':
      return await escalateToStaff(clinicId, args as any);
    default:
      return { error: `Tool ${name} is not recognized.` };
  }
}
