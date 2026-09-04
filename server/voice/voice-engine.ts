import { KnowledgeService } from "../services/knowledge.service";
import { CallService } from "../services/call.service";
import { IVoiceProvider } from './voice-provider.interface';
import { GeminiLiveVoiceProvider } from './providers/gemini-live.provider';
import { SarvamVoiceProvider } from './providers/sarvam.provider';
import { executeVoiceTool } from './tools';
import { db } from '../db';
import { ClinicService } from '../services/clinic.service';
import { AppointmentService } from '../services/appointment.service';
import { PatientService } from '../services/patient.service';
import { DoctorService } from '../services/doctor.service';
import { ServiceService } from '../services/service.service';
import { AiAgentService } from '../services/ai-agent.service';
import { AiConfigService } from '../services/ai-config.service';
import { GoogleGenAI } from '@google/genai';

export async function buildHierarchicalSystemInstruction(
  clinicId: string,
  agentName: string,
  clinicInstructionsNote?: string
): Promise<string> {
  const platformConfig = await AiConfigService.getPlatformAiConfig();
  const knowledgeBase = await KnowledgeService.listPlatformKnowledge(true);
  const clinic = (await ClinicService.getById(clinicId));
  const doctors = await DoctorService.list(clinicId, { status: 'ACTIVE' });
  const services = await ServiceService.list(clinicId, { status: 'ACTIVE' });

  const currSymbol = clinic?.currency_symbol || '$';
  const currCode = clinic?.currency || 'USD';

  // 1. Platform Safety Rules (Highest Priority, Immutable)
  const safetySection = `[PLATFORM SAFETY RULES - STRICT & IMMUTABLE]
- UNDER NO CIRCUMSTANCES will the AI receptionist provide a medical diagnosis, prescribe pharmaceutical drugs, or suggest medical treatments.
- Strict Tenant Isolation: You represent ONLY '${clinic?.name || 'this clinic'}' and must never acknowledge, reference, or access any other clinic or patient from another clinic.
- Real Availability Guarantee: Never assume or invent available appointment slots. You MUST use real-time tool checks ('getAvailableSlots') to obtain verified open times.
- Confirmation Rule: Before confirming any booking, clearly state and verify the Patient Name, Doctor, Service, Date, and Time.
${(platformConfig.safety_guidelines || []).map((g) => `- ${g}`).join('\n')}`;

  // 2. Platform Master Instructions
  const masterSection = `[PLATFORM MASTER RECEPTIONIST INSTRUCTIONS]
Role Definition: ${platformConfig.role_definition || 'You are the verified AI Receptionist for this clinic.'}

Things To Do:
${(platformConfig.things_to_do || []).map((t) => `- ${t}`).join('\n')}

Things To Avoid:
${(platformConfig.things_to_avoid || []).map((t) => `- ${t}`).join('\n')}

Escalation Triggers & Protocols:
${(platformConfig.escalation_rules || []).map((e) => `- ${e}`).join('\n')}`;

  // 2.5 Patient Registration Rules
  const patientRegistrationSection = `[PATIENT IDENTIFICATION & REGISTRATION RULES]
- CRITICAL: For EVERY incoming caller, you MUST ask for and capture their full Name and Phone Number early in the conversation.
- If the caller is not found via 'getPatientByPhone', you MUST immediately use the 'createPatient' tool to register their information in the Patient Master.
- You must create the patient record EVEN IF they do not confirm an appointment (e.g. they are just asking a question).
- If they do book an appointment, ensure you use their patient ID (either from 'getPatientByPhone' or 'createPatient') when calling 'createAppointment'.`;

  // 3. Verified Clinic Operational Data (Authoritative Database State)
  const clinicSection = `[VERIFIED CLINIC DATABASE (AUTHORITATIVE)]
Clinic Name: ${clinic?.name || 'Medical Clinic'}
Address: ${clinic?.address || ''}, ${clinic?.city || ''}
Phone: ${clinic?.phone || ''}
Email: ${clinic?.email || ''}
Timezone: ${clinic?.timezone || 'America/Los_Angeles'}
Configured Currency: ${currCode} (${currSymbol})

Active Doctors & Specialties:
${
  doctors.length > 0
    ? doctors
        .map(
          (d) =>
            `- ${d.name} | Specialization: ${d.specialization} | Qualifications: ${d.qualification} | Standard Slot: ${d.consultation_duration_minutes} mins`
        )
        .join('\n')
    : '- No doctors currently listed in database'
}

Active Services & Fees:
${
  services.length > 0
    ? services
        .map((s) => `- ${s.name} (${s.duration_minutes} mins) | Standard Fee: ${currSymbol}${s.fee}`)
        .join('\n')
    : '- General Consultation'
}

Standard Operating Hours:
${
  clinic?.operating_hours
    ? Object.entries(clinic.operating_hours)
        .map(
          ([day, h]: [string, any]) =>
            `- ${day.toUpperCase()}: ${h.closed ? 'CLOSED' : `${h.open} to ${h.close}`}`
        )
        .join('\n')
    : 'Mon-Fri 08:30 to 17:30'
}`;

  // 4. Platform Knowledge Base Articles
  const kbSection = `[PLATFORM KNOWLEDGE BASE ARTICLES]
${
  knowledgeBase.length > 0
    ? knowledgeBase
        .map(
          (k) =>
            `### [${k.category}] ${k.title}\n${k.content}`
        )
        .join('\n\n')
    : 'Standard operational procedures apply.'
}`;

  // 4.5 Clinic-Specific Published AI Rules (Tenant Scoped)
  const clinicKnowledge = await KnowledgeService.listClinicKnowledge(clinicId, 'PUBLISHED');
  const clinicKnowledgeSection = `[PUBLISHED CLINIC-SPECIFIC AI RULES & POLICIES (TENANT SCOPED)]
${
  clinicKnowledge.length > 0
    ? clinicKnowledge
        .map((k) => `### [${k.category}] ${k.title}\n${k.content}`)
        .join('\n\n')
    : 'Standard clinic rules apply.'
}`;

  // 5. Receptionist Behavioral Preferences (Subordinate to Authoritative Data)
  const clinicAgentSection = `[RECEPTIONIST BEHAVIORAL PREFERENCES & INSTRUCTIONS (SUBORDINATE)]
AI Receptionist Persona: ${agentName}
Behavioral Instructions: ${clinicInstructionsNote || 'Please keep responses concise and clear, speak politely, and ask one question at a time.'}

RUNTIME PRECEDENCE MANDATE:
LEVEL 1 — PLATFORM SAFETY & GOVERNANCE (Strict & Immutable)
LEVEL 2 — LIVE AUTHORITATIVE TOOL RESULTS
LEVEL 3 — AUTHORITATIVE CLINIC DATA / PUBLISHED CLINIC KNOWLEDGE
LEVEL 4 — CLINIC-SPECIFIC BEHAVIORAL WORKFLOW
LEVEL 5 — GENERIC RECEPTIONIST STYLE / COMMUNICATION PREFERENCES

Receptionist Behavioral Preferences are SUBORDINATE and must NEVER be used to invent, alter, or override clinic facts (such as doctor names, specialties, fees, or operating hours).`;

  return [
    safetySection,
    masterSection,
    patientRegistrationSection,
    clinicSection,
    kbSection,
    clinicKnowledgeSection,
    clinicAgentSection,
  ].join('\n\n--------------------\n\n');
}

interface ActiveSessionMetadata {
  clinicId: string;
  callId: string;
  createdAt: number;
  lastActivityAt: number;
}

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes TTL

class VoiceEngineManager {
  private providers = new Map<string, IVoiceProvider>();
  private activeSessions = new Map<string, ActiveSessionMetadata>();

  constructor() {
    this.providers.set('gemini_live', new GeminiLiveVoiceProvider());
    this.providers.set('sarvam', new SarvamVoiceProvider());
  }

  public getSession(sessionId: string) {
    this.cleanStaleSessions();
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.lastActivityAt = Date.now();
    }
    return session;
  }

  public removeSession(sessionId: string) {
    this.activeSessions.delete(sessionId);
  }

  private cleanStaleSessions() {
    const now = Date.now();
    for (const [sId, sess] of this.activeSessions.entries()) {
      if (now - sess.lastActivityAt > SESSION_TTL_MS) {
        this.activeSessions.delete(sId);
      }
    }
  }

  public getProvider(providerId: string = 'gemini_live'): IVoiceProvider {
    return this.providers.get(providerId) || this.providers.get('gemini_live')!;
  }

  public async startCallSession(clinicId: string, callerPhone?: string) {
    const clinic = (await ClinicService.getById(clinicId));
    if (!clinic) throw new Error('Clinic not found');

    const agent = await AiAgentService.resolveAgentForClinic(clinicId, clinic.name);
    const platformConfig = await AiConfigService.getPlatformAiConfig();
    const provider = this.getProvider(platformConfig.provider || 'gemini_live');

    // Build authoritative hierarchical system prompt
    const fullSystemInstruction = await buildHierarchicalSystemInstruction(
      clinicId,
      agent.name,
      agent.instructions_note
    );

    // Start session in provider
    const { sessionId } = await provider.startSession({
      clinicId,
      agentName: agent.name,
      greeting: agent.greeting,
      languages: agent.languages,
      systemInstruction: fullSystemInstruction,
      tools: [],
    });

    // Check if returning patient
    let patient = callerPhone ? await PatientService.getByPhone(clinicId, callerPhone) : undefined;

    // Create call record in database
    const configVersion = platformConfig.updated_at || new Date().toISOString();

    const callRecord = await CallService.createCall(clinicId, {
      id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      clinic_id: clinicId,
      patient_id: patient?.id,
      agent_id: agent.id,
      direction: 'inbound',
      start_time: new Date().toISOString(),
      duration_seconds: 0,
      status: 'in_progress',
      outcome: 'IN_PROGRESS',
      active_ai_config_version: configVersion,
      transcript: [
        {
          speaker: 'ai',
          text: agent.greeting,
          timestamp: '00:00',
        },
      ],
      language_detected: 'English',
      created_at: new Date().toISOString(),
    });

    this.activeSessions.set(sessionId, {
      clinicId,
      callId: callRecord.id,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    });

    let audioBase64: string | undefined = undefined;
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        const ai = new GoogleGenAI({ apiKey });
        const ttsPromise = ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [{ parts: [{ text: agent.greeting }] }],
          config: {
            responseModalities: ['AUDIO'],
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
      }
    } catch {
      // Non-fatal: frontend speech synthesizer or widget will speak
    }

    return {
      sessionId,
      callId: callRecord.id,
      greeting: agent.greeting,
      agentName: agent.name,
      voiceProvider: agent.voice_provider,
      audioBase64,
      patient: patient
        ? {
            id: patient.id,
            name: patient.name,
            phone: patient.phone,
          }
        : null,
    };
  }

  public async handleCallMessage(
    clinicId: string,
    sessionId: string,
    callId: string,
    userText: string,
    history: Array<{ speaker: 'ai' | 'patient'; text: string; timestamp: string }>,
    durationSeconds: number = 0
  ) {
    const platformConfig = await AiConfigService.getPlatformAiConfig();
    const provider = this.getProvider(platformConfig.provider || 'gemini_live');
    const agent = await AiAgentService.getAgentByClinic(clinicId);

    const formattedHistory = history.map((h) => ({
      role: (h.speaker === 'patient' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: h.text,
    }));

    let fullSystemInstruction: string | undefined = undefined;
    try {
      fullSystemInstruction = await buildHierarchicalSystemInstruction(
        clinicId,
        agent?.name || 'Ava',
        agent?.instructions_note
      );
    } catch {
      // Non-fatal
    }

    const result = await provider.processUserMessage(
      sessionId,
      userText,
      formattedHistory,
      async (toolName, args) => {
        return await executeVoiceTool(clinicId, toolName, args);
      },
      {
        clinicId,
        agentName: agent?.name || 'Ava',
        systemInstruction: fullSystemInstruction,
      }
    );

    // Update database call record
    const call = await CallService.getCallById(clinicId, callId);
    if (call) {
      const updatedTranscript = [
        ...call.transcript,
        {
          speaker: 'patient' as const,
          text: userText,
          timestamp: `${Math.floor(durationSeconds / 60)
            .toString()
            .padStart(2, '0')}:${(durationSeconds % 60).toString().padStart(2, '0')}`,
        },
        {
          speaker: 'ai' as const,
          text: result.replyText,
          timestamp: `${Math.floor((durationSeconds + 3) / 60)
            .toString()
            .padStart(2, '0')}:${((durationSeconds + 3) % 60).toString().padStart(2, '0')}`,
        },
      ];

      // Check if tool resulted in appointment booking or escalation
      let outcome = call.outcome;
      let appointmentId = call.appointment_id;
      let escalationId = call.escalation_id;
      let patientId = call.patient_id;

      for (const tc of result.toolCallsExecuted) {
        if (tc.name === 'createAppointment' && tc.result?.appointment_id && tc.result?.success) {
          outcome = 'APPOINTMENT_BOOKED';
          appointmentId = tc.result.appointment_id;
        } else if (tc.name === 'rescheduleAppointment' && tc.result?.success) {
          outcome = 'APPOINTMENT_RESCHEDULED';
        } else if (tc.name === 'cancelAppointment' && tc.result?.success) {
          outcome = 'APPOINTMENT_CANCELLED';
        } else if (tc.name === 'escalateToStaff' && tc.result?.escalated) {
          outcome = 'ESCALATED';
          escalationId = tc.result.escalation_id;
        } else if (tc.name === 'getPatientByPhone' && tc.result?.patient_id) {
          patientId = tc.result.patient_id;
        } else if (tc.name === 'createPatient' && tc.result?.patient_id) {
          patientId = tc.result.patient_id;
        }
      }

      await CallService.updateCall(clinicId, callId, {
        transcript: updatedTranscript,
        duration_seconds: durationSeconds,
        outcome,
        appointment_id: appointmentId,
        escalation_id: escalationId,
        patient_id: patientId,
      });
    }

    if (result.usage && agent) {
      /* db.logAiUsage block removed */
    }

    return {
      ...result,
      reply: result.replyText,
      toolCalls: result.toolCallsExecuted,
    };
  }

  public async finishCall(clinicId: string, callId: string, durationSeconds: number, summary?: string, sessionId?: string) {
    const call = await CallService.getCallById(clinicId, callId);
    if (!call) return;

    let finalSummary = summary;
    if (!finalSummary) {
      const messagesCount = call.transcript.length;
      finalSummary = `Call completed (${Math.round(durationSeconds)}s). Outcome: ${call.outcome}. ${messagesCount} messages exchanged.`;
    }

    await CallService.updateCall(clinicId, callId, {
      status: call.outcome === 'ESCALATED' ? 'escalated' : 'completed',
      outcome: call.outcome === 'IN_PROGRESS' ? 'COMPLETED' : call.outcome,
      duration_seconds: durationSeconds,
      end_time: new Date().toISOString(),
      summary: finalSummary,
    });

    // Cleanup transient session memory and provider session
    if (sessionId) {
      this.activeSessions.delete(sessionId);
    } else {
      for (const [sId, sess] of this.activeSessions.entries()) {
        if (sess.callId === callId && sess.clinicId === clinicId) {
          this.activeSessions.delete(sId);
          break;
        }
      }
    }
  }
}

export const voiceEngine = new VoiceEngineManager();
