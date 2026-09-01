# Phase 8: AI Receptionist Integration Audit

## 1. End-to-End Architecture
The integration uses the **Sarvam AI** platform as the conversational engine.
- **Frontend:** The patient speaks into their browser using `<sarvam-widget>` (imported via `unpkg.com/sarvam-convai-embed`). The widget is initialized with `embedKey` and `appId` fetched dynamically from `/api/clinic/me/ai-widget-config`.
- **Conversational Layer:** Sarvam's cloud processes the speech, determines intent, handles LLM latency, TTS, and STT.
- **Backend Webhook:** When Sarvam determines a tool should be executed (e.g., booking an appointment), it sends an HTTP POST to our `/webhook/sarvam/:provider_agent_id` endpoint.
- **Mutation:** The webhook resolves natural language entities (services, doctors) and invokes the unified `AppointmentService`.

## 2. Tenant Resolution (Verified: GREEN)
The architecture correctly maintains strict tenant isolation:
- `provider_agent_id` is mapped directly to a specific `clinic_id` in the database (`ai_agents` table).
- The Sarvam conversational payload is **never trusted** to supply the `clinic_id`. 
- All doctors, services, and appointments are resolved purely within the boundaries of the resolved `clinic_id`.
- Cross-clinic data leakage via the AI is structurally prevented.

## 3. Tool Inventory
| Tool | Read/Write | Tenant Source | AppointmentService | PostgreSQL |
| :--- | :--- | :--- | :--- | :--- |
| `check_availability` | READ | URL Parameter | N/A | READ |
| `book_appointment` | WRITE | URL Parameter | YES | YES |
| `cancel_appointment` | WRITE | URL Parameter | YES | YES |
| `reschedule_appointment`| WRITE | URL Parameter | YES | YES |

*All tools correctly utilize the unified `AppointmentService` for PostgreSQL-authoritative mutations.*

## 4. Webhook Security (Verified: YELLOW - Needs Hardening)
- **Status:** Functional, but relies on a standard string comparison (`token !== CLINICFIRST_AI_TOOL_SECRET`).
- **Risk:** Vulnerable to timing attacks. Should be upgraded to `crypto.timingSafeEqual`.
- **Missing:** Payload size limits and explicit rate-limiting are not currently implemented on the webhook route.

## 5. Browser Security (Verified: GREEN)
- No critical secrets (`CLINICFIRST_AI_TOOL_SECRET`, `SARVAM_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are exposed to the browser bundle.
- The `VITE_SARVAM_EMBED_KEY` is explicitly meant for frontend consumption and is passed securely via authenticated API only to clinic members.

## 6. Conversational UX & Ambiguity Handling (Verified: GREEN)
The webhook logic explicitly forces the AI to ask for clarification rather than guessing:
- If a patient says "I want a consultation" and multiple services match, the webhook returns `requires_clarification: true` with a list of matches.
- If multiple active appointments exist during a cancellation request, the webhook returns `AMBIGUOUS_APPOINTMENT` forcing the AI to clarify the exact date/time with the patient.
- Unavailable services/doctors result in a clean conversational error response ("Service not found at this clinic").

## 7. PostgreSQL Concurrency (Verified: GREEN)
If two AI sessions (or an AI and a Human) attempt to book the same slot simultaneously:
- The `AppointmentService` delegates to PostgreSQL.
- The `appointments_no_overlap_excl` constraint rejects one.
- The webhook catches `23P01`, maps it to `SLOT_NO_LONGER_AVAILABLE`, and returns `suggest_retry_availability: true` to Sarvam.
- Sarvam naturally asks the user to pick another time.

## 8. Session & Call Records (Finding: RED - Production Blocker)
- **Status:** Incomplete.
- **Finding:** The webhook route (`/webhook/sarvam/:provider_agent_id`) only handles isolated tool invocations. There are no webhooks implemented for `call_started` or `call_ended`.
- **Impact:** Clinic-1st does not currently record AI call duration, full transcripts, or summaries. The `db.createCall` logic found in `server/voice/voice-engine.ts` is orphaned/legacy and not hooked up to the Sarvam integration. 

## 9. Privacy & Logging (Finding: YELLOW - Needs Hardening)
- **Status:** The webhook currently logs the entire payload body: `console.log('[Sarvam Webhook] ... Payload:', req.body);`.
- **Risk:** This prints Patient Names and Phone Numbers in plaintext to the server console. PII should be masked or omitted from default logging.

## 10. Idempotency (Status: PENDING)
- Structural concurrency (overlapping appointments) is completely solved via PostgreSQL.
- Network idempotency (Sarvam sending the exact same `book_appointment` webhook twice due to a timeout) is only handled via a "best-effort" local memory check. True idempotency requires capturing a unique `call_id` or `tool_call_id` from Sarvam's payload.

---

## Production-Readiness Matrix

| Area | Status | Evidence | Remaining Risk |
| :--- | :--- | :--- | :--- |
| Browser voice | 🟩 GREEN | Widget loads dynamically based on config | None |
| Tenant isolation | 🟩 GREEN | URL `provider_agent_id` -> DB `clinic_id` | None |
| Tool authentication | 🟨 YELLOW | Bearer token validation exists | Use `timingSafeEqual` |
| Availability | 🟩 GREEN | Accurate PostgreSQL-backed checks | None |
| Booking/Cancel/Resch | 🟩 GREEN | Unified `AppointmentService` | None |
| PostgreSQL concurrency| 🟩 GREEN | Exclusion constraint handles races | None |
| Call records & Transcripts| 🟥 RED | No call lifecycle webhooks exist | Clinics cannot review calls |
| Error handling | 🟩 GREEN | Ambiguity & rejection handled gracefully | None |
| Rate limiting | 🟨 YELLOW | None currently applied | Abuse risk |
| Logging/privacy | 🟨 YELLOW | PII printed to server console | Mask PII |
| Idempotency | 🟨 YELLOW | Best-effort only | Tool retries could duplicate |

## Recommended Next Phase
**Phase 9: AI Telemetry & Security Hardening**
1. Implement Call Lifecycle Webhooks to capture transcripts, summaries, and duration from Sarvam.
2. Upgrade Webhook authentication to use `crypto.timingSafeEqual`.
3. Mask PII in server console logs.
4. Implement proper Sarvam `call_id` extraction for true tool idempotency.
