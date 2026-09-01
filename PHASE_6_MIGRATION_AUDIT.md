# Phase 6 Migration Audit: PostgreSQL Concurrency Hardening

## 1. Exact Database Schema & Types
I have inspected the production Supabase `appointments` and `doctors` tables.
*   `date`: Stored as `text` (e.g., `"2026-08-19"`)
*   `start_time`: Stored as `text` (e.g., `"10:00"`)
*   `end_time`: Stored as `text` (e.g., `"10:30"`)
*   `status`: Stored as `text` (e.g., `"COMPLETED"`, `"CONFIRMED"`)
*   `doctor_id` and `clinic_id`: Stored as `text`.
**Timezone Handling:** The application stores dates and times as local literal strings (floating times). There is no explicit timezone offset in the database. PostgreSQL will compare these as literal strings. This is perfectly safe for exclusion constraints because overlapping intervals within a single clinic/doctor on the same local date will mathematically overlap regardless of the observer's timezone.

## 2. Exclusion Constraint Strategy
To provide atomic PostgreSQL concurrency protection without changing the application's business rules, we will use an `EXCLUDE` constraint with `btree_gist`.
*   **Targeted Statuses:** We only apply the constraint `WHERE (status IN ('CONFIRMED', 'REQUESTED', 'RESCHEDULED'))`. Cancelled or completed appointments will correctly *not* block future scheduling.
*   **Tenant Isolation:** The constraint will explicitly include `clinic_id WITH =`. Even though `doctor_id` is clinic-scoped, this provides defense-in-depth against cross-tenant overlap.
*   **Immutable Casting:** Since casting `text` to `time` is not strictly immutable by PostgreSQL standards (which DDL requires), the migration creates a small immutable wrapper function to safely parse the `start_time` and `end_time` strings into a `timerange`.

## 3. Atomic Booking & Rescheduling 
Once the constraint is applied, the Node.js API will be updated so that:
*   **Booking:** It attempts the Supabase `insert()`. If the constraint is violated, Supabase returns a `23P01` (exclusion_violation) error. The API catches this and returns `SLOT_NO_LONGER_AVAILABLE`.
*   **Rescheduling:** It attempts the Supabase `update()`. If the new target slot overlaps, it violently fails with `23P01`. The API catches it, returning an error to the AI, and the original appointment remains perfectly intact.
*   **Cancellation:** Remains an `update()`. Moving an appointment to `CANCELLED` removes it from the partial constraint index, immediately freeing the slot.

## 4. Idempotency 
I inspected the `voice.routes.ts` webhook payload structure. Currently, Sarvam payloads do not reliably expose a standardized `call_id` or `tool_call_id` in the `req.body` that can be used out-of-the-box as a persistent idempotent key.
*   **Fallback Strategy:** We will continue using the best-effort `(patient_id, doctor_id, date, start_time)` check before mutation. 
*   **Production Gap:** True cryptographic idempotency remains a documented gap until Sarvam's specific webhook `call_id` headers are identified in production logs.

## 5. Existing Data Compatibility Check
I ran a read-only script across the active appointments in Supabase.
*   **Overlaps Found:** 0
*   **Result:** The production database currently contains no overlapping active appointments. Applying the exclusion constraint is 100% safe and will not lock out or break any existing data.

## 6. Proposed Migration SQL (Not Executed)
```sql
-- Enable btree_gist for multi-column EXCLUDE constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Create an immutable wrapper to parse our text times into proper PostgreSQL time types
CREATE OR REPLACE FUNCTION text_to_time_immutable(t text)
RETURNS time AS $$
  SELECT t::time;
$$ LANGUAGE SQL IMMUTABLE;

-- Add the exclusion constraint for overlapping active appointments
ALTER TABLE appointments
ADD CONSTRAINT appointments_no_overlap_excl
EXCLUDE USING gist (
  clinic_id WITH =,
  doctor_id WITH =,
  date WITH =,
  timerange(text_to_time_immutable(start_time), text_to_time_immutable(end_time)) WITH &&
)
WHERE (status IN ('CONFIRMED', 'REQUESTED', 'RESCHEDULED'));
```

**Approval Request:** Please review the proposed migration. Upon approval, I will execute this via Supabase REST RPC (if possible) or instruct how it should be applied, and refactor the backend APIs to respect the transaction boundaries.
