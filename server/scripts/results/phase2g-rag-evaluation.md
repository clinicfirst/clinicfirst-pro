# Phase 2G RAG Evaluation Report: V1 vs V2

- **Evaluation Type:** Controlled Reconstructed V1 Baseline vs. Production V2 Candidate
- **Matrix Version:** Phase 2G Ground-Truth Matrix v2
- **Candidate Index ID:** `118ef4f1-c0e9-496e-b369-91bb8882b61f`
- **Candidate Content Hash:** `ddc007a1d0e066411a37f0f99895dae8a0524fad1a3a20dfa99db529187ef622`
- **Candidate Status:** `READY` (is_active = `false`)
- **Total Cases:** 30 (Answerable: 23, Abstention: 7)
- **Executed At:** 2026-09-19T10:56:05.767Z

---

## 1. Aggregate Retrieval Metrics

| Metric | Controlled Reconstructed V1 (Threshold 0.6) | Production V2 Candidate (Threshold 0.7) |
|---|---|---|
| **Recall@3** | 0.4833 | 0.75 |
| **Recall@5** | 0.5333 | 0.75 |
| **Precision@3** | 0.1722 | 0.5722 |
| **MRR** | 0.5067 | 0.7667 |
| **Correct Abstentions** | 0 / 7 | 5 / 7 |
| **False Abstentions** | 7 | 5 |
| **False Retrievals** | 7 | 2 |

---

## 2. Score Separation Analysis

| Metric | Controlled V1 | Production V2 |
|---|---|---|
| **Retrieval Threshold** | 0.6 | 0.7 |
| **Mean Relevant Similarity** | 0.729 | 0.7445 |
| **Median Relevant Similarity** | 0.7207 | 0.7611 |
| **Min Relevant Similarity** | 0.6259 | 0.5775 |
| **Mean Non-Relevant Similarity** | 0.6193 | 0.6023 |
| **Median Non-Relevant Similarity** | 0.616 | 0.5977 |
| **Max Non-Relevant Similarity** | 0.8195 | 0.8212 |

---

## 3. Category Breakdown

| Category | Cases | V1 Recall@5 | V2 Recall@5 | V1 Prec@3 | V2 Prec@3 | V1 MRR | V2 MRR | V1 False Retr | V2 False Retr |
|---|---|---|---|---|---|---|---|---|---|
| Clinic Information | 1 | 0 | 1 | 0 | 0.5 | 0 | 1 | 0 | 0 |
| Operating Hours | 2 | 1 | 1 | 0.3333 | 1 | 1 | 1 | 0 | 0 |
| Services & Pricing | 3 | 0 | 1 | 0 | 0.6111 | 0 | 1 | 0 | 0 |
| Services & Duration | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 0 |
| Doctors | 2 | 1 | 1 | 0.3333 | 0.75 | 1 | 1 | 0 | 0 |
| Arrival & Check-In | 1 | 1 | 1 | 0.3333 | 1 | 1 | 1 | 0 | 0 |
| Registration | 2 | 1 | 1 | 0.3333 | 0.3333 | 1 | 1 | 0 | 0 |
| Cancellation Policy | 1 | 1 | 1 | 0.3333 | 1 | 1 | 1 | 0 | 0 |
| Payment & Billing | 1 | 1 | 1 | 0.3333 | 1 | 1 | 1 | 0 | 0 |
| Specialty Workflow | 2 | 0.5 | 0 | 0 | 0 | 0.1 | 0 | 0 | 0 |
| Escalation | 1 | 1 | 1 | 0.3333 | 0.3333 | 1 | 1 | 0 | 0 |
| Emergency Protocol | 1 | 1 | 1 | 0.3333 | 0.5 | 1 | 1 | 0 | 0 |
| Unknown Information | 1 | 1 | 1 | 0.3333 | 0.3333 | 1 | 1 | 0 | 0 |
| Role & Identity | 1 | 1 | 0.5 | 0.3333 | 0.5 | 1 | 1 | 0 | 0 |
| Live Availability | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 1 | 0 |
| Live Booking | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| Cancellation Action | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 1 | 0 |
| Rescheduling Action | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 1 | 0 |
| Medical Diagnosis | 1 | 1 | 0 | 0.3333 | 0 | 1 | 0 | 0 | 0 |
| Clinical Prescription | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Unknown Service | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 1 | 0 |
| Unknown Specialty | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 1 | 0 |
| Sensitive Information | 1 | 1 | 0 | 0.5 | 0 | 1 | 0 | 0 | 0 |
| Tenant Isolation | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |

---

## 4. Security & Safety Dimension Summary

- **Candidate Corpus Foreign Tenants:** 0
- **Cross-Tenant Leakage:** 0
- **Sensitive Key Disclosures:** None (Refusal policy enforced)
- **Tool Boundary Integrity:** Live tool cases (BQ-01 to BQ-04) strictly isolated from static RAG assertions.
- **Safety Policy Retrieval:** BQ-05 (Emergency Triage), BQ-06 (Medical Safety), and BQ-09 (Tenant Isolation & Privacy) measured as policy retrieval cases.

---

## 5. Artifact Paths

- **Machine-readable JSON:** `C:\Git_repo_Clinic_First\clinicfirst-pro\server\scripts\results\phase2g-rag-evaluation.json`
- **Human-readable Report:** `C:\Git_repo_Clinic_First\clinicfirst-pro\server\scripts\results\phase2g-rag-evaluation.md`
