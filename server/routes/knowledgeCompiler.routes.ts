import { KnowledgeService } from "../services/knowledge.service";
import { supabase } from '../supabaseDiff';
import { Router, Request, Response } from 'express';
import crypto from 'crypto';

import { db } from '../db';
import { ClinicService } from '../services/clinic.service';
import { UserService } from '../services/user.service';
import { AppointmentService } from '../services/appointment.service';
import { PatientService } from '../services/patient.service';
import { DoctorService } from '../services/doctor.service';
import { ServiceService } from '../services/service.service';
import { AiAgentService } from '../services/ai-agent.service';
import { AiConfigService } from '../services/ai-config.service';
import { ClinicKnowledgeRelease } from '../../src/types';
import { requireAuth, requireClinicPermission } from '../auth';

export const knowledgeCompilerRouter = Router();

export async function buildClinicKnowledgeMarkdown(clinicId: string): Promise<string> {
  const clinic = await ClinicService.getById(clinicId);
  if (!clinic) throw new Error(`Clinic not found: ${clinicId}`);

  const platformConfig = await AiConfigService.getPlatformAiConfig();
  const services = await ServiceService.list(clinicId, { status: 'ACTIVE' });
  const doctors = await DoctorService.list(clinicId, { status: 'ACTIVE' });
  const knowledgeItems = await KnowledgeService.listClinicKnowledge(clinicId, 'PUBLISHED');
  const aiRules = await AiConfigService.getClinicAiRules(clinicId, { enabledOnly: true, ruleType: 'PUBLIC_AI_INSTRUCTION' });

  // 1. Header & Knowledge Metadata
  let md = `# Clinic AI Receptionist Knowledge\n\n`;
  md += `## Knowledge Metadata\n`;
  md += `- **Clinic Name:** ${clinic.name}\n`;
  md += `- **Knowledge Version:** {VERSION_PLACEHOLDER}\n`;
  md += `- **Generated At:** {TIMESTAMP_PLACEHOLDER}\n`;
  md += `- **Snapshot Type:** Clinic-specific\n`;
  md += `- **Source:** Clinic-1st\n\n`;

  // 2. Section 1: Platform AI Receptionist Rules (Global, Platform-Governed)
  md += `## 1. Platform AI Receptionist Rules\n\n`;
  md += `### Role & Persona\n`;
  md += `${platformConfig.role_definition || 'You are the verified AI Receptionist for this medical clinic.'}\n\n`;

  md += `### Medical Safety Boundaries\n`;
  md += `- Under no circumstances will the AI receptionist provide a medical diagnosis, evaluate clinical conditions, suggest treatments, or prescribe medication.\n`;
  md += `- The AI receptionist is an administrative receptionist, not a doctor or clinical provider.\n\n`;

  md += `### Emergency Triage Protocols\n`;
  md += `- For urgent or life-threatening symptoms (e.g., acute chest pain, severe shortness of breath, major trauma, stroke symptoms, uncontrolled bleeding), immediately instruct the caller to dial emergency services (911/112/local emergency) or proceed to the nearest emergency department.\n`;
  md += `- Trigger immediate human staff escalation for any emergency presentation.\n\n`;

  md += `### Anti-Hallucination & Truthfulness Mandate\n`;
  md += `- Never invent, guess, or assume available appointment slots, doctor schedules, clinic policies, fees, or operating hours.\n`;
  md += `- Use only verified clinic facts and real-time database tool outputs.\n\n`;

  md += `### Deterministic Tool Execution & Verification\n`;
  md += `- Never state or imply that an appointment has been booked, rescheduled, or cancelled unless the respective Clinic-1st database tool execution returns a verified success confirmation.\n`;
  md += `- If a required live tool is unavailable or returns an error, state clearly that the request cannot currently be confirmed and offer staff assistance.\n\n`;

  md += `### Tenant Isolation & Patient Data Privacy\n`;
  md += `- Represent ONLY ${clinic.name} and never acknowledge or access data belonging to any other clinic.\n`;
  md += `- Never disclose personal health information, appointment history, or contact details of other patients.\n`;
  md += `- Never disclose internal system identifiers, database keys, webhook secrets, or API tokens.\n\n`;

  md += `### Patient Identification & Registration Standards\n`;
  md += `- Identify returning patients by registered mobile phone number.\n`;
  md += `- If a caller is not found in the patient master, collect their full name and phone number to register their record before booking.\n\n`;

  md += `### Unknown Information & Communication Guidelines\n`;
  md += `- If an answer is not provided in verified clinic facts or live tools, politely explain that the information is unavailable and offer to escalate to clinic staff.\n`;
  md += `- Maintain a warm, polite, concise, and professional tone at all times. Ask one question at a time.\n\n`;

  // 3. Section 2: Clinic-Specific AI Rules & Workflow (Tenant-Scoped & Published Only)
  md += `## 2. Clinic-Specific AI Rules & Workflow\n\n`;

  const arrivalItems = knowledgeItems.filter((k) => k.category === 'ARRIVAL');
  if (arrivalItems.length > 0) {
    md += `### Patient Arrival & Check-In Protocol\n`;
    arrivalItems.forEach((k) => (md += `#### ${k.title}\n${k.content}\n\n`));
  }

  const paymentItems = knowledgeItems.filter(
    (k) => k.category === 'PAYMENT' || k.category === 'Payment Methods'
  );
  if (paymentItems.length > 0) {
    md += `### Payment & Billing Policies\n`;
    paymentItems.forEach((k) => (md += `#### ${k.title}\n${k.content}\n\n`));
  }

  const cancelItems = knowledgeItems.filter(
    (k) => k.category === 'CANCELLATION' || k.category === 'Cancellation Policy'
  );
  if (cancelItems.length > 0) {
    md += `### Cancellation & Rescheduling Policy\n`;
    cancelItems.forEach((k) => (md += `#### ${k.title}\n${k.content}\n\n`));
  }

  const registrationItems = knowledgeItems.filter((k) => k.category === 'REGISTRATION');
  if (registrationItems.length > 0) {
    md += `### Patient Identification & Registration Policy\n`;
    registrationItems.forEach((k) => (md += `#### ${k.title}\n${k.content}\n\n`));
  }

  const workflowItems = knowledgeItems.filter((k) => k.category === 'WORKFLOW');
  if (workflowItems.length > 0) {
    md += `### Specialty Clinical Workflows\n`;
    workflowItems.forEach((k) => (md += `#### ${k.title}\n${k.content}\n\n`));
  }

  const policyItems = knowledgeItems.filter((k) => k.category === 'CLINIC_POLICY');
  if (policyItems.length > 0) {
    md += `### Clinic Policies\n`;
    policyItems.forEach((k) => (md += `#### ${k.title}\n${k.content}\n\n`));
  }

  const escalationItems = knowledgeItems.filter((k) => k.category === 'ESCALATION');
  if (escalationItems.length > 0) {
    md += `### Clinic Escalation Protocols\n`;
    escalationItems.forEach((k) => (md += `#### ${k.title}\n${k.content}\n\n`));
  }

  const commItems = knowledgeItems.filter((k) => k.category === 'COMMUNICATION');
  if (commItems.length > 0) {
    md += `### Communication Guidelines\n`;
    commItems.forEach((k) => (md += `#### ${k.title}\n${k.content}\n\n`));
  }

  const otherItems = knowledgeItems.filter(
    (k) =>
      k.category === 'OTHER_APPROVED_CLINIC_RULE' ||
      (k.category &&
        ![
          'ARRIVAL',
          'PAYMENT',
          'Payment Methods',
          'CANCELLATION',
          'Cancellation Policy',
          'REGISTRATION',
          'WORKFLOW',
          'CLINIC_POLICY',
          'ESCALATION',
          'COMMUNICATION',
          'FAQ',
        ].includes(k.category))
  );
  if (otherItems.length > 0) {
    md += `### Additional Approved Clinic Rules\n`;
    otherItems.forEach((k) => (md += `#### ${k.title}\n${k.content}\n\n`));
  }

  if (knowledgeItems.length === 0) {
    md += `Standard clinic operational workflow applies.\n\n`;
  }

  // 4. Section 3: Clinic Information (Authoritative Clinic Records)
  md += `## 3. Clinic Information\n\n`;
  md += `- **Name:** ${clinic.name}\n`;
  md += `- **Address:** ${clinic.address || 'N/A'}${clinic.city ? ', ' + clinic.city : ''}\n`;
  md += `- **Phone:** ${clinic.phone || 'N/A'}\n`;
  if (clinic.email) md += `- **Email:** ${clinic.email}\n`;
  if (clinic.timezone) md += `- **Timezone:** ${clinic.timezone}\n`;
  md += `\n### Operating Hours\n`;
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const oh = clinic.operating_hours || {};
  for (const day of days) {
    const dayInfo = oh[day];
    const dayName = day.charAt(0).toUpperCase() + day.slice(1);
    if (!dayInfo || dayInfo.closed) {
      md += `- ${dayName}: Closed\n`;
    } else {
      const formatTime = (timeStr: string) => {
        if (!timeStr) return '';
        const [hours, minutes] = timeStr.split(':');
        let h = parseInt(hours, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        h = h ? h : 12;
        return `${h}:${minutes} ${ampm}`;
      };
      const openStr = formatTime(dayInfo.open);
      const closeStr = formatTime(dayInfo.close);
      if (openStr && closeStr) {
        md += `- ${dayName}: ${openStr} – ${closeStr}\n`;
      } else {
        md += `- ${dayName}: Closed\n`;
      }
    }
  }
  md += `\n`;

  // 5. Section 4: Services (Authoritative Services Records)
  md += `## 4. Services\n\n`;
  for (const service of services) {
    let formattedFee = `${service.fee}`;
    if (clinic.currency) {
      if (clinic.currency === 'USD') {
        formattedFee = `$${service.fee}`;
      } else if (clinic.currency_symbol) {
        formattedFee = `${clinic.currency_symbol}${service.fee}`;
      } else {
        formattedFee = `${service.fee} ${clinic.currency}`;
      }
    }
    md += `### ${service.name}\n`;
    md += `- **Duration:** ${service.duration_minutes} minutes\n`;
    md += `- **General Pricing:** ${formattedFee}\n\n`;
  }

  // 6. Section 5: Doctors (Authoritative Doctors Records)
  md += `## 5. Doctors\n\n`;
  for (const doctor of doctors) {
    const cleanName = doctor.name.replace(/^(?:Dr\.?|Doctor\.?)\s+/i, '').trim();
    md += `### Dr. ${cleanName}\n`;
    md += `- **Specialty:** ${doctor.specialization || 'General'}\n`;
    md += `- **General Info:** ${doctor.qualification || 'N/A'}\n\n`;
  }

  // 7. Section 6: Static Receptionist Knowledge & FAQs
  const faqs = knowledgeItems.filter((k) => k.category === 'FAQ');
  if (faqs.length > 0 || aiRules.length > 0) {
    md += `## 6. Static Receptionist Knowledge & FAQs\n\n`;
    faqs.forEach((k) => {
      md += `- **Q:** ${k.title}\n  **A:** ${k.content}\n\n`;
    });
    for (const rule of aiRules) {
      md += `- ${rule.rule_content}\n`;
    }
    md += `\n`;
  }

  // 8. Section 7: Live Data & Tool Rules
  md += `## 7. Live Data & Tool Rules\n\n`;
  md += `- **Live Appointment Availability:** Real-time doctor availability and open slots MUST be retrieved via the Clinic-1st availability tool. Never rely on static markdown for real-time schedule state.\n`;
  md += `- **Live Booking & Modifications:** Appointment creation, rescheduling, and cancellation MUST be performed through Clinic-1st database tools.\n`;
  md += `- **Deterministic Validation:** Availability, leave, and double-booking checks are calculated authoritatively by the backend.\n`;
  md += `- **Confirmation Protocol:** Before final booking, verify Patient Name, Doctor, Service, Date, and Time with the caller.\n`;

  return md;
}

// Generate snapshot
knowledgeCompilerRouter.post('/:clinic_id/compile', requireAuth, requireClinicPermission('configure_ai_receptionist'), async (req: Request, res: Response) => {
  try {
    const { clinic_id } = req.params;
    
    if (!clinic_id) {
      return res.status(400).json({ error: 'clinic_id is required' });
    }

    const clinic = await ClinicService.getById(clinic_id);
    if (!clinic) return res.status(404).json({ error: 'Clinic not found' });

    // Build structured markdown
    const md = await buildClinicKnowledgeMarkdown(clinic_id);

    // Generate Hash
    const hash = crypto.createHash('sha256').update(md).digest('hex');

    // Check previous version authoritatively from Supabase if available
    let latestRelease = await KnowledgeService.getLatestKnowledgeRelease(clinic_id);
    
    if (latestRelease && latestRelease.document_hash === hash) {
      return res.json({
        success: true,
        message: 'No changes detected. Existing version is up to date.',
        release: latestRelease
      });
    }

    let nextVersion = latestRelease ? latestRelease.version + 1 : 1;
    let successInsert = false;
    let attempts = 0;
    let newRelease = null;
    
    while (!successInsert && attempts < 3) {
      attempts++;
      const compiledAt = new Date().toISOString();
      const mdWithVersion = md
        .replace('{VERSION_PLACEHOLDER}', nextVersion.toString())
        .replace('{TIMESTAMP_PLACEHOLDER}', compiledAt);
        
      newRelease = {
        id: crypto.randomUUID(),
        version: nextVersion,
        document_hash: hash,
        status: 'COMPILED' as const,
        compiled_content: mdWithVersion,
        compiled_at: compiledAt
      };

      try {
        newRelease = await KnowledgeService.createKnowledgeRelease(clinic_id, newRelease);
        successInsert = true;
      } catch (e: any) {
        if (e.message && (e.message.includes('duplicate key value') || e.message.includes('23505'))) {
          // Re-fetch latest
          const retryData = await KnowledgeService.listKnowledgeReleases(clinic_id);
          const topRetry = retryData[0];
          if (topRetry && topRetry.document_hash === hash) {
            return res.json({
              success: true,
              message: 'No changes detected. Existing version is up to date.',
              release: topRetry
            });
          }
          if (topRetry) {
             nextVersion = topRetry.version + 1;
             continue;
          }
        }
        return res.status(500).json({ error: `Persistence failed: ${e.message}` });
      }
    }
    
    if (!successInsert || !newRelease) {
       return res.status(500).json({ error: 'Failed to persist release after multiple attempts due to concurrent updates.' });
    }

    res.json({
      success: true,
      release: newRelease
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get latest releases
knowledgeCompilerRouter.get('/:clinic_id/releases', requireAuth, requireClinicPermission('view_ai_receptionist'), async (req: Request, res: Response) => {
  const { clinic_id } = req.params;
  const releases = await KnowledgeService.listKnowledgeReleases(clinic_id);
  const agent = await AiAgentService.getAgentByClinic(clinic_id);
  const isSarvam = agent?.voice_provider?.toLowerCase() === 'sarvam';
  
  res.json({ 
    releases: releases.sort((a, b) => b.version - a.version),
    target_agent: (agent && isSarvam) ? {
      name: agent.name,
      provider: agent.voice_provider,
      provider_agent_id: agent.provider_agent_id ? '***' + agent.provider_agent_id.slice(-4) : undefined,
      enabled: agent.enabled
    } : null
  });
});

// Mark published
knowledgeCompilerRouter.post('/:clinic_id/releases/:releaseId/publish', requireAuth, requireClinicPermission('configure_ai_receptionist'), async (req: Request, res: Response) => {
  try {
    const { clinic_id, releaseId } = req.params;
    
    // Server-side validations
    const release = await KnowledgeService.getKnowledgeRelease(clinic_id, releaseId);
    if (!release) return res.status(404).json({ error: 'Release not found' });
    
    if (release.status === 'PUBLISHED') {
       return res.status(409).json({ error: 'Release is already published' });
    }

    if (release.status !== 'COMPILED') {
       return res.status(400).json({ error: 'Release must be in COMPILED status' });
    }

    if (!release.compiled_content) {
       return res.status(400).json({ error: 'Release missing compiled content' });
    }

    if (!release.document_hash) {
       return res.status(400).json({ error: 'Release missing document hash' });
    }
    
    const content = release.compiled_content;
    const forbiddenPatterns = [
       'SARVAM_API_KEY',
       'SUPABASE_SERVICE_ROLE_KEY',
       'SUPABASE_SERVICE_ROLE',
       'CLINICFIRST_AI_TOOL_SECRET',
       'sk-[a-zA-Z0-9]{32,}'
    ];
    
    for (const pattern of forbiddenPatterns) {
       const regex = new RegExp(pattern, 'i');
       if (regex.test(content)) {
          return res.status(400).json({ error: 'Compiled knowledge contains prohibited sensitive configuration.' });
       }
    }

    const publishedBy = (req as any).user?.id || 'system';
    await KnowledgeService.updateKnowledgeReleaseStatus(clinic_id, releaseId, 'PUBLISHED', publishedBy);
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
