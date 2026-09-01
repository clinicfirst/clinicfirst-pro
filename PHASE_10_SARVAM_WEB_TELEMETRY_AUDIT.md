# Phase 10: READ-ONLY Sarvam Web Telemetry & Capability Audit

## 1. Audit the Actual Web SDK (`sarvam-convai-embed`)
By statically analyzing `https://unpkg.com/sarvam-convai-embed@1.0.19/index.js`, we determined its exact capabilities:
- **session_started, session_ended, call_started, call_ended, disconnect, error**: **NOT AVAILABLE**. The web component does not dispatch these events to the DOM (it only dispatches a `sarvam:redirect` CustomEvent).
- **Callbacks**: The widget does not accept React-style callbacks (e.g., `onStart`, `onEnd`) as properties. 

## 2. Available Identifiers
| Identifier | Available? | Source | Stable? | Suitable for correlation? |
| :--- | :--- | :--- | :--- | :--- |
| **session_id** | Internal Only | Inside the JS bundle (`this.referenceId`) | Yes (for the session) | No (not exposed to DOM/App) |
| **user_id** | YES | Passed as HTML attribute | Yes | **YES** (Controlled by us) |
| **app_id / org_id** | YES | Passed as HTML attribute | Yes | No (Static configuration) |
| **tool_call_id** | UNKNOWN | Webhook payload | Unknown | Unknown (Depends on Sarvam dashboard config) |

## 3. Browser Runtime Behavior
The widget communicates via WebSockets internally. It logs messages to the browser console (e.g., `console.log("Text message:", msg)`, `console.log("Transcript:", ...)`). However, there is no programmatic bridge to extract these messages into the React application's state.

## 4. Transcript Availability
- **During conversation**: **NOT AVAILABLE** programmatically (only logged to console).
- **After conversation**: **NOT AVAILABLE** natively. There is no documented feature that automatically posts the full transcript to our backend upon call completion for the web channel.

## 5. Lifecycle Webhooks
- **System Lifecycle Webhooks**: **NOT AVAILABLE**. Sarvam does not automatically push `session.started` or `session.ended` events to a predefined endpoint.
- **API Tools (`on_start`, `on_end`)**: **CONFIRMED**. Sarvam allows configuring custom "API Tools" that trigger at the start and end of a call. However, these are strictly arbitrary outbound HTTP requests where the developer must manually define the JSON body template in the Sarvam dashboard. They do not inherently contain rich telemetry (like transcripts) unless Sarvam's template engine specifically supports injecting them.

## 6. Tool-Call Identity (Provider Idempotency)
- **Status:** **PENDING / LIMITED**
- The current webhook payload only contains the fields we defined (`tool`, `date`, `service`, etc.). Unless Sarvam supports injecting a unique `{{request_id}}` or `{{tool_call_id}}` variable in the dashboard's tool template, we cannot deduplicate at the network layer. We must continue relying on PostgreSQL's airtight exclusion constraints.

## 7. Behavior of `user-id`
The `user-id` is passed as a string attribute to `<sarvam-widget>`. It is strictly metadata. It should be used to pass an internal identifier to Sarvam, which can then theoretically be injected back into tool payloads (e.g., `{{user_id}}`) for backend correlation. It must never be used as a security token.

## 8. Recommended Call-Correlation Architecture
**Option A is the only viable strategy:**
1. Clinic-1st Frontend creates a call record in our backend and receives an internal `call_id`.
2. Frontend mounts the widget, passing the internal `call_id` as the `user-id` attribute.
3. Sarvam is configured (via its dashboard) to include `{{user_id}}` in all tool webhook payloads.
4. Clinic-1st Backend correlates the tool actions (e.g., booking an appointment) to the `calls` table using the returned ID.

## 9. Existing `calls` Table Compatibility
| Field | Can be populated reliably? | Source |
| :--- | :--- | :--- |
| `id` | YES | Generated internally by Clinic-1st |
| `clinic_id`, `agent_id` | YES | Looked up via `provider_agent_id` |
| `status`, `outcome` | YES (Partial) | Mapped from tool usage / manual UI updates |
| `provider_session_id` | NO | Not natively exposed by widget or webhooks |
| `transcript`, `summary` | NO | Not pushed natively by webhooks |
| `duration_seconds` | NO | Cannot accurately measure without start/end events |

## 10. Security & Privacy Assessment
- **Browser-Visible:** The browser network tab and console can see the live transcript via WebSocket. This is acceptable for the active user.
- **Server-Visible:** Our backend only sees tool invocations (which we have hardened).
- **Sarvam-Visible:** Sarvam processes the raw audio, generates transcripts, and has access to whatever PII the user speaks (e.g., patient name, phone).

## 11. Browser vs. Telephony Compatibility
- **Reusable:** The AI Agent prompt, knowledge base, languages, voice, and **Backend API Tools** (check_availability, book, cancel, reschedule) are 100% compatible. 
- **Telephony Advantage:** A SIP/Telephony integration typically offers a much stronger lifecycle model (e.g., Twilio webhook events for call start, call ringing, call answered, call completed, call recording url). The current web widget is effectively a "black box" UI wrapper.

## 12. Production Telemetry Recommendation
Do not implement fake precision.
- **Do not** attempt to store transcripts or summaries for web widget calls right now, as the data is not reliably provided.
- **Do not** implement a complex state machine for the web call lifecycle. 
- Acknowledge that the Web Widget is primarily a demonstration/POC channel. True telemetry will likely only be achievable when transitioning to the Telephony channel or if Sarvam drastically updates its Web SDK API.

---
**Audit Complete.** No code was modified. No database schemas were altered.
