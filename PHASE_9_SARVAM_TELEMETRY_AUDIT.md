# Phase 9A: Sarvam Session & Telemetry Investigation
- **Web Channel Events:** The official Sarvam `<sarvam-widget>` web component does not document comprehensive native browser events (like `session_start` or `session_end`) that we can securely trust for telemetry or billing.
- **Webhook Events:** Sarvam allows custom "API Tools" which can be configured to run during conversations, or automatically via `on_start` and `on_end` triggers. However, these are arbitrary tools rather than dedicated native lifecycle webhooks.
- **Limitation:** There is no official documentation confirming that Sarvam natively pushes detailed `session.ended` webhooks with duration, summary, or transcripts for the web widget channel out-of-the-box. We must rely on configuring `on_start` and `on_end` tools within the Sarvam dashboard to act as lifecycle proxies if needed.

# Phase 9B: Inspect Actual Browser Events
- **Current State:** `SarvamVoiceWidget.tsx` renders the `<sarvam-widget>` element.
- **Findings:** The widget does not currently expose or emit `connecting`, `connected`, `listening`, `session started`, or `session ended` DOM events.
- **Security Rule:** Even if browser events existed, they cannot be trusted for authoritative lifecycle creation. The internal Clinic-1st backend must remain authoritative.

# Phase 9C: Calls Lifecycle Mapping
Using the existing `calls` table:
- **CALL REQUESTED:** `status: 'in_progress'`, `outcome: 'IN_PROGRESS'` (Created by Clinic-1st before widget interaction)
- **CALL STARTED:** Acknowledged via a Sarvam `on_start` tool webhook.
- **CALL ACTIVE:** Ongoing tool webhooks (`check_availability`, etc.).
- **CALL ENDED:** Acknowledged via a Sarvam `on_end` tool webhook.
- **CALL FINALIZED:** `status: 'completed' | 'failed'`, `outcome: 'RESOLVED' | 'ESCALATED' | 'ABANDONED'`

# Phase 9D: Who Creates the Call Record
**Safest Architecture:**
1. Authenticated Clinic-1st user (Frontend) calls a secure API to start a session.
2. Clinic-1st creates the internal `call.id`.
3. Frontend injects this internal `call_id` into the `<sarvam-widget>` (e.g., via the `user-id` property).
4. Sarvam sends this `user-id` back in tool payloads, allowing secure mapping to the authoritative internal call record.

# Phase 9E: True Idempotency Investigation
- **Findings:** The current Sarvam tool webhook payload does not expose a stable provider-issued identifier like `tool_call_id` or `request_id`.
- **Limitation:** True webhook-level idempotency cannot currently be guaranteed using a provider-issued mutation identifier.
- **Rule Adherence:** We will not fabricate a mutation identifier. Idempotency will remain at the structural PostgreSQL level (overlap constraints) and local memory best-effort checks.

# Phase 9F: Fix PII Logging
- **Current Behavior:** `voice.routes.ts` blindly logs the entire payload: `console.log('[Sarvam Webhook] ... Payload:', req.body);`. This leaks `patient_name` and `patient_phone`.
- **Fix:** Remove raw payload logging. Log structured, redacted metadata:
  ```json
  { "event": "sarvam_tool_call", "provider_agent_id": "...", "clinic_id": "...", "tool": "book_appointment", "timestamp": "..." }
  ```

# Phase 9G: Constant-Time Webhook Authentication
- **Current Behavior:** `if (token !== CLINICFIRST_AI_TOOL_SECRET)` (Vulnerable to timing attacks).
- **Fix:** Upgrade to `crypto.timingSafeEqual` with buffer length validation.

# Phase 9H: Rate Limiting
- **Current Behavior:** No rate limiting is applied to the API or webhook routes.
- **Recommendation:** Install `express-rate-limit`. Apply a limit of 30 requests per minute per IP to `/webhook/sarvam/:provider_agent_id`. Return `429 Too Many Requests`. 

# Phase 9I: Payload Size Protection
- **Current Behavior:** The global express server in `app.ts` allows bodies up to `50mb`.
- **Recommendation:** Mount `express.json({ limit: '100kb' })` specifically on `voiceRouter` to reject oversized payload floods. Return `413 Payload Too Large`.

# Phase 9J: Webhook Replay Protection
- **Findings:** Sarvam does not appear to provide a cryptographic timestamp or request signature header (only the static Bearer token).
- **Limitation:** Advanced replay protection based on signatures cannot be implemented. The Bearer token remains the primary mechanism.

# Phase 9K: Webhook Input Validation
- **Current Behavior:** Basic checks exist, but lacks strict type enforcement.
- **Fix:** Reject unknown tools, malformed JSON, missing fields, excessively long strings, and invalid dates strictly before processing.

# Phase 9L: Tool Allow-List
- **Current Behavior:** Explicitly checks `tool !== 'check_availability' && ...`. This is good and will be maintained. Returns 400 for unknown tools.

# Phase 9M: Error Handling
- **Current Behavior:** Good business-level errors for booking (e.g., `SLOT_NO_LONGER_AVAILABLE`).
- **Rule Adherence:** Never return PostgreSQL stack traces or raw errors to Sarvam.

# Phase 9N: Call Transcript/Privacy Policy
- **Findings:** Transcripts are not pushed real-time in tool calls. They might be retrievable post-call via a separate API, but there is no native webhook push.
- **Recommendation:** Do not automatically store full transcripts indefinitely. Healthcare data minimization principles apply. 

# Phase 9O: Call Summaries
- **Findings:** If Sarvam does not provide native AI summaries via webhook, do not build an internal LLM pipeline to generate them. Reuse provider outputs only if available.

# Phase 9P: Observability
- **Design:** Structured logging around `internal_call_id`, `clinic_id`, `tool`, `status`, `error_code`, and `latency`. No raw text strings.

# Phase 9Q: Security Test Matrix
- **Webhook Authentication:** missing secret -> 401, wrong secret -> 403, correct secret -> 200
- **Tenant Isolation:** Agent A accessing Clinic B -> DENY
- **Tool Validation:** unknown tool -> 400
- **Payload Limits:** >100kb -> 413
- **PII:** production logs -> no raw patient names/phones
- **Database:** constraint violations -> mapped to business error strings

# Phase 9R: Production Readiness Matrix
| Capability | Current | Target | Blocker? |
| :--- | :--- | :--- | :--- |
| Browser voice | GREEN | GREEN | No |
| Tenant routing | GREEN | GREEN | No |
| Tool authentication | YELLOW | GREEN | Yes |
| PII logging | RED | GREEN | Yes |
| Rate limiting | YELLOW | GREEN | Yes |
| Payload limits | YELLOW | GREEN | Yes |
| Appointment concurrency | GREEN | GREEN | No |
| Call lifecycle | RED | GREEN | Yes |
| Transcript | RED | TBD | TBD |
| Summary | RED | TBD | TBD |
| Tool idempotency | PENDING | TBD | TBD |
| Observability | YELLOW | GREEN | Yes |

# Phase 9S: Implementation Boundary
**Stop.** The READ-ONLY audit is complete. 
- Exact files to modify: `server/routes/voice.routes.ts`, `server/app.ts`, `package.json` (add `express-rate-limit`).
- No database schema changes are required (existing `calls` table can map states).
- No code has been modified. Awaiting authorization to begin Phase 9 implementation.
