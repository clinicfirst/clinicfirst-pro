# AI Tool Contract / Governance Document

This document defines the rules, schema, and boundaries for every AI tool exposed to the AI Receptionist. It serves as the foundation for the future AI Governance module.

## 1. `check_availability`
*   **Purpose**: Read-only query to find open consultation slots for a specific date, optionally filtered by doctor or service.
*   **Input Schema**: `{ date: string, doctor?: string, service?: string, preferred_time?: string }`
*   **Output Schema**: `{ available: boolean, date: string, slots: { start: string, end: string, doctor: string }[], reason?: string }`
*   **Read/Write Classification**: READ
*   **Tenant Boundary**: Derived entirely from `:provider_agent_id` -> `ai_agents` -> `clinic_id`.
*   **Authentication**: Bearer token against `CLINICFIRST_AI_TOOL_SECRET`.
*   **Patient Verification**: None required (public availability).
*   **Confirmation Requirement**: None.
*   **Authorization Rules**: Platform AI and Clinic AI must be `ACTIVE`.
*   **Audit Event**: None.
*   **Idempotency Requirement**: N/A (Read-Only).
*   **Failure Behavior**: Returns safe JSON error strings guiding the AI (e.g., `error: "Date is required"`).

## 2. `book_appointment`
*   **Purpose**: Mutative tool to lock in a new appointment for a patient.
*   **Input Schema**: `{ patient_name: string, patient_phone: string, service: string, date: string, time: string, doctor?: string }`
*   **Output Schema**: `{ success: boolean, appointment_id?: string, appointment_date?: string, appointment_time?: string, doctor?: string, service?: string, error_code?: string, message?: string }`
*   **Read/Write Classification**: WRITE
*   **Tenant Boundary**: `:provider_agent_id` -> `clinic_id`.
*   **Authentication**: Bearer token against `CLINICFIRST_AI_TOOL_SECRET`.
*   **Patient Verification**: Name and Phone implicitly act as the identifier. Auto-creates patient if missing.
*   **Confirmation Requirement**: The AI must verbally confirm details before calling.
*   **Authorization Rules**: Same as READ, plus checks for double-booking via `getAvailableSlots`.
*   **Audit Event**: `APPOINTMENT_BOOKED_BY_AI`
*   **Idempotency Requirement**: Re-invoking the tool with the same `(patient, doctor, date, time)` must return the existing successful appointment without creating a duplicate.
*   **Failure Behavior**: Gracefully rejects double-booking attempts with `SLOT_NO_LONGER_AVAILABLE` instead of throwing an internal exception.

## 3. `cancel_appointment`
*   **Purpose**: Mutative tool to cancel an existing appointment.
*   **Input Schema**: `{ patient_phone: string, date?: string, time?: string }`
*   **Output Schema**: `{ success: boolean, status?: string, error_code?: string, message?: string, requires_clarification?: boolean, matching_appointments?: [] }`
*   **Read/Write Classification**: WRITE
*   **Tenant Boundary**: `:provider_agent_id` -> `clinic_id`.
*   **Authentication**: Bearer token against `CLINICFIRST_AI_TOOL_SECRET`.
*   **Patient Verification**: Must match a valid patient record via `patient_phone`.
*   **Confirmation Requirement**: Mandatory explicit confirmation before cancellation.
*   **Authorization Rules**: Cannot cancel past appointments, `COMPLETED`, or `NO_SHOW` statuses.
*   **Audit Event**: `APPOINTMENT_CANCELLED_BY_AI`
*   **Idempotency Requirement**: Re-invoking on an already cancelled appointment returns `ALREADY_CANCELLED`.
*   **Failure Behavior**: Detects ambiguous matches and returns safe list for AI clarification (no internal UUIDs).

## 4. `reschedule_appointment` (Phase 5)
*   **Purpose**: Mutative tool to move an existing appointment to a new date/time.
*   **Input Schema**: `{ patient_phone: string, old_date?: string, old_time?: string, new_date: string, new_time: string, new_doctor?: string, new_service?: string }`
*   **Output Schema**: `{ success: boolean, appointment_id?: string, new_date?: string, new_start_time?: string, error_code?: string, message?: string, requires_clarification?: boolean, matching_appointments?: [] }`
*   **Read/Write Classification**: WRITE
*   **Tenant Boundary**: `:provider_agent_id` -> `clinic_id`.
*   **Authentication**: Bearer token against `CLINICFIRST_AI_TOOL_SECRET`.
*   **Patient Verification**: Must match a valid patient record via `patient_phone`.
*   **Confirmation Requirement**: Mandatory explicit confirmation of new date/time before invocation.
*   **Authorization Rules**: Same ambiguity rules as cancellation. New slot must be rigorously validated against operating hours, doctor leaves, and double bookings.
*   **Audit Event**: `APPOINTMENT_RESCHEDULED_BY_AI`
*   **Idempotency Requirement**: Re-invoking an already rescheduled appointment to the exact same target returns success without duplicating the mutation.
*   **Failure Behavior**: Fails safely leaving the original appointment 100% intact if the new slot is blocked.
