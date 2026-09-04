/**
 * AI Receptionist Instruction & Greeting Source-of-Truth Validator
 * 
 * Enforces defense-in-depth prevention of hardcoded clinic facts (doctors, services, 
 * pricing, hours, addresses, contact info, patient records, internal IDs, secrets)
 * from entering Receptionist Preferences & Instructions and AI Greeting fields.
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  matchedKeywords?: string[];
}

export const DEFAULT_GREETING_TEMPLATE =
  "Hello, thank you for calling {{clinic_name}}. I'm {{receptionist_name}}, the AI receptionist. How may I help you today?";

export const GREETING_STYLES: Record<string, { label: string; template: string }> = {
  professional: {
    label: 'Professional',
    template: 'Hello, thank you for calling {{clinic_name}}. I am {{receptionist_name}}, the AI receptionist. How may I assist you today?',
  },
  warm: {
    label: 'Warm & Friendly',
    template: "Hello, thank you for calling {{clinic_name}}! I'm {{receptionist_name}}, your AI receptionist. How can I help you today?",
  },
  concise: {
    label: 'Concise',
    template: 'Thank you for calling {{clinic_name}}. I am {{receptionist_name}}. How may I direct your call or assist you today?',
  },
  formal: {
    label: 'Formal',
    template: 'Good day and thank you for contacting {{clinic_name}}. I am {{receptionist_name}}, the automated reception assistant. How may I assist you today?',
  },
};

/**
 * Generate a safe greeting from an authoritative clinic name and style/template.
 */
export function generateSafeGreeting(
  clinicName: string,
  templateOrStyle?: string,
  receptionistName?: string
): string {
  const safeClinicName = clinicName?.trim() || 'our clinic';
  const trimmedName = receptionistName?.trim();
  const hasSpecificName = Boolean(trimmedName && trimmedName.toLowerCase() !== 'ai receptionist');

  let tpl = DEFAULT_GREETING_TEMPLATE;

  if (templateOrStyle) {
    const key = templateOrStyle.toLowerCase().trim();
    if (GREETING_STYLES[key]) {
      tpl = GREETING_STYLES[key].template;
    } else {
      tpl = templateOrStyle;
    }
  }

  let resolved = tpl.replace(/\{\{clinic_name\}\}/g, safeClinicName);

  if (hasSpecificName && trimmedName) {
    resolved = resolved.replace(/\{\{receptionist_name\}\}/g, trimmedName);
  } else {
    resolved = resolved
      .replace(/I'm \{\{receptionist_name\}\},\s*/gi, "I'm ")
      .replace(/I am \{\{receptionist_name\}\},\s*/gi, "I am ")
      .replace(/I am \{\{receptionist_name\}\}\.\s*/gi, "")
      .replace(/I'm \{\{receptionist_name\}\}\.\s*/gi, "")
      .replace(/\{\{receptionist_name\}\}/g, 'your AI receptionist');
  }

  return resolved.replace(/\s+/g, ' ').trim();
}

/**
 * Factual Content Validator for Receptionist Preferences & Instructions.
 * Rejects clinic-specific factual content (doctors, services, prices, hours, addresses, etc.)
 */
export function validateReceptionistPreferences(text?: string | null): ValidationResult {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return { isValid: true };
  }

  const trimmed = text.trim();

  // 1. Doctor / Title prefixes & Doctor designations
  // e.g., "Dr.", "Dr ", "Doctor "
  const doctorPatterns = [
    /\b(dr|doctor)\.?\s+[a-zA-Z]+/i,
    /\b(dr|doctor)\b/i,
  ];

  // 2. Medical qualifications & Clinical credentials
  const credentialPatterns = [
    /\b(mbbs|bds|md|ms|dm|mch|dnb|frcs|mrcp|bams|bhms)\b/i,
  ];

  // 3. Doctor specialties & Medical designations
  const specialtyPatterns = [
    /\b(pediatrician|pediatrics|cardiologist|cardiology|general\s+physician|physician|surgeon|surgery|orthopedic|orthopedist|dermatologist|dermatology|gynecologist|gynecology|obstetrician|neurologist|neurology|psychiatrist|psychiatry|dentist|dentistry|oncologist|oncology|ent\s+specialist|urologist|urology)\b/i,
  ];

  // 4. Clinical services, tests, labs & procedures
  const servicePatterns = [
    /\b(consultation|checkup|check-up|x-ray|xray|mri|ct\s+scan|ultrasound|blood\s+test|lab\s+test|lipid\s+profile|ecg|biopsy|endoscopy|vaccination|immunization)\b/i,
  ];

  // 5. Currency, pricing, fee specifications
  const pricingPatterns = [
    /\b(fee|fees|cost|costs|price|prices|pricing|charge|charges|rate|rates)\b/i,
    /\b(usd|inr|dollar|dollars|rupee|rupees|cents?)\b/i,
    /[₹$€£]\s*\d+/,
    /\b\d+\s*(usd|inr|dollars?|rupees?)\b/i,
  ];

  // 6. Operating hours, opening/closing timings
  const timingPatterns = [
    /\b\d{1,2}(:\d{2})?\s*(am|pm)\b/i,
    /\b(open|opening|close|closing|closed)\s+(at|from|to|on|during|between|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*(to|-)\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\b(hours|timings?|schedule)\s*:\s*\d/i,
  ];

  // 7. Addresses and physical locations
  const addressPatterns = [
    /\b(street|road|avenue|blvd|boulevard|suite|floor|building|block|pincode|zip\s*code)\b/i,
    /\b(located\s+at|address\s*is|find\s+us\s+at)\b/i,
  ];

  // 8. Contact Information (Phone numbers / Emails)
  const contactPatterns = [
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
    /\+?\d{10,14}\b/,
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  ];

  // 9. Appointment availability statements
  const availabilityPatterns = [
    /\b(available|slots?|openings?)\s+(on|at|for|from|between|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\bbook(ing)?\s+(at|on|for)\s+\d/i,
  ];

  // 10. Internal identifiers & IDs
  const idPatterns = [
    /\b(pat_|doc_|usr_|clinic_|agent_|call_|srv_|sch_)[a-zA-Z0-9_-]+/i,
  ];

  // 11. System Secrets / API Keys
  const secretPatterns = [
    /\b(api[_-]?key|secret|token|bearer|password|supabase|sarvam|gemini_api_key)\b/i,
  ];

  const allRules = [
    ...doctorPatterns,
    ...credentialPatterns,
    ...specialtyPatterns,
    ...servicePatterns,
    ...pricingPatterns,
    ...timingPatterns,
    ...addressPatterns,
    ...contactPatterns,
    ...availabilityPatterns,
    ...idPatterns,
    ...secretPatterns,
  ];

  for (const regex of allRules) {
    if (regex.test(trimmed)) {
      return {
        isValid: false,
        error: 'Clinic facts should be managed from your clinic records. Please remove doctor, service, price, timing or other clinic-specific information from this field.',
      };
    }
  }

  return { isValid: true };
}

/**
 * Validates AI Greeting to ensure it does not contain forbidden clinic facts.
 */
export function validateGreetingContent(text?: string | null): ValidationResult {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return { isValid: true };
  }

  const trimmed = text.trim();

  // Disallowed in greeting: doctor names/credentials, services, pricing, hours, address, secrets
  const forbiddenInGreeting = [
    /\b(dr|doctor)\.?\s+[a-zA-Z]+/i,
    /\b(mbbs|bds|md|ms|dm|mch|dnb|frcs|mrcp)\b/i,
    /\b(pediatrician|cardiologist|physician|surgeon|orthopedic|dermatologist|gynecologist|dentist)\b/i,
    /\b(fee|fees|cost|price|pricing|charge|\$|₹|usd|inr)\b/i,
    /\b\d{1,2}(:\d{2})?\s*(am|pm)\b/i,
    /\b(open|closed)\s+(at|from|to|on)\b/i,
    /\b(street|road|avenue|blvd|suite|floor|building)\b/i,
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
    /\+?\d{10,14}\b/,
    /\b(pat_|doc_|usr_|clinic_|agent_|call_|srv_)\w+/i,
    /\b(api[_-]?key|secret|token|bearer|password)\b/i,
  ];

  for (const regex of forbiddenInGreeting) {
    if (regex.test(trimmed)) {
      return {
        isValid: false,
        error: 'The AI greeting must be a simple welcoming message and cannot contain hardcoded doctor, service, pricing, or clinic factual details.',
      };
    }
  }

  return { isValid: true };
}
