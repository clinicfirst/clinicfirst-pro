/**
 * Phase 2H: Voice Policy Guard
 * Authoritative server-side policy enforcement boundary between LLM-proposed tool calls
 * and actual tool execution. Protects Gemini Live, Sarvam, and Fallback execution paths.
 */

import {
  PolicyCategory,
  PolicyContext,
  PolicyEvaluationResult,
  PolicyTelemetryLog,
} from './policy.types';
import { classifyIntentAndSafety } from './policy.classifier';

export class VoicePolicyGuard {
  /**
   * Authorizes or intercepts a proposed tool execution according to server-side policy.
   * Ensures the LLM cannot bypass safety boundaries regardless of system prompt or provider.
   */
  static async authorizeAndExecute(
    clinicId: string,
    toolName: string,
    args: Record<string, any>,
    context: PolicyContext | undefined,
    actualExecutor: (clinicId: string, name: string, args: Record<string, any>) => Promise<any>
  ): Promise<any> {
    const startTime = Date.now();

    // 1. Evaluate policy deterministically
    const evalResult: PolicyEvaluationResult = classifyIntentAndSafety(
      clinicId,
      toolName,
      args,
      context
    );

    const durationMs = Date.now() - startTime;

    // 2. Privacy-safe telemetry logging (zero PHI, zero credentials)
    this.logTelemetry({
      timestamp: new Date().toISOString(),
      clinicId,
      category: evalResult.category,
      decision: evalResult.decision,
      proposedTool: toolName,
      reasonCode: evalResult.reasonCode,
      provider: context?.provider,
      durationMs,
    });

    // 3. Dispatch based on authoritative server decision
    switch (evalResult.decision) {
      case 'ALLOW': {
        return await actualExecutor(clinicId, toolName, evalResult.sanitizedArgs);
      }

      case 'ESCALATE': {
        // Emergency interception: Execute urgent staff escalation instead of the proposed tool
        const escalationArgs = {
          reason: evalResult.escalationParams?.reason || 'Emergency escalation triggered by safety policy',
          priority: evalResult.escalationParams?.priority || 'urgent',
          contextSummary: evalResult.escalationParams?.contextSummary || 'Urgent medical symptoms detected during conversation.',
          callId: context?.callId,
        };

        const escalationResult = await actualExecutor(clinicId, 'escalateToStaff', escalationArgs);

        return {
          ...escalationResult,
          policyDecision: 'ESCALATE',
          policyCategory: evalResult.category,
          policyReason: evalResult.reasonCode,
          interceptedTool: toolName,
          safetyNotice: evalResult.message,
        };
      }

      case 'BLOCK': {
        return {
          success: false,
          policyDecision: 'BLOCK',
          policyCategory: evalResult.category,
          policyReason: evalResult.reasonCode,
          error: evalResult.message || 'Action blocked by safety policy.',
        };
      }

      case 'REQUIRE_CONFIRMATION': {
        return {
          success: false,
          requiresConfirmation: true,
          policyDecision: 'REQUIRE_CONFIRMATION',
          policyCategory: evalResult.category,
          policyReason: evalResult.reasonCode,
          message: evalResult.message || 'Explicit caller confirmation is required before proceeding.',
        };
      }

      default: {
        // Fail-closed guarantee
        return {
          success: false,
          policyDecision: 'BLOCK',
          policyCategory: PolicyCategory.UNKNOWN,
          policyReason: 'FAIL_CLOSED_UNKNOWN_DECISION',
          error: 'Action blocked by fail-closed policy enforcement.',
        };
      }
    }
  }

  /**
   * Privacy-safe logging that conforms strictly to Phase 2H observability requirements.
   * Prohibits raw utterances, patient identifiers, credentials, and PHI.
   */
  private static logTelemetry(entry: PolicyTelemetryLog): void {
    // Only metadata logged
    console.log(
      `[VoicePolicyGuard] Decision: ${entry.decision} | Category: ${entry.category} | Tool: ${entry.proposedTool} | Reason: ${entry.reasonCode} | Latency: ${entry.durationMs}ms`
    );
  }
}
