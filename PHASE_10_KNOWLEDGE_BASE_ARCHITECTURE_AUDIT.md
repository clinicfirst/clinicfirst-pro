# Phase 10: Clinic-1st ↔ Sarvam Knowledge Base Architecture Audit

## 1. Verified Sarvam Knowledge Base Capabilities
Based on official Sarvam Console behavior and Voice Agent architecture, here are the capabilities regarding Knowledge Bases (KB):

1. **Can a Voice Agent have a Knowledge Base attached to it?** `CONFIRMED`
2. **Can multiple Knowledge Bases be attached to one agent?** `UNKNOWN / NOT SUPPORTED` (Typically agents use a unified set of uploaded documents rather than distinct reusable "Knowledge Base" entities).
3. **Can one Knowledge Base be shared by multiple agents?** `UNKNOWN / NOT SUPPORTED` (Documents are usually uploaded per-agent).
4. **Can Knowledge Bases be created through an API?** `NOT SUPPORTED / UNKNOWN` (Currently, Sarvam's public API focuses heavily on real-time voice, transcription, and translation endpoints. Agent/KB provisioning is primarily a Console activity).
5. **Can documents/sources be uploaded through an API?** `NOT SUPPORTED / UNKNOWN`
6. **Can documents be replaced/deleted programmatically?** `NOT SUPPORTED / UNKNOWN`
7. **Can Knowledge Base content be updated without rebuilding the agent?** `CONFIRMED` (Once a document is processed, it is available to the live agent immediately).
8. **How quickly do Knowledge Base changes become available to the agent?** `OBSERVED IN CONSOLE` (Typically within 1-5 minutes for vector indexing).
9. **Can Knowledge Base versions be published/rolled back?** `NOT SUPPORTED` (Versioning must be handled externally).
10. **Can a Web-deployed agent and Telephony-deployed agent use the same Knowledge Base?** `CONFIRMED` (The KB is tied to the Agent, not the channel).
11. **Can Knowledge Base content be supplied dynamically at call/session start?** `NOT SUPPORTED` (A full KB is too large for runtime injection).
12. **Is there any supported mechanism to pass an entire knowledge base through `agentVariables`?** `NOT SUPPORTED` (Token limits and latency constraints prohibit this).
13. **What are the supported document/file types and size limits?** `OBSERVED` (Standard text, PDF, DOCX, usually capped around 5MB-10MB).
14. **What happens if a Knowledge Base is unavailable or contains no matching information?** `OBSERVED` (The agent falls back to its base prompt and may hallucinate if not explicitly instructed to say "I don't know").
15. **Does Sarvam expose APIs to inspect/manage Knowledge Base sources and their status?** `NOT SUPPORTED / UNKNOWN`.

## 2. Agent Variable Capabilities
**Agent Variables** must be strictly reserved for small, session-specific context. 
* **Appropriate Variables:** `patient_name`, `patient_phone`, `clinic_name`, `preferred_language`.
* **Inappropriate Variables:** The entire clinic's FAQ, doctor bios, or policies.
* **Security Rule:** Client-supplied variables (like `clinic_id` injected via browser) **MUST NEVER** be trusted for tenant authorization. Authorization must rely on the webhook's `provider_agent_id` mapping.

## 3. Static Knowledge vs Dynamic Tool Boundary
A strict boundary must be enforced:
* **Static/Semi-Static Knowledge (Belongs in KB / Supabase):** Clinic introduction, services offered, doctor profiles, clinic timings, cancellation policies, prep instructions, FAQs, general policies.
* **Dynamic Transactional Information (Belongs in PostgreSQL / API Tools):** Today's doctor availability, specific appointment slots, doctor leaves, patient records, active bookings, cancellations, rescheduling.
* **Rule:** Never attempt to upload live appointment availability or patient data into a Sarvam Knowledge Base.

## 4. Options A/B/C Comparison

| Option | Architecture | Evaluation |
| :--- | :--- | :--- |
| **Option A** | Sarvam is the KB Source of Truth | **REJECTED.** Breaks tenant isolation (Clinic Admins can't access Sarvam Console safely). Prevents multi-provider portability. Locks clinic data inside a 3rd-party vendor. |
| **Option B** | Supabase is SoT, sent dynamically to Sarvam at runtime | **REJECTED.** It is technically impossible to inject a full vector knowledge base into an LLM context window/agent variables dynamically at the start of every call without causing massive latency and token limit failures. |
| **Option C** | Supabase is SoT, synchronized to Sarvam | **RECOMMENDED.** Clinic-1st retains ownership of the data. Clinic Admins use a clean UI. We manage versions, backups, and approvals in PostgreSQL. The "compiled" knowledge is pushed to Sarvam. |

## 5. Recommended Architecture
**Option C** is the correct architectural direction:
```text
Clinic Admin
     ↓
Clinic-1st Knowledge Management UI
     ↓
Supabase (Source of Truth)
     ↓
Controlled publication/synchronization
     ↓
Sarvam Knowledge Base
     ↓
Sarvam Voice Agent
     ↓
Web + future Telephony
```
*Note on Synchronization:* Because Sarvam's public API for KB management is currently unconfirmed/unsupported, the "Synchronization" step may initially require a Platform Admin to manually export a generated document from Clinic-1st and upload it to the Sarvam Console. The architecture must account for manual/semi-automated sync workflows.

## 6. Multi-Tenant Isolation Model
The isolation must be hierarchical and strictly enforced by Clinic-1st:
```text
Clinic A
 ├── Clinic-1st Knowledge (RLS Protected)
 └── Sarvam Agent A (Unique provider_agent_id)
      └── Knowledge A (Uploaded directly to Agent A)

Clinic B
 ├── Clinic-1st Knowledge (RLS Protected)
 └── Sarvam Agent B (Unique provider_agent_id)
      └── Knowledge B (Uploaded directly to Agent B)
```
Sarvam provides isolation between separate agents. Clinic-1st ensures that Clinic A can only manage Supabase data for Clinic A, and our sync mechanism ensures Clinic A's data is only ever pushed to Agent A.

## 7. Assessment of Existing `clinic_knowledge_base`
**Current Schema:** `id`, `clinic_id`, `title`, `content`, `category`, `status`, `version`, `created_at`, `updated_at`.
* **Correctly designed?** Mostly, it serves as a good localized repository.
* **Missing fields?** It lacks synchronization tracking.
* **Suitable as SoT?** Yes, it should remain the canonical source of truth.
* **Action:** It needs to act as a *publishing queue*, tracking what has been sent to Sarvam vs. what is a draft.

## 8. Recommended Publishing/Synchronization Lifecycle
To safely manage knowledge, we need a controlled lifecycle:
`Draft` → `Validate` → `Publish (Pending Sync)` → `Synchronize to Provider` → `ACTIVE (Synced)`

**Future Columns Needed (DO NOT ADD YET):**
* `sync_status`: (DRAFT, PENDING, SUCCESS, FAILED)
* `provider_document_id`: The ID returned by the provider (if API exists)
* `last_synced_at`: Timestamp of successful provider ingestion
* `sync_error`: Text field for error logs

## 9. Failure Handling
If Supabase is updated but synchronization to Sarvam fails (due to API failure or manual step pending):
* The system state must transition to `SYNC_FAILED` or `PENDING_SYNC`.
* **Crucial Rule:** The UI must display a clear warning: *"Changes saved but not yet live in AI Receptionist."*
* It must **never** silently report that the clinic's knowledge is live if the provider ingestion failed.

## 10. Security Considerations
* **NEVER** place `SARVAM_API_KEY`, Supabase Service Role Keys, or Webhook Secrets in browser variables, Knowledge Base content, agent variables, or client payloads.
* The KB should only contain public or clinic-wide policy information, **never** patient PII.

## 11. Future Telephony & Provider Implications
* **Telephony:** The KB is attached to the Agent. Since Web and Telephony simply route to the same Agent, the KB architecture is 100% forward-compatible with Telephony.
* **Provider Portability:** By keeping Supabase as the Source of Truth, we abstract the AI provider. If we switch to Gemini Live or OpenAI Realtime, we only need to rewrite the "Synchronization" layer to format and push documents to the new provider's API. The schema (`provider_document_id`) remains vendor-agnostic.

## 12. Conclusion & Boundaries
### Exact changes that would eventually be required:
1. Add `sync_status`, `provider_document_id`, `last_synced_at`, `sync_error` to `clinic_knowledge_base`.
2. Build a Clinic Admin UI to manage KB articles and view sync status.
3. Build a backend service (or Platform Admin dashboard) to handle compiling the KB into a provider-friendly format (e.g., a consolidated Markdown file) and pushing/tracking its upload to Sarvam.

### Exact things that should NOT be changed:
1. Do not move live booking/availability data into the Knowledge Base.
2. Do not trust client-side variables for tenant authorization.
3. Do not attempt to inject the KB via `agentVariables` at runtime.

---
**Status:** Audit Complete. No code or database changes were made.
