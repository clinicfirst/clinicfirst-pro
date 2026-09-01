# Phase 6: Architecture Audit & PostgreSQL Strategy

## 1. Current Architecture Flow
**Path:** `Browser/Sarvam Webhook` → `Node.js API` → `DatabaseEngine (in-memory)` → `Supabase (background sync)`
1. The webhook extracts the `clinic_id` from the `provider_agent_id`.
2. It queries availability via `getAvailableSlots()`, which performs array filtering on the in-memory `this.data.appointments`.
3. If free, it invokes `createAppointment()` or `rescheduleAppointment()`, mutating the in-memory array.
4. Periodically (and during specific sync triggers), `supabaseDiff.ts` iterates over the in-memory arrays, compares them to a cached `lastState`, and performs raw REST `upsert()` calls to Supabase for changed records.

## 2. The Production Concurrency Problem
**Diagnosis:** The current architecture is NOT concurrency-safe and will result in double bookings under load.
*   **Event-Loop Yielding:** The Node.js event loop yields between checking `getAvailableSlots` and `createAppointment`. Two concurrent requests will both read the slot as available before either writes.
*   **Multi-Instance Disconnect:** If deployed to Cloud Run, multiple Node.js instances will possess entirely disjoint `this.data` arrays. They will blindly `upsert` conflicting appointments to Supabase.
*   **Database Ignorance:** Supabase currently acts merely as a dumb backup store. It accepts all `upsert` requests because it lacks database-level constraints for overlapping intervals.

## 3. PostgreSQL-Native Protection Strategy
To fix this without rewriting the JavaScript scheduling engine, PostgreSQL must become the authoritative gatekeeper. 

**Recommendation: Postgres RPC + Exclusion Constraints**
We cannot rely on a simple `UNIQUE(doctor_id, date, start_time)` because appointments have varying durations (e.g., a 10:00-11:00 appointment overlaps with a 10:30-11:00 request).
*   **Strategy A (Exclusion Constraint):** We can enable the `btree_gist` extension in PostgreSQL and add an exclusion constraint to the `appointments` table: 
    `EXCLUDE USING gist (doctor_id WITH =, date WITH =, timerange(start_time::time, end_time::time) WITH &&)`
    *Pros:* Guarantees no overlaps at the lowest level. Any racing `upsert` will violently fail, which we can catch and return as `SLOT_NO_LONGER_AVAILABLE`.
*   **Strategy B (Atomic RPC Transaction):** Since the Supabase REST API doesn't support native begin/commit transactions, we would write a PostgreSQL Stored Procedure (RPC) named `book_appointment_atomic`. This function would take the scheduling parameters, lock the doctor's schedule for that date, execute a final availability check, and insert the appointment—rolling back if conflicts exist.

## 4. Booking & Rescheduling Transactions
*   **Booking:** Will transition from pushing to an array to directly invoking the Supabase RPC or constrained `insert`. If it fails, the API gracefully catches the constraint error and returns `SLOT_NO_LONGER_AVAILABLE`.
*   **Rescheduling:** The atomic move will execute a transactional `UPDATE` using the RPC or constrained table. The `UPDATE` will only succeed if the new `timerange` does not overlap with existing commitments. If it fails, the old appointment remains perfectly intact.

## 5. Idempotency Redesign
*   **Current State:** Best-effort based on `patient_phone + date + time`.
*   **Sarvam Webhook Reality:** Most voice agents (like Retell/Vapi/Sarvam) append a `call_id`, `session_id`, or `tool_call_id` in the webhook HTTP headers or payload. 
*   **Recommendation:** We will modify the API to inspect `req.body.call_id` or `req.headers['x-sarvam-call-id']`. If a stable identifier exists, we will persist it on the `appointments` table (e.g., `created_via_call_id`). This provides true cryptographic idempotency (one mutation per tool call). If unavailable, we explicitly document the fallback behavior.

## 6. Migration Safety
No `DROP TABLE` or destructive commands will be used. We will conditionally add the constraint or RPC via a safe migration script, verifying existing data for overlaps first.
