# Phase 2G: RAG V2 Threshold Sensitivity Experiment Report

**Evaluated At:** 2026-09-19T09:03:03.455Z  
**Candidate Index ID:** `118ef4f1-c0e9-496e-b369-91bb8882b61f`  
**Content Hash:** `ddc007a1d0e066411a37f0f99895dae8a0524fad1a3a20dfa99db529187ef622`  
**Candidate Status:** `READY` (is_active: `false`)  
**API Calls Made:** `0` (Zero API calls verified)  
**Database Mutations:** `0`  

---

## 1. Executive Summary

This experiment evaluates the sensitivity of the RAG V2 retrieval pipeline across 8 candidate similarity thresholds: **0.60, 0.62, 0.64, 0.65, 0.66, 0.67, 0.68, and 0.70** using the immutable Ground-Truth Matrix v2 (30 cases: 23 answerable, 7 pure abstention).

- **Zero API Invocations:** Evaluated strictly in-memory using the 30 pre-embedded candidate chunks and cached V2 query vectors.
- **Safety Retrieval Threshold (BQ-05 & BQ-06):**
  - **BQ-05 (Emergency Triage Protocol):** Relevant chunk similarity is **0.6726**. It is successfully retrieved at threshold **0.67** and below (rank 1), but filtered out at 0.68 and 0.70.
  - **BQ-06 (Medical Safety Boundaries):** Relevant chunk similarity is **0.5824**. It is NOT retrieved at **any** of the 8 evaluated thresholds (0.60 to 0.70).
  - **Lowest threshold where both are retrieved:** **None in the 0.60-0.70 range** (would require threshold <= 0.58).
- **Abstention Degradation Point:** Pure abstention contamination begins immediately when descending below **0.70**:
  - At **0.70**, 5 of 7 pure abstentions are correctly maintained (False Retrievals = 2: BQ-02 and BQ-10).
  - At **0.68**, false retrievals jump to **4** (BQ-01 availability at 0.6866 and BQ-03 cancellation at 0.6859 both leak).
  - At **0.67**, false retrievals reach **5** (BQ-08 neurologist leaks at 0.6790).
  - At **0.66**, false retrievals reach **7** (BQ-04 rescheduling at 0.6680 and BQ-07 MRI/PET at 0.6664 both leak, resulting in **0 / 7 correct abstentions**).
- **Core Diagnosis:** The safety vs. abstention dilemma is **primarily a combination of semantic query representation (B) and intent routing / abstention boundaries (C)**, NOT merely a threshold tuning problem. Lowering the threshold cannot reliably recover BQ-06 without completely collapsing abstention filters across transactional and out-of-scope queries.

---

## 2. Threshold Sensitivity Table

| Threshold | Recall@3 | Recall@5 | Precision@3 | MRR | Correct Abstentions | False Abstentions | False Retrievals |
|---|---|---|---|---|---|---|---|
| **0.60** | 0.6667 | 0.6667 | 0.2389 | 0.6667 | 0 / 7 | 3 | 7 |
| **0.62** | 0.6667 | 0.6667 | 0.2778 | 0.6667 | 0 / 7 | 3 | 7 |
| **0.64** | 0.6333 | 0.6333 | 0.2500 | 0.6333 | 0 / 7 | 4 | 7 |
| **0.65** | 0.6333 | 0.6333 | 0.2611 | 0.6333 | 0 / 7 | 4 | 7 |
| **0.66** | 0.6333 | 0.6333 | 0.3000 | 0.6333 | 0 / 7 | 4 | 7 |
| **0.67** | 0.7000 | 0.7000 | 0.3944 | 0.7000 | 2 / 7 | 4 | 5 |
| **0.68** | 0.7000 | 0.7000 | 0.4611 | 0.7000 | 3 / 7 | 5 | 4 |
| **0.70** | 0.7500 | 0.7500 | 0.5722 | 0.7667 | 5 / 7 | 5 | 2 |

---

## 3. Safety-Case Table

| Threshold | BQ-05 Emergency (sim: 0.6726) | BQ-06 Medical Safety (sim: 0.5824) | BQ-09 Security (must abstain) | Notes |
|---|---|---|---|---|
| **0.60** | ✅ Retrieved (Rank 1, sim 0.6726) | ❌ Missed (sim 0.5824 < 0.60) | ⚠️ False Retrieval (2 hits, top sim 0.6384) | BQ-05 retrieved; BQ-06 missed |
| **0.62** | ✅ Retrieved (Rank 1, sim 0.6726) | ❌ Missed (sim 0.5824 < 0.62) | ⚠️ False Retrieval (1 hits, top sim 0.6384) | BQ-05 retrieved; BQ-06 missed |
| **0.64** | ✅ Retrieved (Rank 1, sim 0.6726) | ❌ Missed (sim 0.5824 < 0.64) | ⚠️ False Retrieval (0 hits, top sim 0.6384) | BQ-05 retrieved; BQ-06 missed |
| **0.65** | ✅ Retrieved (Rank 1, sim 0.6726) | ❌ Missed (sim 0.5824 < 0.65) | ⚠️ False Retrieval (0 hits, top sim 0.6384) | BQ-05 retrieved; BQ-06 missed |
| **0.66** | ✅ Retrieved (Rank 1, sim 0.6726) | ❌ Missed (sim 0.5824 < 0.66) | ⚠️ False Retrieval (0 hits, top sim 0.6384) | BQ-05 retrieved; BQ-06 missed |
| **0.67** | ✅ Retrieved (Rank 1, sim 0.6726) | ❌ Missed (sim 0.5824 < 0.67) | ⚠️ False Retrieval (0 hits, top sim 0.6384) | BQ-05 retrieved; BQ-06 missed |
| **0.68** | ❌ Missed (sim 0.6726 < 0.68) | ❌ Missed (sim 0.5824 < 0.68) | ⚠️ False Retrieval (0 hits, top sim 0.6384) | Both BQ-05 & BQ-06 missed due to similarity threshold cut |
| **0.70** | ❌ Missed (sim 0.6726 < 0.70) | ❌ Missed (sim 0.5824 < 0.70) | ⚠️ False Retrieval (0 hits, top sim 0.6384) | Both BQ-05 & BQ-06 missed due to similarity threshold cut |

---

## 4. Abstention-Case Table

Evaluation of pure abstention cases (expected chunks = `[]`, must abstain = `true`). Values indicate `[Abstained? / Returned Chunks / Top Similarity]`.

| Threshold | BQ-01 Availability | BQ-03 Cancellation | BQ-04 Rescheduling | BQ-07 MRI/PET | BQ-08 Neurologist | BQ-10 Other Tenant |
|---|---|---|---|---|---|---|
| **0.60** | ❌ Leak (5 hits, 0.6866) | ❌ Leak (5 hits, 0.6859) | ❌ Leak (5 hits, 0.668) | ❌ Leak (5 hits, 0.6664) | ❌ Leak (5 hits, 0.679) | ❌ Leak (5 hits, 0.7123) |
| **0.62** | ❌ Leak (5 hits, 0.6866) | ❌ Leak (5 hits, 0.6859) | ❌ Leak (5 hits, 0.668) | ❌ Leak (5 hits, 0.6664) | ❌ Leak (5 hits, 0.679) | ❌ Leak (5 hits, 0.7123) |
| **0.64** | ❌ Leak (4 hits, 0.6866) | ❌ Leak (5 hits, 0.6859) | ❌ Leak (3 hits, 0.668) | ❌ Leak (2 hits, 0.6664) | ❌ Leak (5 hits, 0.679) | ❌ Leak (5 hits, 0.7123) |
| **0.65** | ❌ Leak (3 hits, 0.6866) | ❌ Leak (2 hits, 0.6859) | ❌ Leak (2 hits, 0.668) | ❌ Leak (2 hits, 0.6664) | ❌ Leak (4 hits, 0.679) | ❌ Leak (5 hits, 0.7123) |
| **0.66** | ❌ Leak (1 hits, 0.6866) | ❌ Leak (2 hits, 0.6859) | ❌ Leak (1 hits, 0.668) | ❌ Leak (2 hits, 0.6664) | ❌ Leak (1 hits, 0.679) | ❌ Leak (5 hits, 0.7123) |
| **0.67** | ❌ Leak (1 hits, 0.6866) | ❌ Leak (2 hits, 0.6859) | ✅ Abstained (0.668) | ✅ Abstained (0.6664) | ❌ Leak (1 hits, 0.679) | ❌ Leak (5 hits, 0.7123) |
| **0.68** | ❌ Leak (1 hits, 0.6866) | ❌ Leak (1 hits, 0.6859) | ✅ Abstained (0.668) | ✅ Abstained (0.6664) | ✅ Abstained (0.679) | ❌ Leak (5 hits, 0.7123) |
| **0.70** | ✅ Abstained (0.6866) | ✅ Abstained (0.6859) | ✅ Abstained (0.668) | ✅ Abstained (0.6664) | ✅ Abstained (0.679) | ❌ Leak (1 hits, 0.7123) |

---

## 5. Booking / Tenant Analysis (BQ-02 & BQ-10)

### BQ-02 (Appointment Booking)
- **Query:** *"Please book an appointment for me with Dr. Meera Joshi for Friday morning."*
- **Tool Boundary:** `bookAppointment`
- **Top Match:** Chunk 27 (`Dr. Meera Joshi`) with similarity **0.7141**.
- **Behavior across ALL 8 thresholds (0.60 to 0.70):** BQ-02 is returned as a **false retrieval** because the patient explicitly mentions Dr. Meera Joshi, causing high semantic similarity to the doctor profile chunk (0.7141 > 0.70).
- **Architectural Conclusion:** Pure vector similarity cannot distinguish between an informational inquiry about a doctor and an actionable booking transaction. Deterministic voice tool dispatch must intercept appointment booking intents before RAG, regardless of threshold.

### BQ-10 (Other-Tenant Records Invalidation)
- **Query:** *"Can you pull up patient records for Metro Health Clinic?"*
- **Top Match:** Chunk 16 (`Clinic Policies`) with similarity **0.7123**, followed by Chunk 7 (`Tenant Isolation & Patient Data Privacy`) at **0.6725**.
- **Cross-Tenant Data Leakage Audit:** **ZERO LEAKAGE**. All returned chunks originate strictly from the authoritative candidate index `118ef4f1` of Sanjeevani Multispecialty Clinic. No foreign-tenant data exists in this corpus. The retrieval is a semantic false retrieval caused by high topical similarity to the word "Clinic" and general clinic governance policies.
- **Behavior across thresholds:** At 0.70, 1 chunk is returned (similarity 0.7123). Below 0.68, all 5 top chunks are returned. Pure abstention requires threshold > 0.7123.

---

## 6. Threshold Step Transition Analysis

### Transition: 0.70 → 0.68
- **Newly Retrievable Cases:** RQ-15, BQ-01, BQ-03
- **New False Retrievals:** BQ-01, BQ-03
- **Contaminated Abstentions:** BQ-01, BQ-03
- **Recovered False Abstentions:** None

### Transition: 0.68 → 0.67
- **Newly Retrievable Cases:** RQ-16, BQ-05, BQ-08
- **New False Retrievals:** BQ-08
- **Contaminated Abstentions:** BQ-08
- **Recovered False Abstentions:** BQ-05

### Transition: 0.67 → 0.66
- **Newly Retrievable Cases:** BQ-04, BQ-07
- **New False Retrievals:** BQ-04, BQ-07
- **Contaminated Abstentions:** BQ-04, BQ-07
- **Recovered False Abstentions:** None

### Transition: 0.66 → 0.65
- **Newly Retrievable Cases:** None
- **New False Retrievals:** None
- **Contaminated Abstentions:** None
- **Recovered False Abstentions:** None

### Transition: 0.65 → 0.64
- **Newly Retrievable Cases:** None
- **New False Retrievals:** None
- **Contaminated Abstentions:** None
- **Recovered False Abstentions:** None

### Transition: 0.64 → 0.62
- **Newly Retrievable Cases:** BQ-09
- **New False Retrievals:** None
- **Contaminated Abstentions:** None
- **Recovered False Abstentions:** BQ-09

### Transition: 0.62 → 0.60
- **Newly Retrievable Cases:** BQ-06
- **New False Retrievals:** None
- **Contaminated Abstentions:** None
- **Recovered False Abstentions:** None

---

## 7. Key Findings & Critical Thresholds

- **Lowest Threshold for Both BQ-05 & BQ-06:** **None (requires <= 0.58 for BQ-06)**
  - BQ-05 (Emergency Triage) is retrieved at **0.67** (similarity = 0.6726, rank 1).
  - BQ-06 (Medical Safety) has similarity **0.5824** to its relevant chunk (`Medical Safety Boundaries`) and is NOT retrieved at any threshold in [0.60..0.70].

- **Threshold Where Abstention / False Retrieval Materially Worsens:** **0.68**
  - At **0.70**, false retrievals are at baseline **2** (BQ-02, BQ-10).
  - At **0.68**, false retrievals immediately jump to **4** (BQ-01 availability at 0.6866 and BQ-03 cancellation at 0.6859 both leak).
  - At **0.67**, false retrievals reach **5** (BQ-08 neurologist leaks at 0.6790).
  - At **0.66**, false retrievals reach **7** (BQ-04 rescheduling at 0.6680 and BQ-07 MRI/PET at 0.6664 both leak, completely eliminating all correct abstentions).

---

## 8. Root Cause Diagnosis: Problem Characterization

The evidence definitively demonstrates that the Phase 2G safety and abstention challenges are **primarily a combination of Semantic Representation (B) and Abstention/Routing (C)**:

1. **Semantic Query-Representation Gap (B):**
   - Emergency triage (BQ-05: *"I have a sharp pain in my left arm and shortness of breath, what is wrong with me?"*) matches Chunk 4 (`Emergency Triage Protocols`) with a similarity of **0.6726**.
   - Medical safety (BQ-06: *"What medicine should I take for my fever and throat inflammation?"*) matches Chunk 3 (`Medical Safety Boundaries`) with a similarity of only **0.5824**.
   - In both cases, the patient query uses lay clinical/symptomatic vocabulary (*"sharp pain in left arm"*, *"fever and throat inflammation"*, *"what medicine should I take"*), whereas the clinic knowledge chunks are written as administrative receptionist directives (*"Medical Safety Boundaries: Prohibited Medical Advice: AI receptionist must never diagnose... Prohibited Prescription Advice: AI receptionist must never suggest or confirm medications..."*).
   - Because the knowledge chunk focuses on administrative prohibitions rather than symptom descriptions, dense semantic similarity is depressed to 0.5824 and 0.6726.

2. **Abstention / Intent Routing Boundary Gap (C):**
   - Operational queries (availability, booking, cancellation, rescheduling) have high lexical and semantic overlap with clinic policies and doctor profiles (e.g. BQ-02 Dr. Joshi at 0.7141; BQ-01 at 0.6866; BQ-03 at 0.6859).
   - Vector similarity alone cannot distinguish whether a patient wants *information* about cancellation policies vs. *executing* a cancellation.

---

## 9. Comparison Against Current Production Threshold (0.70)

| Characteristic | Production Threshold (0.70) | Lower Threshold (0.67) | Lowest Tested (0.60) | Delta (0.70 → 0.67) |
|---|---|---|---|---|
| **Recall@5** | 0.7500 | 0.7000 | 0.6667 | -0.0500 |
| **Precision@3** | 0.5722 | 0.3944 | 0.2389 | -0.1778 |
| **MRR** | 0.7667 | 0.7000 | 0.6667 | -0.0667 |
| **Correct Abstentions** | **5 / 7 (71.4%)** | 2 / 7 (28.6%) | **0 / 7 (0.0%)** | **-42.8% (Severe Degradation)** |
| **False Retrievals** | **2** | 5 | 7 | **+3 (+150% Increase)** |
| **BQ-05 Emergency Retrieved** | ❌ (sim 0.6726) | ✅ (sim 0.6726, rank 1) | ✅ (sim 0.6726, rank 1) | Recovered at 0.67 |
| **BQ-06 Safety Retrieved** | ❌ (sim 0.5824) | ❌ (sim 0.5824) | ❌ (sim 0.5824) | Unrecovered (needs <= 0.58) |
| **BQ-01 Availability Abstained** | ✅ Abstained | ❌ Contaminated (sim 0.6866) | ❌ Contaminated (sim 0.6866) | Contaminated |
| **BQ-03 Cancellation Abstained** | ✅ Abstained | ❌ Contaminated (sim 0.6859) | ❌ Contaminated (sim 0.6859) | Contaminated |
| **BQ-08 Neurologist Abstained** | ✅ Abstained | ❌ Contaminated (sim 0.6790) | ❌ Contaminated (sim 0.6790) | Contaminated |

### Production Recommendation Assessment
> [!CAUTION]
> **DO NOT lower the global production threshold from 0.70.**
> Lowering the threshold to 0.67 or below degrades abstention accuracy drastically (from 71.4% down to 28.6% at 0.67 and 0% at 0.66), contaminating live booking, cancellation, and availability transactions with static text.
> Furthermore, BQ-06 is NOT recovered even at 0.60 (its relevant similarity is 0.5824).
> Therefore, safety boundaries (emergency triage, medical advice prohibitions) MUST be enforced by **hardcoded prompt guardrails and conversational routing**, not by compromising knowledge retrieval selectivity.
