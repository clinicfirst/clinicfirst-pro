import { GoogleGenAI, Type } from '@google/genai';
import {
  IVoiceProvider,
  VoiceMessage,
  VoiceSessionConfig,
} from '../voice-provider.interface';
import { AI_RECEPTIONIST_TOOL_DEFINITIONS } from '../tools';
import { db } from '../../db';

function getGenAI(): GoogleGenAI | null {
  const apiKey = db.getRawPlatformAiApiKey();
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
    toolExecutor: (name: string, args: Record<string, any>) => Promise<any>
  ): Promise<{
    replyText: string;
    toolCallsExecuted: Array<{ name: string; args: any; result: any }>;
    audioBase64?: string;
  }> {
    const session = this.sessions.get(sessionId);
    const ai = getGenAI();
    const platformConfig = db.getPlatformAiConfig();
    const toolCallsExecuted: Array<{ name: string; args: any; result: any }> = [];

    const systemInstruction = session?.systemInstruction || `You are ${session?.agentName || 'Ava'}, a professional, compassionate, and efficient AI Receptionist for this clinic.`;
    let selectedModel = platformConfig.model || 'gemini-3.6-flash';
    if (selectedModel.includes('gemini-2.5')) {
      selectedModel = selectedModel.replace('gemini-2.5', 'gemini-3.6');
    }
    const temperature = platformConfig.temperature ?? 0.2;

    if (!ai) {
      // Fallback intelligent agent behavior when running in environments without external API keys
      return this.fallbackSimulatedConversation(userText, history, toolExecutor, session);
    }

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

      // Call Gemini with Function Calling and platform model
      let response = await ai.models.generateContent({
        model: selectedModel,
        contents,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: functionDeclarations as any }],
          temperature,
        },
      });

      let iteration = 0;
      while (response.functionCalls && response.functionCalls.length > 0 && iteration < 4) {
        iteration++;
        const functionCall = response.functionCalls[0];
        const { name, args } = functionCall;

        const toolResult = await toolExecutor(name, (args as Record<string, any>) || {});
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

        response = await ai.models.generateContent({
          model: selectedModel,
          contents,
          config: {
            systemInstruction,
            tools: [{ functionDeclarations: functionDeclarations as any }],
            temperature,
          },
        });
      }

      const replyText = response.text || 'I understand. How else can I assist you with your appointment today?';

      let audioBase64: string | undefined = undefined;
      try {
        const ttsResponse = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
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
        audioBase64 = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      } catch (ttsErr: any) {
        console.warn('TTS Generation failed:', ttsErr?.message);
      }

      return {
        replyText,
        toolCallsExecuted,
        audioBase64,
      };
    } catch (err: any) {
      console.warn('Gemini API call failed, using intelligent fallback simulation:', err?.message);
      return this.fallbackSimulatedConversation(userText, history, toolExecutor, session);
    }
  }

  async endSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  // Intelligent conversational fallback simulator that leverages the shared tools
  private async fallbackSimulatedConversation(
    userText: string,
    history: VoiceMessage[],
    toolExecutor: (name: string, args: Record<string, any>) => Promise<any>,
    session?: VoiceSessionConfig
  ) {
    const textLower = userText.toLowerCase();
    const toolCallsExecuted: Array<{ name: string; args: any; result: any }> = [];

    // Check for phone number
    const phoneMatch = userText.match(/(\+?\d[\d\s\-\(\)]{7,}\d)/);
    if (phoneMatch) {
      const phone = phoneMatch[0].trim();
      const patientRes = await toolExecutor('getPatientByPhone', { phone });
      toolCallsExecuted.push({ name: 'getPatientByPhone', args: { phone }, result: patientRes });

      if (patientRes.found) {
        let reply = `Welcome back, ${patientRes.name}! I found your record. `;
        if (patientRes.upcoming_appointments && patientRes.upcoming_appointments.length > 0) {
          const nextApt = patientRes.upcoming_appointments[0];
          reply += `You have an appointment on ${nextApt.date} at ${nextApt.start_time} with ${nextApt.doctor_name}. Would you like to check, reschedule, or book a new visit?`;
        } else {
          reply += `How can I assist with your appointment today? We offer cardiac, general, and pediatric consultations.`;
        }
        return { replyText: reply, toolCallsExecuted };
      }
    }

    // Check for booking intent
    if (textLower.includes('book') || textLower.includes('appointment') || textLower.includes('schedule')) {
      const doctorsRes = await toolExecutor('getClinicDoctors', {});
      const servicesRes = await toolExecutor('getClinicServices', {});
      toolCallsExecuted.push({ name: 'getClinicDoctors', args: {}, result: doctorsRes });

      const today = new Date().toISOString().split('T')[0];
      const slotsRes = await toolExecutor('getAvailableSlots', { date: today });
      toolCallsExecuted.push({ name: 'getAvailableSlots', args: { date: today }, result: slotsRes });

      if (slotsRes.slots && slotsRes.slots.length > 0) {
        const slot1 = slotsRes.slots[0];
        const slot2 = slotsRes.slots[1] || slotsRes.slots[0];
        return {
          replyText: `We have openings today with ${slot1.doctorName} at ${slot1.time} and ${slot2.time}. May I have your name and phone number to confirm your reservation?`,
          toolCallsExecuted,
        };
      } else {
        return {
          replyText: `I checked our schedule. What date and doctor would you prefer, and I'll find the best available slot for you?`,
          toolCallsExecuted,
        };
      }
    }

    // Check for timings / hours
    if (textLower.includes('hours') || textLower.includes('timings') || textLower.includes('open')) {
      const info = await toolExecutor('getClinicInfo', {});
      toolCallsExecuted.push({ name: 'getClinicInfo', args: {}, result: info });
      return {
        replyText: `${info.clinic_name || 'Our clinic'} is open Monday through Friday from 8:30 AM to 5:30 PM, and Saturday mornings. Would you like to schedule a visit?`,
        toolCallsExecuted,
      };
    }

    // Check for emergency / pain
    if (textLower.includes('emergency') || textLower.includes('chest pain') || textLower.includes('severe')) {
      const esc = await toolExecutor('escalateToStaff', {
        reason: 'Patient reported urgent symptoms',
        priority: 'urgent',
        contextSummary: userText,
      });
      toolCallsExecuted.push({ name: 'escalateToStaff', args: { reason: 'Urgent symptoms' }, result: esc });
      return {
        replyText: `If you are experiencing severe symptoms or chest pain, please dial 911 immediately. I have also alerted our emergency triage desk at ${esc.contact_phone}.`,
        toolCallsExecuted,
      };
    }

    // Default polite response
    return {
      replyText: `I am happy to assist you at ${session?.agentName ? session.agentName : 'the clinic'}. You can book, reschedule, or cancel an appointment, or ask about our doctors and timings. What would you like to do?`,
      toolCallsExecuted,
    };
  }
}
