# PHASE 18: Manual Browser & Real Audio Acceptance Protocol

## Executive Summary & Status Classification
- **Phase Status**: **RED (MANUAL ACCEPTANCE PENDING)**
- **Classification**: **ENVIRONMENT LIMITATION — NOT AN APPLICATION DEFECT**
- **Root Context**: The AI Studio execution environment is a headless Linux container lacking:
  1. A graphical display engine (X11 / Wayland).
  2. Browser binary installations (Chromium, Firefox, WebKit).
  3. Physical audio hardware / soundcard / virtual ALSA microphone devices.

### Verification Boundary:
- **AUTOMATED VERIFIED**:
  - Backend/API routes (`/api/health`, `/api/ai/call/*`)
  - PostgreSQL persistence and RLS tenant boundaries
  - Tenant isolation and session memory encapsulation
  - Security (no API key or secret leakage to client)
  - Tool routing and bounded timeouts (< 4500ms model, < 4000ms tool)
  - Concurrency controls and double-booking exclusion locks
- **MANUAL REQUIRED (HUMAN TESTER)**:
  - Real desktop graphical browser (Chrome / Safari / Firefox)
  - Real microphone hardware & permission prompt approval
  - Spoken voice input from user
  - Spoken AI voice response audio playback
  - Real-time spoken conversational dialogue

---

## Controlled Test Data Specification

### 1. Authoritative Doctors
Use only verified, database-configured doctors for Sanjeevani Multispeciality Clinic:
- **Primary Test Doctor**: **Dr. Raj Patel** (General Medicine / Cardiology)
- **Alternate Test Doctor**: **Dr. Meera Joshi** (Family Medicine / Pediatrics)
*(Do NOT use placeholder names like Dr. Vance or invent doctors not present in the database).*

### 2. Synthetic Patient Profile
To prevent exposure of personal health information (PHI), testers MUST use only this clearly synthetic test profile:
- **Patient Full Name**: `Alex Test Patient`
- **Patient Phone Number**: `555-019-2834`
*(If this synthetic patient record already exists in the database, the AI will identify them as a returning patient. If not, it will register them as a new synthetic patient).*

### 3. Dynamic Date & Live Slot Requirement
- Do **NOT** hardcode a static or past date.
- The tester must request a **currently valid future date** (e.g. today or the next business day during clinic hours).
- The tester must select a slot from the **live availability** returned by the AI (never assume a specific slot exists without verification).

---

## Pre-Requisites for Human Verifiers
1. Authentic modern desktop browser:
   - Google Chrome / Chromium (version 120+)
   - Apple Safari (macOS Sonoma+ / iOS 17+)
   - Mozilla Firefox (version 120+)
2. Working physical microphone and speaker/headset.
3. Network access to the live deployment: `https://clinicfirst.vercel.app` (or local port 3000 server).

---

## Acceptance Test Protocol

### Step 1: Authentication & Navigation
- [ ] Navigate to `/login`.
- [ ] Sign in with clinic credentials (e.g., `admin@sanjeevaniclinic.com` or `admin@apexclinic.com`).
- [ ] Confirm successful redirection to the Clinic Dashboard without errors.
- [ ] Navigate to **AI Receptionist** (`/ai-receptionist`).

### Step 2: Widget & Simulator Launch
- [ ] Verify the AI Receptionist status indicator displays **ACTIVE** and shows configured provider and agent details.
- [ ] Click **Launch Phone Simulator** / **Test Call**.
- [ ] Confirm the simulator UI opens, displaying:
  - Caller status (Inbound Call).
  - Clinic branding.
  - Active transcript area.
  - Microphone button and keypad/text input fallback.
- [ ] **Greeting Verification**: Verify initial greeting is spoken or displayed within 2 seconds:
  - *Expected*: "Hello, thank you for calling Sanjeevani Multispeciality Clinic. I am the AI receptionist. How may I assist you today?"

### Step 3: Browser Microphone Permission Gate
- [ ] Click the **Microphone** icon.
- [ ] Verify browser prompts for microphone permission: `clinicfirst.vercel.app wants to use your microphone`.
- [ ] Click **Allow**.
- [ ] Verify microphone state toggles to active recording with visual pulse/audio wave indicator.

### Step 4: Spoken User Input & Spoken AI Response
- [ ] Speak clearly into microphone: *"What are your clinic hours?"*
- [ ] Verify spoken user input is captured accurately into the transcript as `Patient: What are your clinic hours?`.
- [ ] Confirm AI receptionist responds with authoritative clinic hours and audio plays through speakers:
  - *Expected*: "Sanjeevani Multispeciality Clinic is open Monday through Friday from 8:30 AM to 5:30 PM..."

### Step 5: Clinic Doctors & Services Inquiries
- [ ] Speak: *"Which doctors and services do you offer?"*
- [ ] Verify AI receptionist executes `getClinicDoctors` and `getClinicServices`.
- [ ] Verify response accurately mentions **Dr. Raj Patel** and **Dr. Meera Joshi** along with configured services.

### Step 6: Live Availability & Patient Identification
- [ ] Speak: *"Can I check appointment availability with Dr. Raj Patel for tomorrow?"*
- [ ] Verify the AI executes `getAvailableSlots` with dynamic live date parameters.
- [ ] Confirm response lists actual real openings configured in PostgreSQL.
- [ ] Provide synthetic patient details when prompted:
  - *"My name is Alex Test Patient and my phone number is 555-019-2834."*
- [ ] Verify AI executes `getPatientByPhone` and identifies returning or new patient status.

### Step 7: Appointment Booking & Confirmation
- [ ] Select one of the offered live slots (e.g. 10:00 AM) and speak:
  - *"Please book the 10:00 AM slot."*
- [ ] Verify AI confirms: Doctor (**Dr. Raj Patel**), Service, Date, Time, and Patient Name.
- [ ] Verify `createAppointment` executes and returns confirmation ID.
- [ ] Navigate to **Appointments** tab and verify the newly booked appointment is persisted in PostgreSQL.

### Step 8: Call Completion & Persistence
- [ ] Click **End Call** in the simulator.
- [ ] Navigate to **Calls** (`/calls`).
- [ ] Verify the completed call record is listed with:
  - Accurate start time, duration, and status (`completed` or `appointment_booked`).
  - Full transcript preserved.
  - Associated patient and appointment links populated.

### Step 9: Edge Workflows (Where Applicable)
- [ ] **Rescheduling**: Test asking the AI to move an existing appointment to another live slot.
- [ ] **Cancellation**: Test asking the AI to cancel the synthetic test appointment.
- [ ] **Escalation**: Speak *"I have a medical emergency and need to speak with a human nurse immediately."*
  - Verify AI executes `escalateToStaff`, sets outcome to `ESCALATED`, and provides the clinic triage phone number.

---

## Fallback UX (Microphone Denied / Audio Unavailable)
If the human tester denies microphone permission or tests in an environment without audio output:
- The phone simulator provides a persistent text input box and send button at the bottom of the interface.
- Testers can type exact conversational turns into the input box.
- All backend tools, slot calculations, patient lookups, and booking confirmations execute identically.
- The UI displays explicit diagnostic badges when microphone access is blocked by the browser.

