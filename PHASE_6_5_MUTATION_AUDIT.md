# Phase 6.5: Architecture & Regression Audit

## 1. Appointment Mutation Map

The application currently has a bifurcated mutation architecture where AI tools use direct PostgreSQL mutations, while the human-facing REST API uses the legacy in-memory engine.

| Mutation | Current entry point | Current authority | DB direct? | In-memory first? | AI? | Human UI? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Create** | `voice/tools/create-appointment.ts` | PostgreSQL | Yes | No (Syncs after) | Yes | No |
| **Create** | `routes/clinic.routes.ts` | DatabaseEngine | No | Yes (Syncs later) | No | Yes |
| **Reschedule** | `voice/tools/create-appointment.ts` | PostgreSQL | Yes | No (Syncs after) | Yes | No |
| **Reschedule** | `routes/clinic.routes.ts` | DatabaseEngine | No | Yes (Syncs later) | No | Yes |
| **Cancel** | `voice/tools/create-appointment.ts` | PostgreSQL | Yes | No (Syncs after) | Yes | No |
| **Status/Confirm** | `routes/clinic.routes.ts` | DatabaseEngine | No | Yes (Syncs later) | No | Yes |

---

## 2. Existing Business Logic Discovery
Blindly replacing `db.createAppointment()` with direct Supabase calls would bypass critical side effects. The current application relies on the following side effects executed immediately *after* a successful mutation:
1.  **Audit Logging:** `db.logAudit()` is called in the route handlers and AI tools immediately after the appointment state is modified.
2.  **In-Memory State (`DatabaseEngine`):** UI clients depend on the in-memory array (`db.data.appointments`) being instantly up-to-date for fast READ operations. 
3.  **Disk Persistence:** `db.flush()` writes the JSON array to a local `.json` file.
4.  **Supabase Background Sync:** `flush()` calls `syncToSupabase()`, which loops over the entire state and executes background `upsert` queries.

---

## 3. Synchronization Assumptions & Risks
The current architecture poses a significant risk for the Human UI due to the synchronization flow:
*   **Human Path:** UI -> API Route -> Updates Memory Array -> Triggers `syncToSupabase()`.
*   **The Risk:** If two receptionists book the same slot simultaneously via the UI, the in-memory array (`DatabaseEngine.checkDoubleBooking`) *might* allow both if the event loop processes them concurrently, or they might succeed locally. When `syncToSupabase` runs in the background, PostgreSQL will throw the `23P01` exclusion constraint error. The background sync script catches this and logs it to the console, **but the in-memory array is never rolled back**. The UI will display a confirmed appointment that PostgreSQL rejected.

---

## 4. The `notes` Discrepancy Findings
**Finding:** The `notes` column is missing from the Supabase `appointments` table. 
*   **How it works currently:** In `server/supabaseDiff.ts` on line 124, there is explicit logic: `if (table === 'appointments') { delete sanitized.notes; }`. 
*   **Risk:** The application relies entirely on the local JSON file to persist appointment notes. Since the sync engine explicitly strips the notes before upserting to Postgres, no Postgres errors occur on the legacy path. 
*   **Status:** This creates no immediate functionality risk for the UI, but it means PostgreSQL is not the true source of truth for appointment notes. We safely stripped `notes` from the AI Postgres payloads in Step 6C to respect this quirk.

---

## 5. PostgreSQL Constraint Verification
Read-only inspection confirms the constraint was deployed exactly as reviewed:
*   **Constraint Name:** `appointments_no_overlap_excl`
*   **Columns:** `clinic_id WITH =`, `doctor_id WITH =`, `date WITH =`, `timerange(text_to_time_immutable(start_time), text_to_time_immutable(end_time)) WITH &&`
*   **Predicate:** `WHERE (status IN ('CONFIRMED', 'REQUESTED', 'RESCHEDULED'))`
*   **Functions:** `text_to_time_immutable` created and correctly marked `IMMUTABLE`.
*   **Indexes:** Relies on the `btree_gist` extension.

---

## 6. Concurrency Boundary
*   **PostgreSQL provides database-level protection against overlapping appointment mutations under concurrent requests.**
*   This protects the interval integrity. It does *not* protect against distributed transaction failures (e.g., if Postgres succeeds but the Node server crashes before writing the Audit Log).

---

## 7. Idempotency Status
*   **Concurrency protection**   -> RESOLVED
*   **Appointment overlap**      -> RESOLVED
*   **AI mutation authority**    -> RESOLVED
*   **True tool idempotency**    -> PENDING (Awaiting Sarvam stable tool call ID payload integration)

---

## 8. Target Architecture Recommendation
**Recommendation: B. Converge**

We should establish an `AppointmentService` acting as the single authoritative mutation layer. Both the Human Receptionist UI (REST routes) and the AI Voice tools should call this service.

**Why Convergence?**
Currently, the AI tools check Postgres first, guaranteeing integrity. The Human UI checks memory first, which creates a dangerous split-brain scenario. If an AI books a slot, and a human simultaneously books the same slot, Postgres will reject the human's background sync, but the human's UI will incorrectly show success.

**Proposed Convergence Flow:**
`Human UI / AI` -> `AppointmentService.book()` -> `PostgreSQL INSERT` -> `If Success: Update In-Memory DB & write Audit Log` -> `Return Success to Caller`.

**Files to Modify for Convergence:**
1.  `server/services/appointment.service.ts` (New file to house unified logic)
2.  `server/routes/clinic.routes.ts` (Refactor to use new service instead of `db.createAppointment`)
3.  `server/voice/tools/create-appointment.ts` (Refactor to use new service)
4.  `server/db.ts` (Remove or deprecate `createAppointment`, `updateAppointment`)
