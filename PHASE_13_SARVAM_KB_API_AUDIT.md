# Phase 13: Sarvam KB Publishing Capability Audit

## 1. Sarvam Knowledge Base API Capability Matrix
Based on an exhaustive review of official Sarvam documentation, APIs (Chat, STT, TTS, Translation, Transliteration), and platform capabilities, here is the definitive matrix for programmatic Knowledge Base (KB) management:

| Capability | Officially Supported? | API | Console | Automation Possible? |
| :--- | :--- | :--- | :--- | :--- |
| **Upload KB** | NO (Console Only) | ❌ | ✅ | ❌ |
| **Update KB** | NO (Console Only) | ❌ | ✅ | ❌ |
| **Delete KB** | NO (Console Only) | ❌ | ✅ | ❌ |
| **Assign KB to Agent** | NO (Console Only) | ❌ | ✅ | ❌ |
| **Publish Agent** | NO (Console Only) | ❌ | ✅ | ❌ |
| **Retrieve KB** | NO (Console Only) | ❌ | ✅ | ❌ |
| **Version KB** | NO | ❌ | ❌ | ❌ |

*Conclusion:* Sarvam currently provides robust APIs for runtime execution (Speech, LLM inference, Translation) but **does not** provide a public management API for provisioning agents or uploading Knowledge Base documents. Automation via undocumented APIs is strictly rejected as per our safety and architecture guidelines.

## 2. Evaluation of Implementation Models

### Model A: Fully Automated
* **Status:** `REJECTED` (Not Supported)
* **Reason:** Without official public endpoints for KB file uploads and agent association, we cannot build an automated CI/CD pipeline directly from Clinic-1st to Sarvam.

### Model B: Semi-Automated
* **Status:** `RECOMMENDED` (Safest Interim Solution)
* **Flow:** Clinic-1st (Compile Snapshot) → Download Markdown/PDF → Platform Admin uploads to Sarvam Console → Publish Agent.
* **Reason:** This correctly respects the boundary that Clinic-1st is the Source of Truth, while adapting to the limitations of Sarvam's current platform.

### Model C: Runtime Knowledge Instead of Sarvam KB
* **Status:** `REJECTED` (Not Scalable/Viable)
* **Reason:** While Sarvam supports Agent Variables, passing an entire clinic's FAQ, policies, and instructions as a variable string on every session start will exceed token limits, increase latency, and degrade transcription/LLM performance. Runtime context is exclusively reserved for dynamic transactional data via API Tools.

## 3. Mandatory Architectural Rules (Recap)
The following dynamic business data **MUST NEVER** be placed in the Sarvam KB (whether manually uploaded or not):
* Patient information & PII
* Appointments & historical records
* Live availability & doctor leave
* Booking/Cancellation/Rescheduling states
* API keys and secrets

## 4. Future Publishing Design
To prepare for an eventual automated API, Clinic-1st should track the KB state:
`Draft` → `Validate` → `Compile` (Generates Snapshot) → `Publish Pending` (Admin uploads to Console) → `Published` (Live in Sarvam).
*Note: No database schema migrations are executed during this phase.*

## 5. Security & Tenant Isolation
The manual upload step places a responsibility on the Platform Admin. 
* The compiled snapshot for `Clinic A` must strictly be uploaded to the Sarvam Agent tied to `Clinic A`'s `provider_agent_id`.
* The mapping (`authenticated clinic_id` → `ai_agents` → `provider_agent_id`) remains the sole authority. A browser must never be trusted to dictate agent assignment.

## 6. FINAL DECISION
**B. Automated publishing is not officially supported → design safe semi-automated publishing.**
Since Sarvam lacks a public API for agent/knowledge management, we must implement Model B. Clinic-1st will act as the compiler, generating an isolated KB document per clinic. A Platform Admin will handle the "last mile" upload into the Sarvam Console until official programmatic support is released.
