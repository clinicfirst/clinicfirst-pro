export interface EvalChunk {
  id: string;
  clinic_id: string;
  release_status: string;
  chunk_text: string;
  embedding?: number[];
}

export const EVAL_CHUNKS: EvalChunk[] = [
  // FAQ
  { id: "KB-FAQ-1", clinic_id: "clinic_A", release_status: "PUBLISHED", chunk_text: "Q: Do I need an appointment?\nA: Yes, we require appointments for all visits." },
  { id: "KB-FAQ-2", clinic_id: "clinic_A", release_status: "PUBLISHED", chunk_text: "Q: What is the cancellation policy?\nA: We require 24 hours notice for any cancellations or a $50 fee applies." },
  { id: "KB-FAQ-3", clinic_id: "clinic_A", release_status: "PUBLISHED", chunk_text: "Q: Do you take walk-ins?\nA: No, all visits require a pre-booked appointment." },
  { id: "KB-FAQ-4", clinic_id: "clinic_A", release_status: "PUBLISHED", chunk_text: "Q: Is parking available?\nA: Free parking is available in the garage behind the clinic." },
  
  // POLICY
  { id: "KB-POL-1", clinic_id: "clinic_A", release_status: "PUBLISHED", chunk_text: "Clinic Policy on Medical Records: Patients must submit a written request to obtain a copy of their medical records. Processing takes up to 7 business days." },
  { id: "KB-POL-2", clinic_id: "clinic_A", release_status: "PUBLISHED", chunk_text: "Prescription Refills: Refill requests must be submitted through the patient portal. Please allow 48 hours for processing." },
  { id: "KB-POL-3", clinic_id: "clinic_A", release_status: "PUBLISHED", chunk_text: "Chaperone Policy: Patients may request a chaperone during any examination or procedure." },
  
  // SERVICES
  { id: "KB-SVC-1", clinic_id: "clinic_A", release_status: "PUBLISHED", chunk_text: "Our services include General Checkups, Dental Cleaning, and Pediatric Care." },
  { id: "KB-SVC-2", clinic_id: "clinic_A", release_status: "PUBLISHED", chunk_text: "We offer on-site X-Ray and ultrasound imaging for immediate diagnostics." },
  { id: "KB-SVC-3", clinic_id: "clinic_A", release_status: "PUBLISHED", chunk_text: "Physical Therapy: Specialized therapy sessions are available for post-operative recovery and sports injuries." },
  
  // DOCTORS
  { id: "KB-DOC-1", clinic_id: "clinic_A", release_status: "PUBLISHED", chunk_text: "Dr. Smith specializes in Cardiology and has over 20 years of experience. He is available on Mondays and Wednesdays." },
  { id: "KB-DOC-2", clinic_id: "clinic_A", release_status: "PUBLISHED", chunk_text: "Dr. Adams is our lead Pediatrician. She sees patients Tuesday through Friday." },
  { id: "KB-DOC-3", clinic_id: "clinic_A", release_status: "PUBLISHED", chunk_text: "Dr. Lee is an orthopedic surgeon who focuses on joint replacement." },
  
  // TIMINGS/ARRIVAL
  { id: "KB-ARR-1", clinic_id: "clinic_A", release_status: "PUBLISHED", chunk_text: "Arrival Instructions: Please arrive 15 minutes before your scheduled appointment time to complete necessary paperwork." },
  { id: "KB-ARR-2", clinic_id: "clinic_A", release_status: "PUBLISHED", chunk_text: "Clinic Hours: We are open Monday to Friday from 8:00 AM to 5:00 PM." },
  { id: "KB-ARR-3", clinic_id: "clinic_A", release_status: "PUBLISHED", chunk_text: "Late Arrival: If you are more than 15 minutes late, your appointment will need to be rescheduled." },
  
  // REGISTRATION/PAYMENT
  { id: "KB-REG-1", clinic_id: "clinic_A", release_status: "PUBLISHED", chunk_text: "Registration requires a valid photo ID and your current insurance card." },
  { id: "KB-PAY-1", clinic_id: "clinic_A", release_status: "PUBLISHED", chunk_text: "Payment is due at the time of service. We accept cash, credit cards, and major insurance plans." },
  { id: "KB-PAY-2", clinic_id: "clinic_A", release_status: "PUBLISHED", chunk_text: "Payment Plans: We offer flexible payment plans for balances over $500. Speak with our billing department to set one up." },
  
  // DRAFT
  { id: "KB-DRAFT-1", clinic_id: "clinic_A", release_status: "DRAFT", chunk_text: "DRAFT: Starting next month, all fees will increase by 15%." },
  
  // CLINIC B (Cross-Tenant)
  { id: "KB-CB-1", clinic_id: "clinic_B", release_status: "PUBLISHED", chunk_text: "Clinic B Cancellation Policy: We require 48 hours notice for any cancellations. No fees apply." },
  { id: "KB-CB-2", clinic_id: "clinic_B", release_status: "PUBLISHED", chunk_text: "Clinic B Parking: Parking costs $5 per hour in the adjacent lot." }
];

export const EVAL_CASES = [
  // FAQ (4)
  { id: "TC-01", category: "FAQ", q: "Do I need to book an appointment first?", expected: ["KB-FAQ-1", "KB-FAQ-3"] },
  { id: "TC-02", category: "FAQ", q: "How much notice do I need to give to cancel?", expected: ["KB-FAQ-2"] },
  { id: "TC-03", category: "FAQ", q: "Can I just walk in?", expected: ["KB-FAQ-3", "KB-FAQ-1"] },
  { id: "TC-04", category: "FAQ", q: "Where can I park?", expected: ["KB-FAQ-4"] },
  
  // POLICY (3)
  { id: "TC-05", category: "POLICY", q: "How do I get my medical records?", expected: ["KB-POL-1"] },
  { id: "TC-06", category: "POLICY", q: "How do I refill a prescription?", expected: ["KB-POL-2"] },
  { id: "TC-07", category: "POLICY", q: "Can I have someone with me during the exam?", expected: ["KB-POL-3"] },
  
  // SERVICES (3)
  { id: "TC-08", category: "SERVICES", q: "Do you offer teeth cleaning?", expected: ["KB-SVC-1"] },
  { id: "TC-09", category: "SERVICES", q: "Can I get an X-Ray there?", expected: ["KB-SVC-2"] },
  { id: "TC-10", category: "SERVICES", q: "Do you have physical therapy?", expected: ["KB-SVC-3"] },
  
  // DOCTORS (3)
  { id: "TC-11", category: "DOCTORS", q: "What days is the cardiologist in?", expected: ["KB-DOC-1"] },
  { id: "TC-12", category: "DOCTORS", q: "Who is the pediatrician?", expected: ["KB-DOC-2"] },
  { id: "TC-13", category: "DOCTORS", q: "Does Dr. Lee do joint replacements?", expected: ["KB-DOC-3"] },
  
  // TIMINGS/ARRIVAL (3)
  { id: "TC-14", category: "TIMINGS/ARRIVAL", q: "When should I arrive for my appointment?", expected: ["KB-ARR-1"] },
  { id: "TC-15", category: "TIMINGS/ARRIVAL", q: "What are your clinic hours?", expected: ["KB-ARR-2"] },
  { id: "TC-16", category: "TIMINGS/ARRIVAL", q: "What happens if I'm late?", expected: ["KB-ARR-3"] },
  
  // REGISTRATION/PAYMENT (3)
  { id: "TC-17", category: "REGISTRATION/PAYMENT", q: "What documents do I need to bring to my first visit?", expected: ["KB-REG-1"] },
  { id: "TC-18", category: "REGISTRATION/PAYMENT", q: "Can I pay with a credit card?", expected: ["KB-PAY-1"] },
  { id: "TC-19", category: "REGISTRATION/PAYMENT", q: "Do you have payment plans?", expected: ["KB-PAY-2"] },
  
  // UNKNOWN (3)
  { id: "TC-20", category: "UNKNOWN", q: "Does the clinic provide helicopter transportation?", expected: [] },
  { id: "TC-21", category: "UNKNOWN", q: "Do you serve pizza in the waiting room?", expected: [] },
  { id: "TC-22", category: "UNKNOWN", q: "How many planets are in the solar system?", expected: [] },
  
  // LIVE_DATA (3) - Should not match static KB
  { id: "TC-23", category: "LIVE_DATA", q: "Do you have an appointment tomorrow at 4 PM?", expected: [] },
  { id: "TC-24", category: "LIVE_DATA", q: "I need to cancel my appointment next Tuesday.", expected: [] },
  { id: "TC-25", category: "LIVE_DATA", q: "Reschedule my visit with Dr. Smith to Friday.", expected: [] },
  
  // CROSS_TENANT (2)
  { id: "TC-26", category: "CROSS_TENANT", q: "What is Clinic B's cancellation policy?", expected: [], target_clinic: "clinic_A" }, 
  { id: "TC-27", category: "CROSS_TENANT", q: "How much is parking at Clinic B?", expected: [], target_clinic: "clinic_A" },
];
