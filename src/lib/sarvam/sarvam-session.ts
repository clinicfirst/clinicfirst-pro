/**
 * Production Sarvam Voice Agent Session Manager
 * 
 * Provides a reliable, production-grade SarvamSession implementation
 * backed by the official `sarvam-conv-ai-sdk/browser`.
 * 
 * Translates the clean Level 2 Clinic-1st interface to Sarvam's
 * real-time Web Audio + WebSocket ConversationAgent engine.
 */

import {
  ConversationAgent,
  BrowserAudioInterface,
  InteractionType,
  AgentState,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ServerError,
  type ServerTranscriptMsg,
  type ServerTextMsgType,
} from 'sarvam-conv-ai-sdk/browser';

export interface SarvamSessionConfig {
  apiKey: string;
  orgId: string;
  workspaceId: string;
  appId: string;
  userId?: string;
  interactionType?: 'call' | 'text';
  agentVariables?: Record<string, any>;
  baseUrl?: string;
  customHeaders?: Record<string, string>;
}

export type SarvamState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';

export interface SarvamStateChangeEvent {
  state: SarvamState;
  previousState?: SarvamState;
}

type EventListener = (...args: any[]) => void;

export class SarvamSession {
  private config: SarvamSessionConfig;
  private agent: ConversationAgent | null = null;
  private audioInterface: BrowserAudioInterface | null = null;
  private listeners: Map<string, Set<EventListener>> = new Map();
  private currentState: SarvamState = 'idle';

  constructor(config: SarvamSessionConfig) {
    if (!config.apiKey) {
      throw new Error('SarvamSession requires an apiKey (embedKey).');
    }
    if (!config.orgId) {
      throw new Error('SarvamSession requires an orgId.');
    }
    if (!config.workspaceId) {
      throw new Error('SarvamSession requires a workspaceId.');
    }
    if (!config.appId) {
      throw new Error('SarvamSession requires an appId (provider_agent_id).');
    }
    this.config = config;
  }

  /**
   * Subscribe to session events:
   * - 'statechange': ({ state, previousState }) => void
   * - 'error': (error) => void
   * - 'transcript': (msg) => void
   * - 'connect': () => void
   * - 'disconnect': () => void
   */
  public on(event: string, listener: EventListener): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return this;
  }

  public off(event: string, listener: EventListener): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  private emit(event: string, ...args: any[]): void {
    const set = this.listeners.get(event);
    if (set) {
      set.forEach((fn) => {
        try {
          fn(...args);
        } catch (e) {
          console.error(`[SarvamSession] Error in '${event}' event listener:`, e);
        }
      });
    }
  }

  private setState(newState: SarvamState): void {
    if (this.currentState === newState) return;
    const previousState = this.currentState;
    this.currentState = newState;
    this.emit('statechange', { state: newState, previousState });
  }

  public getState(): SarvamState {
    return this.currentState;
  }

  /**
   * Starts the real-time Sarvam voice session:
   * 1. Initializes browser microphone & speaker via Web Audio API AudioWorklet
   * 2. Fetches signed WebSocket URL from Sarvam API
   * 3. Establishes live duplex streaming connection
   */
  public async start(): Promise<void> {
    if (this.agent && this.currentState !== 'idle' && this.currentState !== 'error') {
      console.warn('[SarvamSession] Session already running or connecting.');
      return;
    }

    this.setState('connecting');

    try {
      // 1. Initialize browser audio interface (16kHz for telephony-quality speech)
      this.audioInterface = new BrowserAudioInterface(16000);

      // 2. Build interaction configuration
      // If agentVariables is empty or undefined, omit it to prevent schema validation issues
      const hasVariables = this.config.agentVariables && Object.keys(this.config.agentVariables).length > 0;

      const interactionConfig: any = {
        user_identifier_type: 'custom',
        user_identifier: this.config.userId || `staff_${Date.now()}`,
        org_id: this.config.orgId,
        workspace_id: this.config.workspaceId,
        app_id: this.config.appId,
        interaction_type: InteractionType.CALL,
        input_sample_rate: 16000,
        output_sample_rate: 16000,
      };

      if (hasVariables) {
        interactionConfig.agent_variables = this.config.agentVariables;
      }

      // 3. Instantiate official ConversationAgent
      this.agent = new ConversationAgent({
        apiKey: this.config.apiKey,
        platform: 'browser',
        config: interactionConfig,
        audioInterface: this.audioInterface,
        baseUrl: this.config.baseUrl,
        customHeaders: this.config.customHeaders,
        stateCallback: (agentState: AgentState) => {
          this.handleSdkStateChange(agentState);
        },
        transcriptCallback: async (msg: ServerTranscriptMsg) => {
          this.emit('transcript', msg);
        },
        textCallback: async (msg: ServerTextMsgType) => {
          this.emit('text', msg);
        },
        startCallback: async () => {
          this.emit('connect');
        },
        endCallback: async () => {
          this.setState('idle');
          this.emit('disconnect');
        },
      });

      // 4. Start session and wait for socket connection
      await this.agent.start();
      
      const connected = await this.agent.waitForConnect(10.0);
      if (!connected) {
        throw new Error('WebSocket connection timed out while establishing link to Sarvam.');
      }

      // Automatically monitor disconnect
      this.agent.waitForDisconnect().then(() => {
        this.setState('idle');
        this.emit('disconnect');
      }).catch(() => {
        this.setState('idle');
      });

    } catch (rawError: any) {
      this.setState('error');
      const mappedError = this.normalizeError(rawError);
      this.emit('error', mappedError);
      // Clean up any partially initialized resources
      await this.cleanup();
      throw mappedError;
    }
  }

  /**
   * Gracefully stops the active Sarvam session and releases mic/audio resources.
   */
  public async stop(): Promise<void> {
    await this.cleanup();
    this.setState('idle');
    this.emit('disconnect');
  }

  public mute(): void {
    this.agent?.mute();
  }

  public unmute(): void {
    this.agent?.unmute();
  }

  public isMuted(): boolean {
    return this.agent?.isMuted() ?? false;
  }

  private async cleanup(): Promise<void> {
    if (this.agent) {
      try {
        await this.agent.stop();
      } catch (e) {
        console.warn('[SarvamSession] Error while stopping agent:', e);
      }
      this.agent = null;
    }
    if (this.audioInterface) {
      try {
        await this.audioInterface.stop();
      } catch (e) {
        console.warn('[SarvamSession] Error while stopping audio interface:', e);
      }
      this.audioInterface = null;
    }
  }

  private handleSdkStateChange(sdkState: AgentState): void {
    switch (sdkState) {
      case AgentState.IDLE:
        this.setState('idle');
        break;
      case AgentState.CONNECTING:
        this.setState('connecting');
        break;
      case AgentState.LISTENING:
        this.setState('listening');
        break;
      case AgentState.SPEAKING:
        this.setState('speaking');
        break;
      case AgentState.ERROR:
        this.setState('error');
        break;
      default:
        break;
    }
  }

  private normalizeError(err: any): Error {
    const message = err?.message || String(err);
    const name = err?.name || '';

    // Microphone access permission or device missing
    if (
      name === 'NotAllowedError' ||
      name === 'PermissionDeniedError' ||
      message.toLowerCase().includes('permission denied')
    ) {
      const error = new Error('Microphone permission denied. Please allow microphone access in your browser.');
      error.name = 'MicrophonePermissionDenied';
      return error;
    }

    if (
      name === 'NotFoundError' ||
      name === 'DevicesNotFoundError' ||
      message.toLowerCase().includes('device not found') ||
      message.toLowerCase().includes('no microphone')
    ) {
      const error = new Error('Microphone device not found. Please connect a working microphone.');
      error.name = 'MicrophoneNotFound';
      return error;
    }

    // Sarvam API HTTP error mappings
    if (err instanceof NotFoundError || message.includes('Resource not found') || message.includes('404')) {
      const error = new Error(`Sarvam agent not found. The configured Agent ID "${this.config.appId}" does not exist in the specified organization/workspace.`);
      error.name = 'SarvamAgentNotFound';
      return error;
    }

    if (err instanceof AuthenticationError || message.includes('401') || message.toLowerCase().includes('authentication failed')) {
      const error = new Error('Authentication failed. Sarvam rejected the API key. Please check your credentials.');
      error.name = 'SarvamAuthFailed';
      return error;
    }

    if (err instanceof ForbiddenError || message.includes('403') || message.toLowerCase().includes('forbidden')) {
      const error = new Error('Access forbidden. The embed key does not have permission to access this Sarvam agent.');
      error.name = 'SarvamForbidden';
      return error;
    }

    if (err instanceof RateLimitError || message.includes('429')) {
      const error = new Error('Sarvam connection rate limit reached. Please wait a few seconds and try again.');
      error.name = 'SarvamRateLimit';
      return error;
    }

    if (err instanceof ServerError || message.includes('500') || message.includes('502') || message.includes('503')) {
      const error = new Error('Sarvam voice service error. Please try again shortly.');
      error.name = 'SarvamServerError';
      return error;
    }

    // Default error preservation
    const error = new Error(message || 'Failed to connect to Sarvam voice agent.');
    error.name = name || 'SarvamConnectionError';
    return error;
  }
}
