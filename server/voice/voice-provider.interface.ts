export interface VoiceMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface VoiceFunctionCall {
  name: string;
  args: Record<string, any>;
}

export interface VoiceFunctionResult {
  name: string;
  response: Record<string, any>;
}

export interface VoiceSessionConfig {
  clinicId: string;
  agentName: string;
  greeting: string;
  languages: string[];
  systemInstruction: string;
  tools: any[];
}

export interface IVoiceProvider {
  readonly providerId: string;
  startSession(config: VoiceSessionConfig): Promise<{ sessionId: string }>;
  processUserMessage(
    sessionId: string,
    userText: string,
    history: VoiceMessage[],
    toolExecutor: (name: string, args: Record<string, any>) => Promise<any>,
    sessionConfig?: Partial<VoiceSessionConfig>
  ): Promise<{
    replyText: string;
    toolCallsExecuted: Array<{ name: string; args: any; result: any }>;
    audioBase64?: string;
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
  }>;
  endSession(sessionId: string): Promise<void>;
}
