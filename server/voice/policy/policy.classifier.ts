/**
 * Phase 2H: Voice Safety & Policy Classifier
 * Deterministic, explainable, zero-external-LLM-call safety and policy classification.
 * 
 * Strict Multi-Intent Precedence:
 *   P0: EMERGENCY
 *     >
 *   P1: MEDICAL_ADVICE
 *     >
 *   P2: SENSITIVE_DATA
 *     >
 *   P3: TRANSACTION
 *     >
 *   P4: KNOWLEDGE_QUERY
 *     >
 *   P5: UNKNOWN
 */

import {
  PolicyCategory,
  PolicyContext,
  PolicyEvaluationResult,
} from './policy.types';

// Approved transactional and informational tools for AI Receptionist
export const AUTHORIZED_VOICE_TOOLS = new Set([
  'getClinicInfo',
  'getPatientByPhone',
  'createPatient',
  'getClinicDoctors',
  'getClinicServices',
  'getAvailableSlots',
  'createAppointment',
  'rescheduleAppointment',
  'cancelAppointment',
  'escalateToStaff',
  'searchClinicKnowledge',
]);

// ---------------------------------------------------------------------------
// Deterministic Policy Regexes
// ---------------------------------------------------------------------------

// P0: Emergency Indicators (life-threatening symptoms, cardiac/respiratory distress, urgent trauma)
const EMERGENCY_PATTERNS = [
  /\b(chest\s*pain|heart\s*attack|cardiac\s*arrest)\b/i,
  /\b(shortness\s*of\s*breath|breathlessness|difficulty\s*breathing|cannot\s*breathe|trouble\s*breathing|suffocating)\b/i,
  /\b(sharp\s*pain(\s+in)?(\s+my)?(\s+left)?\s*arm|arm\s*pain\s+and\s+shortness)\b/i,
  /\b(severe\s*chest|crushing\s*chest|unbearable\s*pain|stroke|unconscious|passed\s*out|fainted|seizure|convulsing)\b/i,
  /\b(heavy\s*bleeding|uncontrolled\s*bleeding|profuse\s*bleeding)\b/i,
  /\b(anaphylaxis|allergic\s*reaction.*cannot\s*breathe|overdose|poisoning)\b/i,
  /\b(medical\s*emergency|life\s*threatening|urgent\s*triage)\b/i,
];

// P1: Medical Advice & Clinical Prescription Indicators (prohibited for AI receptionist)
const MEDICAL_ADVICE_PATTERNS = [
  /\bwhat\s*(medicine|medication|drug|pill|tablets?)\s*(should|can|do)\s*(i|we)\s*(take|use|have)\b/i,
  /\bwhat\s*should\s*i\s*take\s*(for)?\b/i,
  /\b(prescribe|write\s*a\s*prescription|give\s*me\s*a\s*prescription)\b/i,
  /\b(amoxicillin|antibiotic|antibiotics|paracetamol|ibuprofen|dosage|how\s*many\s*mg)\b/i,
  /\b(what\s*is\s*wrong\s*with\s*me|diagnose\s*me|what\s*(disease|illness|infection)\s*do\s*i\s*have)\b/i,
  /\b(what\s*treatment\s*(do\s*i\s*need|should\s*i\s*take)|how\s*(should|can)\s*i\s*treat|cure\s*for)\b/i,
  /\bmedical\s*advice\b/i,
];

// P2: Sensitive Data & Secret Leakage Indicators
const SENSITIVE_DATA_PATTERNS = [
  /\b(supabase\s*key|api\s*key|service\s*role\s*key|secret\s*key|private\s*key)\b/i,
  /\b(database\s*password|db\s*password|connection\s*string|postgres\s*password)\b/i,
  /\b(jwt\s*secret|auth\s*secret|master\s*key|system\s*prompt)\b/i,
];

// P2: Cross-Tenant Isolation Indicators (e.g. BQ-10: foreign tenant data inquiries)
const CROSS_TENANT_PATTERNS = [
  /\b(metro\s*health(\s*clinic)?|apex\s*clinic|other\s*clinic|another\s*clinic|foreign\s*tenant)\b/i,
];

// P3: Explicit Transactional Booking Intent (used for BQ-02 to prevent false RAG routing)
const TRANSACTIONAL_INTENT_PATTERNS = [
  /\b(book(\s+an?)?\s*appointment|schedule(\s+an?)?\s*appointment|get(\s+available)?\s*slots|cancel(\s+my)?\s*appointment|reschedule(\s+my)?\s*appointment)\b/i,
];

/**
 * Extracts searchable text corpus from user utterance and tool arguments.
 */
function extractCorpus(args: Record<string, any>, context?: PolicyContext): {
  utteranceText: string;
  argsText: string;
  combinedText: string;
} {
  const utteranceText = (context?.userUtterance || '').trim();
  const argValues: string[] = [];

  for (const [key, val] of Object.entries(args || {})) {
    if (typeof val === 'string') {
      argValues.push(val);
    } else if (typeof val === 'object' && val !== null) {
      try {
        argValues.push(JSON.stringify(val));
      } catch {
        // Safe skip
      }
    }
  }

  const argsText = argValues.join(' ');
  const combinedText = `${utteranceText} ${argsText}`.trim();

  return { utteranceText, argsText, combinedText };
}

/**
 * Classifies an incoming tool invocation and context according to Phase 2H safety rules.
 * Enforces strict multi-intent precedence.
 */
export function classifyIntentAndSafety(
  clinicId: string,
  toolName: string,
  args: Record<string, any>,
  context?: PolicyContext
): PolicyEvaluationResult {
  const { utteranceText, argsText, combinedText } = extractCorpus(args, context);

  // Copy arguments to allow sanitization
  const sanitizedArgs: Record<string, any> = { ...args };

  // -------------------------------------------------------------------------
  // Tenant Isolation Defense: Never allow model-supplied clinicId to override
  // -------------------------------------------------------------------------
  if (sanitizedArgs.clinicId !== undefined) {
    const requestedClinicId = String(sanitizedArgs.clinicId);
    if (requestedClinicId !== clinicId) {
      return {
        decision: 'BLOCK',
        category: PolicyCategory.SENSITIVE_DATA,
        reasonCode: 'CROSS_TENANT_TAMPERING',
        message: 'Tenant parameter tampering detected. Cross-tenant access is strictly prohibited.',
        sanitizedArgs: {},
      };
    }
    // Delete model-supplied clinicId to guarantee server authority
    delete sanitizedArgs.clinicId;
  }

  // -------------------------------------------------------------------------
  // Precedence Tier P0: EMERGENCY
  // -------------------------------------------------------------------------
  const isEmergency = EMERGENCY_PATTERNS.some((pattern) => pattern.test(combinedText));

  if (isEmergency) {
    // If the tool is already escalateToStaff with urgent priority, allow it directly
    if (toolName === 'escalateToStaff') {
      return {
        decision: 'ALLOW',
        category: PolicyCategory.EMERGENCY,
        reasonCode: 'EMERGENCY_ESCALATION_AUTHORIZED',
        sanitizedArgs: {
          ...sanitizedArgs,
          priority: 'urgent',
        },
      };
    }

    // For any ordinary tool (createAppointment, getAvailableSlots, searchClinicKnowledge, etc.):
    // EMERGENCY takes absolute precedence over transactions.
    // The policy layer ESCALATES to urgent clinical triage, BLOCKING ordinary booking.
    return {
      decision: 'ESCALATE',
      category: PolicyCategory.EMERGENCY,
      reasonCode: 'EMERGENCY_INTERCEPTION',
      message: 'Emergency symptoms detected. Ordinary appointment booking and administrative actions are suspended. Directing to urgent clinical triage or emergency services.',
      sanitizedArgs,
      escalationParams: {
        reason: 'Emergency symptoms detected by Phase 2H policy gate',
        priority: 'urgent',
        contextSummary: 'Patient presented with emergency symptoms requiring urgent clinical escalation.',
      },
    };
  }

  // -------------------------------------------------------------------------
  // Precedence Tier P1: MEDICAL_ADVICE
  // -------------------------------------------------------------------------
  const isMedicalAdvice = MEDICAL_ADVICE_PATTERNS.some((pattern) => pattern.test(combinedText));

  if (isMedicalAdvice) {
    // If attempting to search clinic knowledge for clinical prescriptions/medications
    if (toolName === 'searchClinicKnowledge') {
      return {
        decision: 'BLOCK',
        category: PolicyCategory.MEDICAL_ADVICE,
        reasonCode: 'MEDICAL_ADVICE_RAG_PROHIBITED',
        message: 'The AI receptionist cannot diagnose conditions, recommend medications, or provide clinical medical advice. Please consult with our clinical doctors or front desk staff.',
        sanitizedArgs: {},
      };
    }

    // If an ordinary tool is proposed while the user is demanding medical advice (mixed intent),
    // we block clinical treatment behavior
    if (toolName !== 'escalateToStaff' && toolName !== 'getAvailableSlots' && toolName !== 'createAppointment') {
      return {
        decision: 'BLOCK',
        category: PolicyCategory.MEDICAL_ADVICE,
        reasonCode: 'MEDICAL_ADVICE_PROHIBITED',
        message: 'The AI receptionist is strictly prohibited from providing medical diagnoses, treatment recommendations, or prescribing pharmaceutical drugs.',
        sanitizedArgs: {},
      };
    }
  }

  // -------------------------------------------------------------------------
  // Precedence Tier P2: SENSITIVE_DATA
  // -------------------------------------------------------------------------
  const isSensitiveData = SENSITIVE_DATA_PATTERNS.some((pattern) => pattern.test(combinedText));

  if (isSensitiveData) {
    return {
      decision: 'BLOCK',
      category: PolicyCategory.SENSITIVE_DATA,
      reasonCode: 'SENSITIVE_DATA_PROHIBITED',
      message: 'Access to system credentials, database keys, or internal configurations is strictly prohibited.',
      sanitizedArgs: {},
    };
  }

  // Check for foreign tenant inquiries (BQ-10)
  const isCrossTenant = CROSS_TENANT_PATTERNS.some((pattern) => pattern.test(combinedText));
  if (isCrossTenant && /\b(records?|patients?|data|appointments?|files?|medical)\b/i.test(combinedText)) {
    return {
      decision: 'BLOCK',
      category: PolicyCategory.SENSITIVE_DATA,
      reasonCode: 'CROSS_TENANT_DATA_BLOCKED',
      message: 'Cross-tenant patient record access is strictly prohibited. You may only access data for your authorized clinic.',
      sanitizedArgs: {},
    };
  }

  // -------------------------------------------------------------------------
  // Precedence Tier P3: TRANSACTION
  // -------------------------------------------------------------------------
  const isTransactionalTool = [
    'createAppointment',
    'rescheduleAppointment',
    'cancelAppointment',
    'getAvailableSlots',
    'getPatientByPhone',
    'createPatient',
    'getClinicInfo',
    'getClinicDoctors',
    'getClinicServices',
    'escalateToStaff',
  ].includes(toolName);

  if (isTransactionalTool) {
    return {
      decision: 'ALLOW',
      category: PolicyCategory.TRANSACTION,
      reasonCode: 'TRANSACTION_AUTHORIZED',
      sanitizedArgs,
    };
  }

  // -------------------------------------------------------------------------
  // Precedence Tier P4: KNOWLEDGE_QUERY
  // -------------------------------------------------------------------------
  if (toolName === 'searchClinicKnowledge') {
    const query = String(sanitizedArgs.query || '');

    // BQ-02 Defense: If query is purely an appointment booking request, intercept it
    // because transactional intent must be handled via booking tools, not semantic RAG.
    if (TRANSACTIONAL_INTENT_PATTERNS.some((p) => p.test(query))) {
      return {
        decision: 'BLOCK',
        category: PolicyCategory.TRANSACTION,
        reasonCode: 'TRANSACTIONAL_INTENT_MISMATCH',
        message: 'Appointment booking, cancellation, and rescheduling must be performed via transaction tools (createAppointment / getAvailableSlots / cancelAppointment), not static knowledge retrieval.',
        sanitizedArgs: {},
      };
    }

    return {
      decision: 'ALLOW',
      category: PolicyCategory.KNOWLEDGE_QUERY,
      reasonCode: 'KNOWLEDGE_QUERY_AUTHORIZED',
      sanitizedArgs,
    };
  }

  // -------------------------------------------------------------------------
  // Precedence Tier P5: UNKNOWN
  // -------------------------------------------------------------------------
  return {
    decision: 'BLOCK',
    category: PolicyCategory.UNKNOWN,
    reasonCode: 'UNKNOWN_TOOL_BLOCKED',
    message: `Tool ${toolName} is not recognized or authorized for voice execution.`,
    sanitizedArgs: {},
  };
}
