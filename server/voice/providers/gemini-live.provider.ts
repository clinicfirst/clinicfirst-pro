import { GoogleGenAI, Type } from '@google/genai';
import {
  IVoiceProvider,
  VoiceMessage,
  VoiceSessionConfig,
} from '../voice-provider.interface';
import { AI_RECEPTIONIST_TOOL_DEFINITIONS } from '../tools';
import { db } from '../../db';

import { AiConfigService } from '../../services/ai-config.service';

async function getGenAI(): Promise<GoogleGenAI | null> {
  const apiKey = await AiConfigService.getRawPlatformAiApiKey();
  if (apiKey) {
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return null;
}

export class GeminiLiveVoiceProvider implements IVoiceProvider {
  readonly providerId = 'gemini_live';
  private sessions = new Map<string, VoiceSessionConfig>();

  async startSession(config: VoiceSessionConfig): Promise<{ sessionId: string }> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.sessions.set(sessionId, config);
    return { sessionId };
  }

  async processUserMessage(
    sessionId: string,
    userText: string,
    history: VoiceMessage[],
    toolExecutor: (name: string, args: Record<string, any>) => Promise<any>,
    sessionConfig?: Partial<VoiceSessionConfig>
  ): Promise<{
    replyText: string;
    toolCallsExecuted: Array<{ name: string; args: any; result: any }>;
    audioBase64?: string;
    usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  }> {
    const session = this.sessions.get(sessionId) || (sessionConfig as VoiceSessionConfig | undefined);
    const ai = await getGenAI();
    const platformConfig = await AiConfigService.getPlatformAiConfig();
    const toolCallsExecuted: Array<{ name: string; args: any; result: any }> = [];

    const safeExecuteTool = async (name: string, args: Record<string, any>) => {
      try {
        return await Promise.race([
          toolExecutor(name, args),
          new Promise<any>((_, reject) =>
            setTimeout(() => reject(new Error(`Tool ${name} execution timed out`)), 3500)
          ),
        ]);
      } catch (err: any) {
        console.warn(`[GeminiLiveVoiceProvider] Tool ${name} execution error/timeout:`, err.message);
        return { error: err.message || `Tool ${name} execution failed` };
      }
    };

    const systemInstruction =
      session?.systemInstruction ||
      sessionConfig?.systemInstruction ||
      `You are ${session?.agentName || sessionConfig?.agentName || 'Ava'}, a professional, compassionate, and efficient AI Receptionist for this clinic.`;

    let selectedModel = platformConfig.model || 'gemini-3.8-flash';
    if (
      selectedModel.includes('gemini-2.5') ||
      selectedModel.includes('gemini-3.6') ||
      selectedModel.includes('gemini-1.5') ||
      selectedModel.includes('gemini-2.0')
    ) {
      selectedModel = 'gemini-3.8-flash';
    }
    const temperature = platformConfig.temperature ?? 0.2;

    if (!ai) {
      // Fallback intelligent agent behavior when running in environments without external API keys
      return this.fallbackSimulatedConversation(userText, history, safeExecuteTool, session);
    }

    const boundedGenerateContent = async (params: any, timeoutMs = 4500) => {
      return await Promise.race([
        ai.models.generateContent(params),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Model call timed out after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]);
    };

    try {
      // Build function declarations for @google/genai
      const functionDeclarations = AI_RECEPTIONIST_TOOL_DEFINITIONS.map((def) => ({
        name: def.name,
        description: def.description,
        parameters: {
          type: Type.OBJECT,
          properties: Object.fromEntries(
            Object.entries(def.parameters.properties).map(([k, v]) => [
              k,
              {
                type: Type.STRING,
                description: v.description || '',
              },
            ])
          ),
          required: def.parameters.required || [],
        },
      }));

      // Format conversation contents
      const contents: any[] = [];
      for (const msg of history) {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }],
        });
      }
      contents.push({
        role: 'user',
        parts: [{ text: userText }],
      });

      // Call Gemini with Function Calling and platform model (bounded by 4.5s timeout)
      let response = await boundedGenerateContent({
        model: selectedModel,
        contents,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: functionDeclarations as any }],
          temperature,
        },
      }, 4500);

      let iteration = 0;
      while (response.functionCalls && response.functionCalls.length > 0 && iteration < 2) {
        iteration++;
        const functionCall = response.functionCalls[0];
        const { name, args } = functionCall;

        const toolResult = await safeExecuteTool(name, (args as Record<string, any>) || {});
        toolCallsExecuted.push({ name, args, result: toolResult });

        const previousModelContent = response.candidates?.[0]?.content;
        const functionResponsePart = {
          functionResponse: {
            name,
            response: { output: toolResult },
          },
        };

        contents.push(previousModelContent);
        contents.push({
          role: 'user',
          parts: [functionResponsePart],
        });

        response = await boundedGenerateContent({
          model: selectedModel,
          contents,
          config: {
            systemInstruction,
            tools: [{ functionDeclarations: functionDeclarations as any }],
            temperature,
          },
        }, 4000);
      }

      const replyText = response.text || 'I understand. How else can I assist you with your appointment today?';

      let audioBase64: string | undefined = undefined;
      try {
        const ttsPromise = ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [{ parts: [{ text: replyText }] }],
          config: {
            responseModalities: ['AUDIO' as any],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
            },
          },
        });
        const ttsResponse = await Promise.race([
          ttsPromise,
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('TTS_TIMEOUT')), 1500)),
        ]);
        audioBase64 = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      } catch {
        // Non-fatal: frontend Web Speech API or widget handles audio playback
      }

      return {
        replyText,
        toolCallsExecuted,
        audioBase64,
        usage: {
          promptTokens: response.usageMetadata?.promptTokenCount,
          completionTokens: response.usageMetadata?.candidatesTokenCount,
          totalTokens: response.usageMetadata?.totalTokenCount,
        },
      };
    } catch (err: any) {
      console.warn('Gemini API call failed or timed out, using fallback simulation:', err?.message);
      return this.fallbackSimulatedConversation(userText, history, safeExecuteTool, session);
    }
  }

  async endSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  // Intelligent conversational fallback simulator that leverages the shared database tools
  private async fallbackSimulatedConversation(
    userText: string,
    history: VoiceMessage[],
    toolExecutor: (name: string, args: Record<string, any>) => Promise<any>,
    session?: VoiceSessionConfig
  ) {
    const textLower = userText.toLowerCase();
    const toolCallsExecuted: Array<{ name: string; args: any; result: any }> = [];

    // 1. Check for emergency / pain / urgent symptoms
    if (textLower.includes('emergency') || textLower.includes('chest pain') || textLower.includes('severe') || textLower.includes('urgent')) {
      const esc = await toolExecutor('escalateToStaff', {
        reason: 'Patient reported urgent symptoms',
        priority: 'urgent',
        contextSummary: userText,
      });
      toolCallsExecuted.push({ name: 'escalateToStaff', args: { reason: 'Urgent symptoms' }, result: esc });
      return {
        replyText: `If you are experiencing severe symptoms or a medical emergency, please dial emergency services immediately. I have alerted our clinical triage desk at ${esc.contact_phone || 'the front desk'}.`,
        toolCallsExecuted,
      };
    }

    // 2. Check for phone number lookup (returning patient identification)
    // Strip date patterns (YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, etc.) before checking for phone numbers
    const textWithoutDates = userText.replace(
      /\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b|\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g,
      ''
    );
    const phoneMatch = textWithoutDates.match(/(\+?\d[\d\s\-\(\)]{7,}\d)/);
    if (phoneMatch) {
      const phone = phoneMatch[0].trim();
      const patientRes = await toolExecutor('getPatientByPhone', { phone });
      toolCallsExecuted.push({ name: 'getPatientByPhone', args: { phone }, result: patientRes });

      if (patientRes.found) {
        let reply = `Welcome back, ${patientRes.name}! I found your patient record. `;
        if (patientRes.upcoming_appointments && patientRes.upcoming_appointments.length > 0) {
          const nextApt = patientRes.upcoming_appointments[0];
          reply += `You have an appointment on ${nextApt.date} at ${nextApt.start_time} with ${nextApt.doctor_name}. Would you like to check, reschedule, or cancel this visit?`;
        } else {
          reply += `How can I assist you with your appointment today? We have cardiology, general consultation, and pediatric openings.`;
        }
        return { replyText: reply, toolCallsExecuted };
      }
    }

    // 3. Check for cancellation intent
    if (textLower.includes('cancel')) {
      const aptMatch = userText.match(/apt_[a-zA-Z0-9_-]+/);
      if (aptMatch) {
        const cancelRes = await toolExecutor('cancelAppointment', {
          appointmentId: aptMatch[0],
          reason: 'Patient requested cancellation via AI receptionist',
        });
        toolCallsExecuted.push({ name: 'cancelAppointment', args: { appointmentId: aptMatch[0] }, result: cancelRes });
        if (cancelRes.success) {
          return {
            replyText: cancelRes.message || 'Your appointment has been successfully cancelled.',
            toolCallsExecuted,
          };
        } else {
          return {
            replyText: `I could not cancel that appointment: ${cancelRes.error || 'appointment not found or cancellation could not be confirmed'}. Would you like me to connect you with our clinic staff?`,
            toolCallsExecuted,
          };
        }
      }
      return {
        replyText: 'I can help you cancel your appointment. May I have your phone number or appointment reference number?',
        toolCallsExecuted,
      };
    }

    // 4. Check for reschedule intent
    if (textLower.includes('reschedule') || textLower.includes('change appointment') || textLower.includes('move appointment')) {
      const today = new Date().toISOString().split('T')[0];
      const slotsRes = await toolExecutor('getAvailableSlots', { date: today });
      toolCallsExecuted.push({ name: 'getAvailableSlots', args: { date: today }, result: slotsRes });
      return {
        replyText: `I can help reschedule your visit. Please provide your phone number and preferred new date so I can find the best open slot for you.`,
        toolCallsExecuted,
      };
    }

    // 5. Check for doctors inquiry
    if (textLower.includes('doctor') || textLower.includes('specialist') || textLower.includes('physician') || textLower.includes('cardiologist')) {
      const doctorsRes = await toolExecutor('getClinicDoctors', {});
      toolCallsExecuted.push({ name: 'getClinicDoctors', args: {}, result: doctorsRes });
      const docNames = (doctorsRes.doctors || []).map((d: any) => `${d.name} (${d.specialization})`).join(', ');
      return {
        replyText: `Our active doctors include: ${docNames || 'our experienced medical staff'}. Would you like to check availability or book a consultation?`,
        toolCallsExecuted,
      };
    }

    // 6. Check for services / fees inquiry
    if (textLower.includes('service') || textLower.includes('fee') || textLower.includes('cost') || textLower.includes('treatment')) {
      const servicesRes = await toolExecutor('getClinicServices', {});
      toolCallsExecuted.push({ name: 'getClinicServices', args: {}, result: servicesRes });
      const svcNames = (servicesRes.services || []).map((s: any) => `${s.name} (₹${s.fee})`).join(', ');
      return {
        replyText: `Our clinic services include: ${svcNames || 'comprehensive outpatient consultations'}. Would you like to schedule an appointment for any of these?`,
        toolCallsExecuted,
      };
    }

    // 7. Check for timings / hours / open status
    if (textLower.includes('hour') || textLower.includes('timing') || textLower.includes('open') || textLower.includes('when')) {
      const info = await toolExecutor('getClinicInfo', {});
      toolCallsExecuted.push({ name: 'getClinicInfo', args: {}, result: info });
      const hoursStr = typeof info.operating_hours === 'string'
        ? info.operating_hours
        : (info.operating_hours ? JSON.stringify(info.operating_hours).replace(/[{}"[\]]/g, ' ') : 'Monday through Friday from 8:30 AM to 5:30 PM');
      return {
        replyText: `${info.clinic_name || 'Our clinic'} is open ${hoursStr}. Phone: ${info.phone || 'our reception desk'}. Would you like to book an appointment?`,
        toolCallsExecuted,
      };
    }

    // 8. Check for booking / scheduling intent
    if (textLower.includes('book') || textLower.includes('appointment') || textLower.includes('schedule') || textLower.includes('slot') || textLower.includes('visit')) {
      const doctorsRes = await toolExecutor('getClinicDoctors', {});
      const servicesRes = await toolExecutor('getClinicServices', {});
      toolCallsExecuted.push({ name: 'getClinicDoctors', args: {}, result: doctorsRes });
      toolCallsExecuted.push({ name: 'getClinicServices', args: {}, result: servicesRes });

      const today = new Date().toISOString().split('T')[0];
      const slotsRes = await toolExecutor('getAvailableSlots', { date: today });
      toolCallsExecuted.push({ name: 'getAvailableSlots', args: { date: today }, result: slotsRes });

      if (slotsRes.slots && slotsRes.slots.length > 0) {
        const slot1 = slotsRes.slots[0];
        const slot2 = slotsRes.slots[1] || slotsRes.slots[0];
        return {
          replyText: `We have verified openings today with ${slot1.doctorName} at ${slot1.time} and ${slot2.time}. May I have your name and phone number to confirm your reservation?`,
          toolCallsExecuted,
        };
      } else {
        const reason = slotsRes.reason || 'There are currently no verified open slots for today.';
        return {
          replyText: `I checked our schedule. ${reason} What date and doctor would you prefer, and I will check availability for you?`,
          toolCallsExecuted,
        };
      }
    }

    // Default polite receptionist response
    const info = await toolExecutor('getClinicInfo', {});
    toolCallsExecuted.push({ name: 'getClinicInfo', args: {}, result: info });
    return {
      replyText: `Hello! I am ${session?.agentName || 'Ava'}, your AI Receptionist at ${info.clinic_name || 'the clinic'}. You can book, reschedule, or cancel an appointment, or ask about our doctors, services, and timings. How may I assist you today?`,
      toolCallsExecuted,
    };
  }
}
