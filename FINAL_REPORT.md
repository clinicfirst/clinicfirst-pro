## Phase 9C: Security Hardening Fixes
- **413 Handling (GREEN):** The payload size limit middleware now returns a controlled `413 Payload Too Large` JSON response (`{"success":false,"error_code":"PAYLOAD_TOO_LARGE"}`) instead of bubbling up to the global error handler which previously masked it as a `500 Internal Server Error`.
- **Proxy/Rate-Limiting (GREEN):** Cloud Run (and typical Vercel/Nginx reverse proxy environments) injects `X-Forwarded-For` headers. Because the Clinic-1st app was not configured to trust the immediate reverse proxy, IP-based rate limiting would have treated the entire clinic or platform traffic as coming from a single IP. `app.set('trust proxy', 1);` was explicitly added to configure Express securely for this proxy topology.
- **Production Rate Limit Design (YELLOW):** Even with `trust proxy` correctly configured, IP-based limiting has an inherent limitation: if Sarvam's conversational webhook egress runs through a narrow set of static proxy IPs (instead of direct client browser requests), the 30 req/min limit will globally block all AI webhook calls once breached. The recommended production strategy is to shift the rate limit key from `req.ip` to the `provider_agent_id` or implement an authenticated Sarvam signature if supported in the future.
- **Regression (GREEN):** All authentication, payload protection, PII logging, and concurrency tests passed successfully after the fixes.

**Status:** Phase 9 Security Hardening = **COMPLETE**. Call Telemetry = NOT YET IMPLEMENTED. Telephony = NOT STARTED.

## Phase 10: READ-ONLY Sarvam Web Telemetry & Capability Audit
- **SDK Inspection:** The `sarvam-convai-embed` widget does not expose programmatic lifecycle events (start/end) or transcripts to the DOM.
- **Webhook Capabilities:** Sarvam does not provide native `session.ended` webhooks with transcripts. Custom "API Tools" can be configured for `on_start` and `on_end`, but they only transmit what is manually templated in the Sarvam dashboard.
- **Correlation Strategy (Option A):** Because the widget accepts a `user-id` attribute, the safest correlation method is for the Clinic-1st frontend to generate an internal `call_id`, pass it as `user-id`, and configure Sarvam to reflect it back in tool payloads.
- **Telemetry Limits:** Fields like `transcript`, `summary`, and `duration_seconds` cannot be reliably populated for web calls without undocumented API support. Provider idempotency remains PENDING/LIMITED as no stable `tool_call_id` is present by default.
- **Telephony Compatibility:** The hardened backend API Tools (booking, checking availability) are 100% channel-agnostic and fully ready for a future Telephony implementation.

**Status:** Phase 10 Audit = **COMPLETE**. No codebase or database modifications were made during this phase.
