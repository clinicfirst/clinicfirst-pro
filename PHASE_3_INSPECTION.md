# Phase 3 Booking Architecture Inspection & Implementation Plan

## 1. Existing Architecture Inspection

### 1.1 Existing Appointment Creation
- **Core Function:** `db.createAppointment(appointment)` in `server/db.ts` (lines 1137-1178) checks double-booking on exact `start_time`, verifies doctor and service, checks doctor leaves, and saves to the database.
- **Helper Function:** `createAppointment()` in `server/voice/tools/create-appointment.ts` wraps the DB logic, verifies entities, calculates `end_time` using `service.duration_minutes`, and performs the mutation.

### 1.2 Existing Patient Model & Lookup
- **Patient Interface:** Found in `src/types.ts`. Fields: `id, clinic_id, name, phone, preferred_language, created_at`, etc.
- **Lookup Logic:** `db.getPatientByPhone(clinic_id, phone)` normalizes phone numbers (stripping non-digits) to find matches securely scoped to the clinic.
- **Creation Logic:** `db.createPatient(patient)` adds a new patient.

### 1.3 Appointment Constraints & Concurrency
- **Double Booking Protection:** `db.checkDoubleBooking` verifies if a doctor has an overlapping appointment exactly at the requested `date` and `start_time`.
- **Full Validation Logic:** While `checkDoubleBooking` does simple exact matches, `getAvailableSlots()` contains the full, robust schedule calculations (hours, breaks, existing overlaps). We must use this to rigorously re-validate slots before booking.

### 1.4 Authentication and Tenant Helpers
- **Resolution:** The `provider_agent_id` from the URL path will securely resolve the `ai_agents` record, explicitly determining the trusted `clinic_id`. We will continue using `Authorization: Bearer <SECRET>` for authentication.

### 1.5 Existing Audit/Logging
- **Mechanism:** `db.logAudit(log)` creates an entry in `audit_logs`. The existing `createAppointment` helper in `server/voice/tools/create-appointment.ts` already calls this accurately (action: `'APPOINTMENT_BOOKED_BY_AI'`).

---

## 2. Implementation Plan for `book_appointment`

### 2.1 Tool Registration (`server/routes/voice.routes.ts`)
- Add support for the `book_appointment` tool exactly like we did for `check_availability`.

### 2.2 Reused Dependencies
- Use `db.getPatientByPhone()` and `db.createPatient()` for patient lookup/creation.
- Use `getAvailableSlots()` from `server/voice/tools/get-available-slots.ts` to perform mandatory slot re-validation.
- Use `createAppointment()` from `server/voice/tools/create-appointment.ts` for the final atomic-like mutation and auditing.

### 2.3 Idempotency Strategy
- We will generate a unique deduplication key: `${clinic_id}_${patient_phone}_${date}_${start_time}_${doctor_id}`.
- Before proceeding, we will search existing appointments for one matching this patient, doctor, date, and time. If it exists and was recently booked, we will return the successful response without duplicating it.

### 2.4 Detailed Execution Flow
1. **Validation:** Receive `patient_name`, `patient_phone`, `date`, `time`, `service`, `doctor` (optional).
2. **Fuzzy Match Entities:** Match doctor and service names within the tenant scope.
3. **Patient Resolution:** Lookup by phone. Create if not found.
4. **Idempotency Check:** Search for a pre-existing identical appointment.
5. **Re-Validation Check:** Call `getAvailableSlots(clinicId, {doctorId, date})`. Ensure `time` precisely exists in the returned available `slots` array.
6. **Booking:** Call the existing `createAppointment()` helper with the resolved UUIDs.
7. **Response Formatting:** Return structured success/failure JSON for the voice agent to speak natively.

**Approval requested to proceed with the `book_appointment` implementation.**
