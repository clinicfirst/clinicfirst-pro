# Phase 11: Browser Receptionist Design & Architecture

## 1. Clinic-1st vs Sarvam Knowledge Base Architecture

### Core Architectural Principle
**Clinic-1st is the System of Record** for all clinic-specific business knowledge. 
Clinic Admins will maintain their static information (addresses, services, rules) directly in the Clinic-1st platform. They should **not** be required to log in to the Sarvam Console to maintain a separate copy of this information. 

### Separation of Knowledge vs. Agent Configuration
*   **Clinic-1st (Authoritative Data & Rules):**
    *   `clinic_knowledge_base`
    *   `clinic_ai_rules`
    *   `clinic_ai_tools` (endpoints/schema)
    *   Clinic Configuration (Doctors, Services, Schedules, Appointments, Policies)
*   **Sarvam Console (AI Runtime & Voice Configuration):**
    *   Agent creation and provisioning
    *   Voice selection (TTS models)
    *   Language settings (ASR models)
    *   Core conversational instructions (base prompt)
    *   Channel configuration (telephony integration)
    *   Tool mapping (wiring to Clinic-1st webhook)

## 2. Sarvam Knowledge Consumption Capabilities
Based on Sarvam's official documentation and console behavior, here is how a Sarvam Voice Agent consumes knowledge:

| Capability | Status | Notes |
| :--- | :--- | :--- |
| **Knowledge Base upload (Console)** | `CONFIRMED` | Allows uploading PDFs, DOCX, TXT via UI. |
| **Dynamic API knowledge upload** | `NOT AVAILABLE / UNKNOWN` | Currently, Sarvam focuses on real-time inference APIs. KB management is done via the console. |
| **Dynamic API context injection (RAG)** | `NOT AVAILABLE` | Cannot query Clinic-1st on-the-fly just for knowledge chunks without explicitly using an API Tool. |
| **Agent Variables** | `CONFIRMED` | Variables (`{{patient_name}}`) can be injected, but are restricted by size/tokens and cannot hold an entire KB. |
| **External API tools for knowledge** | `CONFIRMED` | You can configure a tool (e.g., `get_clinic_info`) for the agent to fetch knowledge at runtime. |

*Conclusion:* An existing Sarvam Voice Agent cannot dynamically ingest an entire clinic's knowledge base via variables at session start. It either needs the documents uploaded into its Console KB, or it needs an explicit API tool to retrieve answers from Clinic-1st.

## 3. Dynamic Data vs. Static Knowledge Boundaries
To avoid stale responses or duplicate maintenance, the architecture must strictly separate static and dynamic data:

*   **Static/Stable Knowledge (Context/KB):** Clinic address, opening hours, payment methods, doctor specialties, general FAQs. *These can be synced to the Sarvam Knowledge Base.*
*   **Dynamic/Transactional Information (API Tools):** Today's availability, doctor leaves, appointment status, patient records. *These MUST NOT be stored in the Sarvam KB. They must exclusively be retrieved via real-time Clinic-1st API tools.*

## 4. Recommended Future Architecture
```text
             CLINIC-1ST CONTROL PLANE
                      │
       ┌──────────────┼──────────────┐
       │              │              │
   Knowledge       Rules          Tools
       │              │              │
       └──────────────┼──────────────┘
                      │
                AI Agent Mapping
                      │
                      ▼
                 SARVAM RUNTIME
                      │
                Web / Telephony
                      │
                      ▼
                   Patient
```
*   **Static queries** (e.g., "Do you accept UPI?") route to the synchronized Clinic Knowledge.
*   **Live/Mutation queries** (e.g., "Book tomorrow at 4 PM") route to Clinic-1st API Tools (`check_availability`, `book_appointment`).

## 5. Platform vs. Clinic Knowledge Hierarchy
Precedence must be strictly maintained to ensure safety:

1.  **Platform AI Safety Rules** (Highest Priority, cannot be overridden)
2.  **Platform AI Governance** (General platform behavioral rules)
3.  **Clinic AI Rules** (Clinic-specific instructions)
4.  **Clinic Knowledge** (Clinic FAQs and policies)
5.  **Live Clinic Data via Tools** (Authoritative dynamic facts)

*Rule:* A Clinic Admin can never override a Platform safety constraint (e.g., medical disclaimers) using their local `clinic_ai_rules` or `clinic_knowledge_base`.

## 6. Knowledge Base Versioning & Synchronization
*   **Versioning:** In the future, Clinic-1st should implement versioning (`knowledge_version`, `updated_at`, `status`). This provides auditability, enables rollback, and tracks what was theoretically known by the AI at the time of a historical call.
*   **Synchronization Strategy:** Because Sarvam currently lacks a robust public API for programmatic KB file uploads/syncing, the temporary synchronization strategy is:
    1.  Clinic Admin updates KB in Clinic-1st (saved as Draft/Authoritative).
    2.  Platform Admin (or automated compilation script) generates a unified Markdown document.
    3.  Document is manually uploaded (or uploaded via an internal proxy if Sarvam releases an API) to the specific Sarvam Agent.

## 7. Multi-Tenant Isolation
Tenant boundaries remain authoritative based on the webhook validation:
*   `Clinic A KB` is strictly attached to `Agent A`.
*   `Clinic B KB` is strictly attached to `Agent B`.
*   The backend webhook enforces that `Agent A`'s tools can only read/mutate `Clinic A`'s PostgreSQL data.

## 8. Sarvam Console Configuration Mapping
| Configuration | Clinic-1st | Sarvam Console | Source of Truth |
| :--- | :--- | :--- | :--- |
| Clinic name | ✓ | (Via KB/Vars) | Clinic-1st |
| Address | ✓ | (Via KB/Vars) | Clinic-1st |
| Services | ✓ | (Via KB) | Clinic-1st |
| Doctors | ✓ | (Via KB) | Clinic-1st |
| Fees | ✓ | (Via KB) | Clinic-1st |
| FAQs | ✓ | (Via KB) | Clinic-1st |
| Cancellation policy | ✓ | (Via KB) | Clinic-1st |
| AI rules | ✓ | (Via KB/Prompt) | Clinic-1st |
| Voice | | ✓ | Sarvam |
| Language | | ✓ | Sarvam |
| Voice behavior | | ✓ | Sarvam |
| Agent configuration | Mapping ID | ✓ | Sarvam |
| Tool endpoint | Mapping ID | ✓ | Sarvam |
| Live availability | ✓ | No | Clinic-1st (DB/Tool) |
| Appointment booking| ✓ | No | Clinic-1st (DB/Tool) |
| Patient data | ✓ | No | Clinic-1st (DB/Tool) |

## 9. Final Recommended Production Architecture
Clinic-1st will serve as the master control plane. It holds the authoritative business knowledge, dynamic PostgreSQL data, and safety governance. Sarvam is treated purely as the voice/AI execution layer. Static knowledge is synchronized (compiled into documents) from Clinic-1st to Sarvam's Knowledge Base, while all dynamic/transactional workflows are piped directly back to Clinic-1st via hardened Webhook Tools. This separation guarantees multi-tenant safety and allows eventual portability to other AI providers.
