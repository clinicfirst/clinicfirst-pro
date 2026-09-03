export interface ValidationResult {
  isValid: boolean;
  error?: string;
  matchedKeywords?: string[];
}

export const DEFAULT_GREETING_TEMPLATE =
  "Hello, thank you for calling {{clinic_name}}. I'm the AI receptionist. How may I help you today?";

export const GREETING_STYLES: Record<string, { label: string; template: string }> = {
  professional: {
    label: 'Professional',
    template: 'Hello, thank you for calling {{clinic_name}}. I am the AI receptionist. How may I assist you today?',
  },
  warm: {
    label: 'Warm & Friendly',
    template: "Hello, thank you for calling {{clinic_name}}! I'm your AI receptionist. How can I help you today?",
  },
  concise: {
    label: 'Concise',
    template: 'Thank you for calling {{clinic_name}}. How may I direct your call or assist you today?',
  },
  formal: {
    label: 'Formal',
    template: 'Good day and thank you for contacting {{clinic_name}}. I am the automated reception assistant. How may I assist you today?',
  },
};

export function generateSafeGreeting(clinicName: string, templateOrStyle?: string): string {
  const safeName = clinicName?.trim() || 'our clinic';
  let tpl = DEFAULT_GREETING_TEMPLATE;

  if (templateOrStyle) {
    const key = templateOrStyle.toLowerCase().trim();
    if (GREETING_STYLES[key]) {
      tpl = GREETING_STYLES[key].template;
    } else if (templateOrStyle.includes('{{clinic_name}}')) {
      tpl = templateOrStyle;
    }
  }

  return tpl.replace(/\{\{clinic_name\}\}/g, safeName).trim();
}

export function validateReceptionistPreferences(text?: string | null): ValidationResult {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return { isValid: true };
  }

  const trimmed = text.trim();

  const allRules = [
    /\b(dr|doctor)\.?\s+[a-zA-Z]+/i,
    /\b(dr|doctor)\b/i,
    /\b(mbbs|bds|md|ms|dm|mch|dnb|frcs|mrcp|bams|bhms)\b/i,
    /\b(pediatrician|pediatrics|cardiologist|cardiology|general\s+physician|physician|surgeon|surgery|orthopedic|orthopedist|dermatologist|dermatology|gynecologist|gynecology|obstetrician|neurologist|neurology|psychiatrist|psychiatry|dentist|dentistry|oncologist|oncology|ent\s+specialist|urologist|urology)\b/i,
    /\b(consultation|checkup|check-up|x-ray|xray|mri|ct\s+scan|ultrasound|blood\s+test|lab\s+test|lipid\s+profile|ecg|biopsy|endoscopy|vaccination|immunization)\b/i,
    /\b(fee|fees|cost|costs|price|prices|pricing|charge|charges|rate|rates)\b/i,
    /\b(usd|inr|dollar|dollars|rupee|rupees|cents?)\b/i,
    /[₹$€£]\s*\d+/,
    /\b\d+\s*(usd|inr|dollars?|rupees?)\b/i,
    /\b\d{1,2}(:\d{2})?\s*(am|pm)\b/i,
    /\b(open|opening|close|closing|closed)\s+(at|from|to|on|during|between|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*(to|-)\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\b(hours|timings?|schedule)\s*:\s*\d/i,
    /\b(street|road|avenue|blvd|boulevard|suite|floor|building|block|pincode|zip\s*code)\b/i,
    /\b(located\s+at|address\s*is|find\s+us\s+at)\b/i,
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
    /\+?\d{10,14}\b/,
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    /\b(available|slots?|openings?)\s+(on|at|for|from|between|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\bbook(ing)?\s+(at|on|for)\s+\d/i,
    /\b(pat_|doc_|usr_|clinic_|agent_|call_|srv_|sch_)[a-zA-Z0-9_-]+/i,
    /\b(api[_-]?key|secret|token|bearer|password|supabase|sarvam|gemini_api_key)\b/i,
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
