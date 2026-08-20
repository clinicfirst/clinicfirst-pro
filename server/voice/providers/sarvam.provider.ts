import {
  IVoiceProvider,
  VoiceMessage,
  VoiceSessionConfig,
} from '../voice-provider.interface';

/**
 * Sarvam.ai Voice Provider Stub / Adapter.
 * Adheres strictly to the IVoiceProvider interface.
 * Swapping voice_provider in ai_agents requires zero changes to the underlying business tools!
 */
export class SarvamVoiceProvider implements IVoiceProvider {
  readonly providerId = 'sarvam';
  private sessions = new Map<string, VoiceSessionConfig>();

  async startSession(config: VoiceSessionConfig): Promise<{ sessionId: string }> {
    const sessionId = `sarvam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.sessions.set(sessionId, config);
    return { sessionId };
  }

  async processUserMessage(
    sessionId: string,
    userText: string,
    history: VoiceMessage[],
    toolExecutor: (name: string, args: Record<string, any>) => Promise<any>
  ): Promise<{
    replyText: string;
    toolCallsExecuted: Array<{ name: string; args: any; result: any }>;
    audioBase64?: string;
  }> {
    const session = this.sessions.get(sessionId);
    const toolCallsExecuted: Array<{ name: string; args: any; result: any }> = [];

    // Check clinic info or available slots via shared tools
    const info = await toolExecutor('getClinicInfo', {});
    toolCallsExecuted.push({ name: 'getClinicInfo', args: {}, result: info });

    return {
      replyText: `[Sarvam AI Voice Engine]: Namaste! Thank you for connecting with ${session?.agentName || 'the clinic'}. How can I assist you with your appointment?`,
      toolCallsExecuted,
    };
  }

  async endSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}
