import { JSX } from 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'sarvam-widget': any;
    }
  }
}

// Central TypeScript interfaces for CLINICFIRST multi-tenant system

export type UserRole = 'PLATFORM_ADMIN' | 'CLINIC_ADMIN' | 'CLINIC_STAFF' | 'DOCTOR';

export type PermissionAction =
  | 'create_clinic'
  | 'view_all_clinics'
  | 'update_clinic'
  | 'manage_platform_users'
  | 'view_platform_dashboard'
  | 'view_own_clinic_dashboard'
  | 'manage_doctors'
  | 'view_doctors'
  | 'manage_staff'
  | 'view_staff'
  | 'manage_services'
  | 'view_services'
  | 'manage_schedules'
  | 'view_schedules'
  | 'manage_patients'
  | 'view_patients'
  | 'manage_appointments'
  | 'view_appointments'
  | 'configure_ai_receptionist'
  | 'view_ai_receptionist'
  | 'view_calls'
  | 'view_daily_collection'
  | 'view_audit_logs';

export type AccessLevel = 'NONE' | 'READ' | 'EDIT';

export interface StaffPermissions {
  appointments: AccessLevel;
  patients: AccessLevel;
  doctors: AccessLevel;
  services: AccessLevel;
  schedules: AccessLevel;
  calls: AccessLevel;
  ai_receptionist: AccessLevel;
  staff: AccessLevel;
}

export interface OperatingHours {
  monday: { open: string; close: string; closed: boolean };
  tuesday: { open: string; close: string; closed: boolean };
  wednesday: { open: string; close: string; closed: boolean };
  thursday: { open: string; close: string; closed: boolean };
  friday: { open: string; close: string; closed: boolean };
  saturday: { open: string; close: string; closed: boolean };
  sunday: { open: string; close: string; closed: boolean };
}

export interface Clinic {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  city: string;
  timezone: string;
  currency?: string; // e.g. "USD", "EUR", "GBP", "INR", "AED", "AUD", "CAD", "SGD"
  currency_symbol?: string; // e.g. "$", "€", "£", "₹", "AED", "A$", "CA$", "S$"
  operating_hours: OperatingHours;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
}

export interface User {
  id: string;
  clinic_id: string | null; // null for PLATFORM_ADMIN
  role: UserRole;
  name: string;
  email: string;
  phone?: string;
  status: 'ACTIVE' | 'INACTIVE';
  must_change_password: boolean;
  created_at: string;
  permissions?: StaffPermissions;
  doctor_id?: string;
}

export interface AuditLog {
  id: string;
  clinic_id: string | null;
  actor_user_id: string;
  actor_name: string;
  action: string;
  target_type: string;
  target_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface Doctor {
  id: string;
  clinic_id: string;
  name: string;
  specialization: string;
  qualification: string;
  phone: string;
  email: string;
  consultation_duration_minutes: number;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
}

export interface DoctorSchedule {
  id: string;
  clinic_id: string;
  doctor_id: string;
  day_of_week: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  start_time: string; // e.g. "09:00"
  end_time: string;   // e.g. "17:00"
  break_start?: string; // e.g. "13:00"
  break_end?: string;   // e.g. "14:00"
  buffer_minutes: number; // e.g. 5
}

export interface DoctorLeave {
  id: string;
  clinic_id: string;
  doctor_id: string;
  start_date: string; // "YYYY-MM-DD"
  end_date: string;   // "YYYY-MM-DD"
  reason: string;
}

export interface Service {
  id: string;
  clinic_id: string;
  name: string;
  duration_minutes: number;
  fee: number;
  status: 'ACTIVE' | 'INACTIVE';
  assigned_doctor_ids?: string[];
}

export interface DoctorService {
  id: string;
  clinic_id: string;
  doctor_id: string;
  service_id: string;
}

export interface Patient {
  id: string;
  clinic_id: string;
  name: string;
  phone: string;
  email?: string;
  dob?: string;
  gender?: 'Male' | 'Female' | 'Other' | 'Prefer not to say';
  preferred_language: string;
  notes?: string;
  created_at: string;
}

export type AppointmentStatus =
  | 'REQUESTED'
  | 'CONFIRMED'
  | 'RESCHEDULED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'NO_SHOW';

export interface Appointment {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  service_id: string;
  date: string; // "YYYY-MM-DD"
  start_time: string; // "HH:MM"
  end_time: string;   // "HH:MM"
  status: AppointmentStatus;
  created_via: 'staff' | 'ai_receptionist';
  notes?: string;
  created_at: string;
  updated_at: string;
  // Hydrated helper properties:
  patient?: Patient;
  doctor?: Doctor;
  service?: Service;
}

export interface AiAgent {
  id: string;
  clinic_id: string;
  name: string;
  greeting: string;
  voice_provider: 'gemini_live' | 'sarvam' | string;
  voice_config: {
    voice_name?: string;
    temperature?: number;
    speaking_rate?: number;
  };
  languages: string[];
  status: 'ACTIVE' | 'INACTIVE' | string;
  escalation_contact: {
    phone?: string;
    email?: string;
    name?: string;
  };
  instructions_note?: string;
  provider_agent_id?: string;
  enabled?: boolean;
  primary_language?: string;
  created_at?: string;
  updated_at?: string;
}

export type KnowledgeCategory =
  | 'APPOINTMENT_POLICIES'
  | 'RECEPTION_GUIDANCE'
  | 'ESCALATION_PROTOCOLS'
  | 'GENERAL_FAQS'
  | 'COMMUNICATION_RULES';

export interface PlatformKnowledgeItem {
  id: string;
  title: string;
  category: KnowledgeCategory;
  content: string;
  
  // File attachments
  file_name?: string;
  file_type?: string;
  file_data?: string;
  file_size?: number;

  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AiUsageEvent {
  id: string;
  clinic_id: string;
  agent_id: string;
  session_id: string;
  call_id?: string;
  provider: 'gemini' | 'sarvam' | string;
  model: string;
  operation: 'LLM' | 'STT' | 'TTS';
  request_id?: string;
  timestamp: string;
  status: 'success' | 'failed';
  latency_ms?: number;
  
  // LLM metrics
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  
  // STT metrics
  audio_duration_seconds?: number;
  
  // TTS metrics
  characters_count?: number;
  
  language?: string;
  estimated_cost_usd?: number;
}

export interface PlatformAiConfig {
  id: string;
  provider: 'gemini' | 'sarvam';
  model: string;
  voice_provider: 'gemini_live' | 'sarvam';
  voice_name: string;
  temperature: number;
  status: 'ACTIVE' | 'INACTIVE';
  api_key_configured: boolean;
  api_key_masked: string;
  greeting_template: string;
  role_definition: string;
  things_to_do: string[];
  things_to_avoid: string[];
  escalation_rules: string[];
  safety_guidelines: string[];
  updated_at: string;
}

export interface Call {
  id: string;
  clinic_id: string;
  patient_id?: string;
  agent_id?: string;
  doctor_id?: string;
  service_id?: string;
  appointment_id?: string;
  caller_phone?: string;
  patient_phone?: string;
  direction: 'inbound' | 'outbound';
  start_time: string;
  end_time?: string;
  duration_seconds: number;
  status: 'completed' | 'escalated' | 'dropped' | 'in_progress';
  summary?: string;
  outcome: string;
  transcript: Array<{
    speaker: 'ai' | 'patient' | 'system';
    text: string;
    timestamp: string;
  }>;
  language_detected: string;
  provider_session_id?: string;
  provider_agent_id?: string;
  escalation_id?: string;
  active_ai_config_version?: string;
  created_at: string;
  // Hydrated:
  patient?: Patient;
  doctor?: Doctor;
  service?: Service;
}

export interface Escalation {
  id: string;
  clinic_id: string;
  call_id: string;
  reason: string;
  priority: 'urgent' | 'normal';
  context_summary: string;
  status: 'pending' | 'resolved';
  resolved_by?: string;
  created_at: string;
  resolved_at?: string;
}

export interface TimeSlot {
  time: string; // "09:00"
  endTime: string; // "09:30"
  available: boolean;
  doctorId: string;
  doctorName?: string;
  reason?: string;
}

export interface DailyTrendPoint {
  date: string;
  day: string;
  displayDate: string;
  totalAppointments: number;
  confirmedAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  aiBookedAppointments: number;
  staffBookedAppointments: number;
  totalCalls: number;
  aiCallsResolved: number;
  aiCallsBooked: number;
  escalatedCalls: number;
  avgCallDurationSeconds: number;
}

export interface CallOutcomeDistributionItem {
  outcome: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export interface CallBreakdownSummary {
  total: number;
  today: number;
  aiAnsweredCount: number;
  aiAnsweredPercent: number;
  staffTransferredCount: number;
  staffTransferredPercent: number;
  missedCount: number;
  missedPercent: number;
}

export interface TopCallReasonItem {
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export interface ClinicDashboardMetrics {
  todayAppointmentsTotal: number;
  totalAppointmentsCount: number;
  todayConfirmed: number;
  todayCompleted: number;
  todayRescheduled: number;
  todayCancelled: number;
  todayAiCalls: number;
  totalAiCalls: number;
  todayAiBookedCount: number;
  totalPatientsCount: number;
  newPatientsToday: number;
  newPatientsThisWeek: number;
  activeDoctorsCount: number;
  pendingEscalationsCount: number;
  patientSatisfaction: string;
  aiResolutionRate: number;
  aiActiveHours: string;
  callBreakdown: CallBreakdownSummary;
  topCallReasons: TopCallReasonItem[];
  dailyCollection?: {
    total: number;
    confirmedCompletedTotal: number;
    currency_symbol: string;
    currency: string;
    billedAppointmentsCount: number;
  };
}

export interface WeeklyAnalytics {
  trends: DailyTrendPoint[];
  summary: {
    totalAppointments: number;
    appointmentGrowthPercent: number;
    totalCalls: number;
    callGrowthPercent: number;
    aiBookingConversionRate: number;
    aiAutonomousResolutionRate: number;
    avgCallHandlingSeconds: number;
    peakCallHour: string;
    busiestDay: string;
  };
  callOutcomeDistribution: CallOutcomeDistributionItem[];
  appointmentByDoctor: {
    doctorName: string;
    specialization: string;
    appointments: number;
  }[];
}

export interface AuthSession {
  token: string;
  user: User;
  clinic?: Clinic;
}

export interface DailyCollectionItem {
  appointment_id: string;
  patient_id: string;
  patient_name: string;
  patient_phone: string;
  patient_email?: string;
  doctor_id: string;
  doctor_name: string;
  doctor_specialization: string;
  service_id: string;
  service_name: string;
  service_duration: number;
  fee: number;
  date: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  created_via: 'staff' | 'ai_receptionist';
  created_at: string;
}

export interface DailyCollectionSummary {
  date: string;
  currency_symbol: string;
  currency: string;
  total_collection: number;
  confirmed_completed_total: number;
  total_appointments_count: number;
  confirmed_count: number;
  completed_count: number;
  rescheduled_count: number;
  cancelled_count: number;
  by_doctor: {
    doctor_id: string;
    doctor_name: string;
    specialization: string;
    count: number;
    total_fees: number;
  }[];
  by_service: {
    service_id: string;
    service_name: string;
    count: number;
    fee: number;
    total_fees: number;
  }[];
  items: DailyCollectionItem[];
}

export interface ClinicAiRule {
  id: string;
  clinic_id: string;
  rule_name: string;
  rule_type: string;
  rule_content: string;
  priority: number;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export type ClinicKnowledgeCategory =
  | 'CLINIC_POLICY'
  | 'WORKFLOW'
  | 'ESCALATION'
  | 'COMMUNICATION'
  | 'ARRIVAL'
  | 'PAYMENT'
  | 'CANCELLATION'
  | 'REGISTRATION'
  | 'OTHER_APPROVED_CLINIC_RULE';

export interface ClinicKnowledgeItem {
  id: string;
  clinic_id: string;
  title: string;
  category: ClinicKnowledgeCategory | string;
  content: string;
  status: 'DRAFT' | 'VALIDATED' | 'PUBLISHED' | string;
  version?: number | string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  published_at?: string;
  published_by?: string;
}

export interface ClinicAiTool {
  id: string;
  clinic_id: string;
  tool_name: string;
  tool_type: string;
  enabled: boolean;
  configuration?: any;
  created_at?: string;
  updated_at?: string;
}



export interface ClinicKnowledgeRelease {
  id: string;
  clinic_id: string;
  version: number;
  document_hash: string;
  status: 'COMPILED' | 'PUBLISHED' | 'PUBLISH_FAILED';
  compiled_content: string;
  compiled_at: string;
  published_at?: string;
  published_by?: string;
}


declare global {
  namespace JSX {
    interface IntrinsicElements {
      'sarvam-widget': any;
    }
  }
}
