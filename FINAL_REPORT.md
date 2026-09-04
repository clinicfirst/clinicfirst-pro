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

## Phase 10B: Sarvam Knowledge Base Architecture Audit
- **Architecture Strategy:** Option C is recommended. Clinic-1st (Supabase) remains the Source of Truth, and content is synchronized to Sarvam. This ensures data ownership, provider portability, and multi-tenant safety.
- **KB vs Tools Boundary:** Static clinic policies (timings, FAQs) belong in the Knowledge Base. Dynamic data (availability, leaves, appointments) strictly belong in PostgreSQL and must only be accessed via API Tools.
- **Agent Variables Limitation:** Agent variables are strictly for small session context (e.g., patient name) and cannot handle injecting a full Knowledge Base dynamically at runtime.
- **Synchronization Lifecycle:** The existing `clinic_knowledge_base` table is suitable but will eventually need a publishing lifecycle (`Draft` → `Pending Sync` → `Synced`) to accurately reflect whether Sarvam has ingested the updates. Because Sarvam's programmatic KB API is largely unsupported/undocumented, sync may initially require a manual Platform Admin step.
- **Security:** Client-side variables must never be trusted for tenant authorization. Secrets and PII must never enter the Knowledge Base.

**Status:** Phase 10B Audit = **COMPLETE**. No codebase or database modifications were made during this phase.

## Phase 11: Knowledge Base Architecture & Design Audit
- **Clinic-1st Control Plane:** Clinic-1st is confirmed as the System of Record and authoritative control plane for all clinic knowledge, rules, and live data. Sarvam acts purely as the voice execution layer.
- **Static vs. Dynamic Boundary:** Static clinic information (policies, FAQs, addresses) will be managed in Clinic-1st and synchronized to the Sarvam Knowledge Base. Dynamic information (availability, patient data) must never be synchronized to Sarvam; it must be requested via real-time API tools.
- **Synchronization Strategy:** Because Sarvam's programmatic Knowledge Base API is currently unavailable/unsupported, knowledge sync requires compiling Clinic-1st KB data into document formats (e.g., Markdown) for upload to the specific Sarvam agent.
- **Tenant Isolation:** Clinic-specific knowledge cannot cross tenants. The strict 1:1 mapping between `provider_agent_id` and `clinic_id` is maintained for all tool and knowledge boundaries.
- **Platform Hierarchy:** A strict hierarchy ensures that Platform Safety and Governance rules always override Clinic-level AI rules or Knowledge Base answers.

**Status:** Phase 11 Audit = **COMPLETE**. No codebase or database modifications were made during this phase.

## Phase 12: Knowledge Base Publishing & AI Receptionist Context
- **Source of Truth:** Clinic-1st is confirmed as the definitive Source of Truth. The Sarvam Knowledge Base acts only as a published, read-only runtime snapshot.
- **Publishing Pipeline:** A Clinic Admin maintains knowledge in Clinic-1st. A compiler generates a tenant-specific document (e.g., Markdown) which is then pushed to the Sarvam Agent. If publishing fails, Sarvam safely falls back to the previous version, and Clinic-1st records a `PUBLISH_FAILED` state.
- **Static vs. Live Data:** Static knowledge (FAQs, addresses, policies) is compiled into the KB snapshot. Live business data (availability, leaves, appointments) must bypass the KB and be fetched exclusively via real-time Clinic-1st API tools.
- **Traceability & Versioning:** Future schema updates will track `knowledge_version`. This will allow telemetry to link a specific call to the exact snapshot version the AI was using, ensuring complete auditability.
- **Security:** Patient PII, API keys, and dynamic schedules are strictly forbidden from entering the compiled Knowledge Base snapshot.

**Status:** Phase 12 Audit = **COMPLETE**. No codebase or database modifications were made during this phase.

## Phase 13: Sarvam KB Publishing Capability Audit
- **API Capabilities:** Sarvam AI does not currently offer a public management API for programmatically uploading, updating, or assigning Knowledge Base documents to Voice Agents. Management is restricted to the Sarvam Console.
- **Publishing Model Decision:** Because fully automated API synchronization is not officially supported, we must adopt **Model B (Semi-Automated Publishing)**. Clinic-1st will act as the Source of Truth and compile a tenant-isolated knowledge snapshot (e.g., Markdown/PDF) which a Platform Admin manually uploads to the Sarvam Console.
- **Runtime Context Limits:** Model C (passing all knowledge via runtime variables) is rejected due to token limits and latency constraints.
- **Strict Data Boundaries:** Live transactional data (availability, schedules, patient records) remains strictly outside the Sarvam KB and is fetched exclusively via secure API Tools.

**Status:** Phase 13 Audit = **COMPLETE**. 
**FINAL DECISION:** **B. Automated publishing is not officially supported → design safe semi-automated publishing.**

## Phase 14: Knowledge Snapshot Compiler Design
- **Compiler Principle:** Clinic-1st will use a read-only compiler to aggregate static clinic data (FAQs, Services, Doctors, Policies) into a single, voice-optimized Markdown snapshot. 
- **Data Exclusion:** The compiler explicitly strips all live transactional data (patient info, live availability, appointments) and internal identifiers (UUIDs, API keys).
- **Versioning & Mismatch Detection:** The system will track the `Clinic-1st Compiled Version` vs the `Sarvam Agent Active Version`. If the snapshot is not yet published by the Platform Admin, Clinic-1st clearly warns that the AI is still operating on older knowledge.
- **Schema Assessment:** The current `clinic_knowledge_base` table tracks individual articles. A future migration will be needed to add a `clinic_knowledge_releases` table to track the compiled snapshots, their DRAFT/PUBLISHED state, and document hashes.
- **Role Separation:** Clinic Admins author and submit knowledge. Platform Admins download the ready-to-upload snapshot and deploy it to Sarvam.
- **AI Safeguards:** The compiled document will include explicit reinforcement instructions ensuring the AI defers to API tools for all live scheduling queries.

**Status:** Phase 14 Audit = **COMPLETE**. No codebase or database modifications were made during this phase.

## Phase 15: Minimum Viable Knowledge Publishing Workflow
- **Bug Fix:** Fixed an API route mismatch (`/api/ai/phone-call/start` -> `/api/ai/call/start`) in the browser simulator to ensure test calls connect successfully.
- **HARD STOP INITIATED:** Phase 15 requires deterministic hash comparison and tracking of published versions versus compiled versions. Inspection of the database confirms that no existing table can store the `document_hash`, `version_number`, or `status` (Compiled vs. Published) for the overall clinic snapshot without improvising on unrelated fields. 
- **Exact Schema Requirement:** A new table (e.g., `clinic_knowledge_releases`) is required to safely persist this state and the compiled Markdown output. Awaiting authorization to create this migration before building the compiler.

## Phase 15: Minimum Viable Knowledge Publishing Workflow
- **Database Migration:** Successfully executed an additive schema migration to support `clinic_knowledge_releases` on both the Supabase sync-layer and the `server/db.ts` fallback.
- **Compiler Construction:** Built `knowledgeCompiler.routes.ts` to deterministically compile the `clinic_knowledge_base`, filtering out UUIDs, secrets, and live dynamic data.
- **Change Detection:** Deployed SHA-256 hash tracking; generating a snapshot will now skip database writes if the clinic's content is identical to the last version.
- **UI Integration:** Built `KnowledgeCompilerPanel` into the AI Receptionist screen, establishing a clean workflow for Clinic Admins to preview the AI context, and Platform Admins to download the sanitized Markdown and confirm publication.
- **Outcome:** The Phase 15 Minimum Viable Knowledge Publishing workflow is fully operational.

## Phase 18: Final Live AI Receptionist Acceptance Test
- **Target Clinic:** Sanjeevani Multispeciality Clinic (`clinic_id`: `clinic_1787923240249_cqgw`, `provider_agent_id`: `sarvam_agent_456`).
- **Live Configuration (`GET /api/clinic/me/ai-widget-config`):** Succeeded with HTTP 200 on production (`https://clinicfirst.vercel.app`), returning strictly browser-safe configuration with zero secret exposure.
- **Webhook & Secret Protection:** Constant-time authentication (`crypto.timingSafeEqual`) ensures webhook requests must carry the authorized bearer tool secret and isolates execution to the clinic tied to `provider_agent_id`.
- **Live Inbound Call:** `POST /api/ai/call/start` returned HTTP 200 with an active session ID and verified greeting generated from authoritative clinic data.
- **Tenant Isolation:** Cross-clinic requests strictly reject with HTTP 403 Forbidden.
- **Dev Server Resilience:** Fixed development boot fallback in `server/supabaseDiff.ts` to prevent uncaught exceptions when `SUPABASE_SERVICE_ROLE_KEY` is not defined in local development environments.

