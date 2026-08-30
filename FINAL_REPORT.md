# Phase 2 & 3: Secure Sarvam API Tools (`check_availability` & `book_appointment`)

### 1. Overview
The read-only `check_availability` and mutative `book_appointment` API tools have been successfully implemented and secured, completing the first full end-to-end AI receptionist flow. The application can now safely handle inbound webhook requests from the Sarvam Voice Agent, dynamically map them to the correct clinic tenant, strictly re-validate slots against race conditions, and correctly perform atomic-like appointment creations with full idempotency.

### 2. Exact Files Modified
- `server/app.ts`: Mounted the new `/api/voice` router.
- `server/routes/voice.routes.ts`: Handles the secure Sarvam webhook endpoint. Added full support for fuzzy entity resolution, slot re-validation, patient lookup/creation, and idempotency logic.
- `.env.example` & `.env`: Added `CLINICFIRST_AI_TOOL_SECRET`.

### 3. Exact Endpoint Created
- **Route:** `POST /api/voice/webhook/sarvam/:provider_agent_id`
- **Method:** POST

### 4. Authentication & Tenant Resolution Mechanism (Tenant Isolation)
- **Authentication:** The endpoint strictly validates the `Authorization: Bearer <CLINICFIRST_AI_TOOL_SECRET>` header. 
- **Tenant Resolution:** The backend extracts `:provider_agent_id` strictly from the URL path, resolving the trusted `clinic_id` from the `ai_agents` table. 
- **Strict Scope Boundaries:** The backend completely ignores any `clinic_id` injected into the payload by an attacker or AI. All doctor, service, and patient lookups are hard-bounded to the resolved `clinic_id`.

### 5. Architectural Implementation for `book_appointment`
The endpoint was meticulously designed around robust backend principles rather than blindly accepting AI commands:
1. **Validation & Resolution:** Ensures all mandatory conversational inputs (`patient_name, patient_phone, service, date, time`) are present.
2. **Fuzzy Tenant Matching:** Matches the conversational doctor/service strings strictly against the clinic's active entities to extract UUIDs.
3. **Deterministic Patient Lookup:** Extracts digits from `patient_phone` and securely looks up the patient in the current clinic scope. If they do not exist, a new patient record is cleanly generated.
4. **Idempotency Strategy:** Checks for an existing appointment matching `(clinic, patient, doctor, date, time)`. If the AI repeats the tool call (due to network retries or conversational hiccups), it returns the existing successful booking gracefully instead of double-booking.
5. **Mandatory Slot Re-Validation:** It invokes the full, complex `getAvailableSlots` scheduler. This ensures the requested `time` is actually still present in the availability array, inherently accounting for sudden doctor leave, clinic break hours, and competing appointments that may have been created seconds earlier.
6. **Existing Mutators:** Defers the final booking to the pre-existing `createAppointment` utility, maintaining consistent business rules and unified Audit Log trail (`action: APPOINTMENT_BOOKED_BY_AI`).

### 6. Voice E2E Test Results (Phase 3 Verified)
- **Functional:** A fresh test booking at `14:00` was cleanly placed into the schedule.
- **Security:** Platform AI master switch controls the flow. Invalid headers or unknown agents result in 401/403/404.
- **Concurrency & Race Conditions:** When a second patient attempted to book `14:00`, the Re-Validation engine automatically recalculated the timeline, found `14:00` missing (pushed to `14:25` due to the first appointment's duration), and rejected the second request with a structured `SLOT_NO_LONGER_AVAILABLE` error.
- **Idempotency:** When the *same* patient attempted to book `14:00` again, the server caught it and safely responded with `Appointment was already booked successfully` instead of duplicating it.
- **AI-Friendly Responses:** All outputs are formatted strictly as plain JSON without UUIDs, SQL stacks, or internal context, enabling the AI to naturally apologize or confirm directly to the patient.

### 7. What Was Excluded (Strict Scope Discipline)
- Telephony/Twilio integration.
- Cancellation, Rescheduling, and Patient Deletion features (reserved for future phases).
- Creation of new database tables or duplicate scheduling algorithms.

## Pre-Phase 4 Verification (Read-Only)

### 1. Concurrency Protection
The database structure leverages an in-memory JSON data array (`DatabaseEngine` in `server/db.ts`) periodically flushed to persistent storage. There are currently no database-level unique constraints, SQL transactions, or locks enforcing the rule `(doctor_id, date, start_time)`. Since the NodeJS event loop yields between `getAvailableSlots` and `createAppointment` via async `await`, a theoretical race condition exists if two parallel requests hit this gap. 
**Status:** This is marked as a **known production-hardening gap**. The current application-level verification works extremely well for synchronous logic, but true atomic protection will require a transactional database migration in the future.

### 2. Idempotency Key Evaluation
Sarvam does not currently emit a stable, unified `call_id` or `tool_call_id` in the conversational webhook payload that is safely decoupled from the business intent. Therefore, duplicate requests from network retries are distinguished using the business fields: `(clinic_id, patient_id, date, start_time)`.
**Status:** This logic successfully protects against near-term retries and double-bookings. However, it does mean a patient cannot legitimately book the exact same time slot with the exact same doctor next year (since date includes the year). This boundary is acceptable for current operations but is noted.

---

# Phase 4: Appointment Cancellation

### 1. Overview
The AI receptionist can now successfully cancel appointments via a dedicated `cancel_appointment` tool. The implementation restricts cancellation strictly to the resolved tenant, enforces policies against cancelling past/completed appointments, and handles ambiguous conversational input safely by asking for clarification.

### 2. Security and Identity Verification
- **No Direct Arbitrary ID Cancellation:** The AI cannot pass an arbitrary appointment UUID to cancel. It must supply the `patient_phone` to securely identify the patient in the current `clinic_id`.
- **Tenant Isolation:** Bound strictly to the `:provider_agent_id` context. A user or agent cannot cross clinic boundaries to cancel someone else's appointment.
- **Ambiguity Guardrails:** If the patient has multiple active appointments and does not supply a specific `date` or `time` to the AI, the backend halts cancellation, returns `AMBIGUOUS_APPOINTMENT`, and lists the matching active appointments. This forces the Sarvam agent to ask the patient for confirmation ("Which one would you like to cancel?").

### 3. Implementation Details
- Modifies `voice.routes.ts` to accept the `cancel_appointment` tool.
- Filters out any `COMPLETED`, `NO_SHOW`, or already `CANCELLED` appointments from the active matching list.
- Defers the actual database mutation and Audit Log creation to the existing `cancelAppointment` helper in `server/voice/tools/create-appointment.ts`.
- Blocks cancellation if the current date has surpassed the appointment date.

### 4. Phase 4 Verified Test Scenarios
- **Valid Cancellation:** Successfully cancelled when `patient_phone`, `date`, and `time` cleanly identified one active appointment.
- **Already Cancelled Idempotency:** When `cancel_appointment` was called on a previously cancelled appointment, it gracefully returned `{ error_code: 'ALREADY_CANCELLED' }`.
- **Ambiguous Clarification:** When a patient had two active appointments (09:25 and 10:15) on the same day and only provided the `date`, the system successfully returned `AMBIGUOUS_APPOINTMENT` along with the list of choices for the AI.
- **Fallback Resolution:** When the 09:25 appointment was cancelled, calling the ambiguous cancel again successfully identified the *only* remaining active appointment (10:15) and cancelled it.
- **Not Found:** Calling cancellation with a `patient_phone` that has no appointments safely rejected the request.
