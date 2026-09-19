/**
 * Phase 2H: Voice Safety & Policy Boundary Types
 * Defines authoritative policy categories, precedence, decisions, and evaluation contexts.
 */

export enum PolicyCategory {
  EMERGENCY = 'P0_EMERGENCY',
  MEDICAL_ADVICE = 'P1_MEDICAL_ADVICE',
  SENSITIVE_DATA = 'P2_SENSITIVE_DATA',
  TRANSACTION = 'P3_TRANSACTION',
  KNOWLEDGE_QUERY = 'P4_KNOWLEDGE_QUERY',
  UNKNOWN = 'P5_UNKNOWN',
}

export type PolicyDecision = 'ALLOW' | 'BLOCK' | 'ESCALATE' | 'REQUIRE_CONFIRMATION';

export interface PolicyContext {
  userUtterance?: string;
  sessionId?: string;
  callId?: string;
  callerPhone?: string;
  provider?: string;
  emergencyTriggered?: boolean;
  existingEscalationId?: string;
}

export interface EscalationParams {
  reason: string;
  priority: 'urgent' | 'normal';
  contextSummary: string;
}

export interface PolicyEvaluationResult {
  decision: PolicyDecision;
  category: PolicyCategory;
  reasonCode: string;
  message?: string;
  sanitizedArgs: Record<string, any>;
  escalationParams?: EscalationParams;
}

export interface PolicyTelemetryLog {
  timestamp: string;
  clinicId: string;
  category: PolicyCategory;
  decision: PolicyDecision;
  proposedTool: string;
  reasonCode: string;
  provider?: string;
  durationMs: number;
}
