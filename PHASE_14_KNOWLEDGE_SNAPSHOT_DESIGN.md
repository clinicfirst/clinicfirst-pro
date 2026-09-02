# Phase 14: Knowledge Snapshot Compiler Design

## 1. The Knowledge Compiler Principle
The Clinic-1st Knowledge Compiler is a read-only generation engine that aggregates static clinic information into a single, cohesive, voice-optimized Markdown document. 
*   **Input:** Authoritative data from `clinics`, `services`, `doctors`, `clinic_knowledge_base`, and `clinic_ai_rules`.
*   **Output:** `Clinic_AI_Knowledge_<clinic-id>_v<version>.md`
*   **Goal:** A ready-to-upload snapshot that requires zero manual editing by the Platform Admin.

## 2. Recommended Document Structure
The snapshot will be structured to maximize retrieval accuracy for an LLM-powered Voice AI:

```markdown
# Clinic AI Receptionist Knowledge

## Clinic Overview
- **Name:** [Clinic Name]
- **Address:** [Address]

## Operating Hours
[Formatted schedule from DB]

## Services
### [Service Name]
- **Description:** [Description]
- **Duration:** [Duration mins]
- **General Pricing:** [Fee]

## Doctors
### Dr. [Doctor Name]
- **Specialty:** [Specialty]
- **General Info:** [Public bio/info]

## Payment Methods
[Extracted from KB articles]

## Cancellation & Rescheduling Policy
[Extracted from KB articles]

## Frequently Asked Questions
- **Q:** [Question]
  **A:** [Answer]

## General Reception Guidelines & AI Rules
[Extracted from clinic_ai_rules]
```

## 3. Strict Exclusion of Live Data & Internal Identifiers
The compiler will explicitly strip or ignore the following:
*   **Live Data Exclusions:** Patient names, phone numbers, patient records, appointment records, doctor leaves, today's availability, future appointment slots, live booking state.
*   **System/Security Exclusions:** Authentication information, API keys, Supabase credentials, internal database UUIDs (e.g., `doctor_id = 9f2...` becomes simply "Dr. Sharma").

## 4. Versioning & State Machine Design
To safely track what knowledge the Sarvam Agent is actually using, we introduce a strict state machine:
*   **DRAFT:** Clinic Admin is editing KB articles.
*   **VALIDATED:** Edits are saved and pass basic schema checks.
*   **COMPILED (READY_FOR_PUBLISH):** A snapshot document has been generated and assigned a new Version (e.g., v15).
*   **PUBLISHED:** Platform Admin confirms the snapshot has been uploaded to Sarvam. (Sarvam is now on v15).
*   **PUBLISH_FAILED:** The upload failed, or the Admin aborted. Sarvam remains on v14.

### The Version Mismatch Scenario
Clinic-1st will actively monitor for version mismatches:
*   `Clinic-1st Compiled Version:` 15
*   `Sarvam Agent Active Version:` 14
*   **UI State:** ⚠ *Update available (Pending Platform Admin Publication)*. The AI is still responding based on Version 14 until explicitly marked as published.

## 5. Schema Audit: Can the existing schema support this?
**Result: NO.** The existing `clinic_knowledge_base` table tracks *individual articles* (e.g., an FAQ entry), not the *compiled release of the entire clinic*.
**Future Migration Required:** We will need a new table (e.g., `clinic_knowledge_releases` or `ai_publish_logs`) to track the compiled snapshots.
*Future Columns:* `id`, `clinic_id`, `version_number`, `snapshot_hash`, `status` (DRAFT, PUBLISHED, etc.), `compiled_at`, `compiled_by`, `published_at`, `published_by`, `sarvam_agent_id`.
*(Note: No migration is being created during this READ-ONLY phase).*

## 6. Multi-Tenant Protection
The compiler enforces multi-tenancy at the query level:
*   Every data extraction query is strictly bounded by `WHERE clinic_id = ?`.
*   The generated file is named with the specific `clinic_id`.
*   The Platform Admin UI will display a stark warning: **"Clinic: ABC Dental | Target Agent: Agent-A"** to prevent uploading Clinic A's snapshot into Clinic B's agent.

## 7. Change Detection (Hash Comparison)
To prevent generating unnecessary versions:
1. When the compiler runs, it hashes the output Markdown string.
2. If the hash matches the `snapshot_hash` of the currently `PUBLISHED` version, the compilation halts.
3. **Outcome:** No new version is created. "Knowledge is up to date."

## 8. AI Response Rules Placement
To reinforce the Static vs. Live boundary, the compiler will append explicit safeguard instructions at the bottom of the KB document (in the `General Reception Guidelines` section):
```text
IMPORTANT RECEPTION RULES:
1. Never invent or guess appointment availability. For availability questions, ALWAYS use the Clinic-1st availability tool.
2. Never claim an appointment has been booked or cancelled unless the respective API tool returns a success confirmation.
3. Never expose internal system identifiers to the patient.
```
*(Note: The core "System Prompt" configured in the Sarvam Console will also enforce these rules at the highest level of precedence).*

## 9. Platform Admin vs Clinic Admin Roles
*   **Clinic Admin:** Creates/edits knowledge, previews changes, clicks "Submit for Publishing". (Does *not* need Sarvam Console access).
*   **Platform Admin:** Reviews the request, downloads the generated snapshot from Clinic-1st, uploads it to the Sarvam Console, and clicks "Mark as Published" in Clinic-1st.

## 10. Future Automation Path
While current limitations require the Platform Admin to manually upload the document, the compiler's design (generating a pristine Markdown file) makes future automation trivial. Once Sarvam releases a public API for KB management, the "Download -> Upload -> Mark Published" step will be replaced by a single automated API call.

---
**Status:** Design Audit Complete. No codebase or database modifications were made.
