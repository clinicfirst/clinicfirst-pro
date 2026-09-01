# Phase 7 Appointment Service Design

## Current Mutation Architecture
The application currently suffers from a bifurcated, split-brain mutation path:
1. **AI Workflows (Step 6C):** Mutate PostgreSQL first (authoritative), then synchronize to the in-memory `DatabaseEngine`.
2. **Human UI Workflows:** Mutate the in-memory `DatabaseEngine` first (authoritative locally), then rely on a background script (`syncToSupabase`) to replicate to PostgreSQL.

**The Risk:** If a human books a slot via the UI that causes a conflict in PostgreSQL, the background sync catches a `23P01` exclusion constraint violation and silently logs it to the server console. The in-memory array is *never rolled back*, leaving the UI displaying a confirmed appointment that the database rejected.

## Discovered Appointment Mutation Entry Points
1. **Human UI (Create):** `server/routes/clinic.routes.ts` -> `POST /appointments`
2. **Human UI (Reschedule):** `server/routes/clinic.routes.ts` -> `POST /appointments/:id/reschedule`
3. **Human UI (Status/Cancel):** `server/routes/clinic.routes.ts` -> `PUT /appointments/:id/status`
4. **AI Receptionist (Create):** `server/voice/tools/create-appointment.ts` -> `createAppointment()`
5. **AI Receptionist (Reschedule):** `server/voice/tools/create-appointment.ts` -> `rescheduleAppointment()`
6. **AI Receptionist (Cancel):** `server/voice/tools/create-appointment.ts` -> `cancelAppointment()`

## Proposed AppointmentService API
A unified service that acts as the sole gatekeeper for appointment mutations. It explicitly tracks the `source` of the mutation to handle differentiated audit logging or permissions without duplicating the core booking logic.

```typescript
export type AppointmentMutationSource = 
  | { type: 'AI'; agentId?: string; name: string }
  | { type: 'HUMAN_RECEPTIONIST' | 'CLINIC_ADMIN'; userId: string; name: string };

export class AppointmentService {
  // Books a new appointment
  static async book(clinicId: string, params: BookParams, source: AppointmentMutationSource): Promise<Result>;
  
  // Reschedules an existing appointment
  static async reschedule(clinicId: string, appointmentId: string, params: RescheduleParams, source: AppointmentMutationSource): Promise<Result>;
  
  // Updates status (including cancellation)
  static async updateStatus(clinicId: string, appointmentId: string, params: StatusParams, source: AppointmentMutationSource): Promise<Result>;
}
```

### Existing Functions Analysis
- **To be reused:** `db.getDoctorById`, `db.getServiceById`, `db.getPatientById` (for read-only validations), `db.logAudit` (for post-commit side-effects).
- **To be refactored:** `createAppointment`, `rescheduleAppointment`, `cancelAppointment` in the AI tools. `POST /appointments`, `PUT /appointments/:id/status`, `POST /appointments/:id/reschedule` in `clinic.routes.ts`.
- **To be removed/deprecated:** `db.createAppointment`, `db.updateAppointment` (so the legacy path is definitively closed).

## Mutation Flows

**Human → Service Flow**
`REST Route` → `Auth Middleware` → `AppointmentService.book(..., { type: 'HUMAN_RECEPTIONIST', ... })` → `PostgreSQL Mutation` → (If Success) → `Sync In-Memory` & `Log Audit` → `Return 201 Response`

**AI → Service Flow**
`Sarvam Webhook` → `AI Tool Call Handler` → `AppointmentService.book(..., { type: 'AI', ... })` → `PostgreSQL Mutation` → (If Success) → `Sync In-Memory` & `Log Audit` → `Return Tool Result Payload`

## PostgreSQL Transaction Boundary
The definitive transaction boundary is the network call to Supabase.
1. Pre-flight checks (Resolving entities, validating Doctor leaves).
2. **PostgreSQL Mutation (INSERT/UPDATE).** <- *AUTHORITATIVE BOUNDARY*
3. Evaluate response.

## Side-Effect Classification
- **Transaction-critical:** `PostgreSQL Mutation`.
- **Post-commit side effects:** 
    - `In-Memory Synchronization` (Updating `db.data.appointments` array so the UI can read it).
    - `Notes persistence` (Storing notes locally, since they are missing from Postgres).
    - `Audit Logging` (`db.logAudit`).

## In-Memory Synchronization Strategy
**Strategy:** Post-commit Apply.
We will NEVER mutate `db.data.appointments` prior to a confirmed PostgreSQL success.
If `supabase.from('appointments').insert()` returns data/success, we will then `db.data.appointments.push({...pgPayload, notes})`. 
If PostgreSQL fails, the in-memory state is simply untouched, completely preventing stale/ghost appointments. No complex rollback logic is required.

## The `notes` Discrepancy
**Risk/Debt:** The production `appointments` table in PostgreSQL does *not* contain a `notes` column. 
**Strategy:** Do NOT alter the database schema during this phase. `AppointmentService` will explicitly separate `notes` from the PostgreSQL payload (stripping it) and reattach it during the post-commit in-memory synchronization. This maintains exact functional parity with the current system while safely preserving the data in the local JSON storage.

## Error Mapping
- PostgreSQL `23P01` (Exclusion Constraint) → `SLOT_NO_LONGER_AVAILABLE`
- PostgreSQL Foreign Key violation (e.g., patient doesn't exist) → `VALIDATION_FAILED`
- Any other PostgreSQL Error → `DATABASE_ERROR`
- Local pre-flight check (e.g., Doctor on leave) → `VALIDATION_FAILED`

## Concurrency & Idempotency Strategy
- **Concurrency:** 100% handled by the PostgreSQL `btree_gist` exclusion constraint `appointments_no_overlap_excl`. No JS-level mutexes will be used.
- **Idempotency:** Remains **PENDING**. Idempotency against duplicate AI network retries requires stabilizing the Sarvam Tool Call ID payload, which is separate from preventing structural interval overlaps.

## Backward-Compatibility Considerations
- Frontend REST clients will see zero change. Payload contracts (`req.body` and HTTP response signatures) remain exactly the same.
- AI Agent prompt context remains exactly the same. The AI is oblivious to the service rewrite.

## Code Modification Map
**Exact files that WOULD change:**
1. `server/services/appointment.service.ts` (NEW)
2. `server/routes/clinic.routes.ts` (Refactor to consume service)
3. `server/voice/tools/create-appointment.ts` (Refactor to consume service)
4. `server/db.ts` (Remove unsafe `createAppointment` / `updateAppointment`)

**Exact files that MUST remain untouched:**
1. Everything in `src/` (All frontend React code)
2. `server/auth.ts`
3. `server/supabaseDiff.ts`
4. `supabase/schema.sql`
5. `.env` and configuration files.

## Test Plan
1. **Human Booking (UI Simulation):** Call REST API to book an appointment. Ensure 201 success, Postgres insertion, and in-memory appearance.
2. **AI Booking (Tool Simulation):** Call AI tool to book an appointment. Ensure success, Postgres insertion, and in-memory appearance.
3. **Simultaneous Concurrency (The Ultimate Test):** Execute `Promise.all` combining a REST POST request and an AI Tool request targeting the exact same time slot at the exact same millisecond. Ensure one resolves successfully, and the other safely receives `SLOT_NO_LONGER_AVAILABLE` without breaking or ghosting the local UI state.
4. **Reschedule & Cancel Tests:** Verify both sources (AI/Human) can modify an existing appointment through the service safely.
5. **Cross-Tenant Attack:** Verify that providing a mismatched `clinicId` fails pre-flight validation.

## Newly Discovered Risks
None outside of the known `notes` schema discrepancy. The proposed convergence effectively eliminates the highest-risk split-brain defect in the current system.

---
*Ready for approval to proceed to implementation.*

## Implementation Status
**IMPLEMENTED** as designed during Phase 7. The unified `AppointmentService` is now active.
