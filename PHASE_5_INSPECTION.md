# Phase 5 Read-Only Architecture Inspection: Rescheduling

### 1. Atomic Move Viability
**Findings:** The `rescheduleAppointment` helper located in `server/voice/tools/create-appointment.ts` currently delegates to `db.updateAppointment`, mutating the properties of the *existing* appointment record (updating `date`, `start_time`, `end_time`, `status`). 
**Conclusion:** It *is* possible to perform an atomic "move" operation because we don't have to delete the original and recreate it. If the new slot validation fails upstream, the original appointment remains entirely untouched. If validation passes, a single synchronous update modifies the existing ID.

### 2. Validation Flow 
**Findings:** `rescheduleAppointment` strictly acts as a mutator. It does NOT automatically re-run `getAvailableSlots` to check for double bookings or leaves. 
**Conclusion:** The webhooks endpoint (`server/routes/voice.routes.ts`) MUST first invoke `getAvailableSlots` to strictly validate `new_date` and `new_time`, ensuring it doesn't conflict with any other existing appointments or doctor leaves. 

### 3. Slot Availability Self-Conflict
**Findings:** `getAvailableSlots` maps over all active appointments and subtracts them from the schedule matrix. If we are moving Appointment A from 10:00 to 10:30 (and it takes 30 mins), `getAvailableSlots` will currently see Appointment A at 10:00. This won't overlap with 10:30. BUT, if we wanted to shift it slightly (e.g. 10:15) where the times overlap, `getAvailableSlots` would currently see the old Appointment A as a blocker for its own new slot!
**Conclusion:** `getAvailableSlots` needs to accept an `excludeAppointmentId` parameter so the slot matrix properly ignores the *current* appointment being rescheduled when calculating what is free.
