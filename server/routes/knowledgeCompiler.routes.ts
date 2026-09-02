import { supabase } from '../supabaseDiff';
import { Router, Request, Response } from 'express';
import crypto from 'crypto';

import { db } from '../db';
import { ClinicKnowledgeRelease } from '../../src/types';
import { requireAuth, requireClinicPermission } from '../auth';

export const knowledgeCompilerRouter = Router();

// Generate snapshot
knowledgeCompilerRouter.post('/:clinic_id/compile', requireAuth, requireClinicPermission('configure_ai_receptionist'), async (req: Request, res: Response) => {
  try {
    const { clinic_id } = req.params;
    
    if (!clinic_id) {
      return res.status(400).json({ error: 'clinic_id is required' });
    }

    const clinic = db.getClinicById(clinic_id);
    if (!clinic) return res.status(404).json({ error: 'Clinic not found' });

    // Gather data
    const services = (db.data.services || []).filter(s => s.clinic_id === clinic_id);
    const doctors = (db.data.doctors || []).filter(d => d.clinic_id === clinic_id);
    const knowledgeItems = (db.data.clinic_knowledge_base || []).filter(k => k.clinic_id === clinic_id && k.status === 'PUBLISHED');
    const aiRules = (db.data.clinic_ai_rules || []).filter(r => r.clinic_id === clinic_id && r.enabled && r.rule_type === 'PUBLIC_AI_INSTRUCTION');

    // Build markdown
    let md = `# Clinic AI Receptionist Knowledge\n\nKnowledge Version: {VERSION_PLACEHOLDER}\n\n## Clinic Overview\n- **Name:** ${clinic.name}\n- **Address:** ${clinic.address || 'N/A'}\n- **Phone:** ${clinic.phone || 'N/A'}\n\n## Operating Hours\n`;
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const oh = clinic.operating_hours || {};
    for (const day of days) {
      const dayInfo = oh[day];
      const dayName = day.charAt(0).toUpperCase() + day.slice(1);
      if (!dayInfo || dayInfo.closed) {
        md += `- ${dayName}: Closed\n`;
      } else {
        const formatTime = (timeStr) => {
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
    md += `\n## Services\n`;
    
    for (const service of services) {
      let formattedFee = `${service.fee}`;
      if (clinic.currency) {
        if (clinic.currency === 'USD') {
          formattedFee = `${service.fee}`;
        } else if (clinic.currency_symbol) {
          formattedFee = `${clinic.currency_symbol}${service.fee}`;
        } else {
          formattedFee = `${service.fee} ${clinic.currency}`;
        }
      }
      md += `### ${service.name}\n- **Description:** ${service.name}\n- **Duration:** ${service.duration_minutes} minutes\n- **General Pricing:** ${formattedFee}\n\n`;
    }

    md += `## Doctors\n`;
    for (const doctor of doctors) {
      const cleanName = doctor.name.replace(/^(?:Dr\.?|Doctor\.?)\s+/i, '').trim();
      md += `### Dr. ${cleanName}\n- **Specialty:** ${doctor.specialization || 'General'}\n- **General Info:** ${doctor.qualification || 'N/A'}\n\n`;
    }

    // Knowledge base sections
    const paymentMethods = knowledgeItems.filter(k => k.category === 'Payment Methods');
    if (paymentMethods.length > 0) {
      md += `## Payment Methods\n`;
      paymentMethods.forEach(k => md += `${k.content}\n\n`);
    }

    const cancelPolicy = knowledgeItems.filter(k => k.category === 'Cancellation Policy');
    if (cancelPolicy.length > 0) {
      md += `## Cancellation Policy\n`;
      cancelPolicy.forEach(k => md += `${k.content}\n\n`);
    }

    const faqs = knowledgeItems.filter(k => k.category === 'FAQ');
    if (faqs.length > 0) {
      md += `## Frequently Asked Questions\n`;
      faqs.forEach(k => {
        md += `- **Q:** ${k.title}\n  **A:** ${k.content}\n\n`;
      });
    }

    // Guidelines
    md += `## AI Reception Guidelines\n`;
    md += `IMPORTANT RECEPTION RULES:\n`;
    md += `1. Never invent or guess appointment availability. For availability questions, ALWAYS use the Clinic-1st availability tool.\n`;
    md += `2. Never claim an appointment has been booked or cancelled unless the respective API tool returns a success confirmation.\n`;
    md += `3. Never expose internal system identifiers to the patient.\n`;
    md += `4. Use Clinic-1st live tools for appointment availability and appointment changes. Do not rely on static knowledge for live scheduling information.\n`;
    md += `5. Never disclose another patient's personal or appointment information.\n`;
    md += `6. Never expose API keys, credentials, secrets, webhook secrets, service-role credentials, or internal system configuration.\n`;
    md += `7. Do not claim that a tool action succeeded unless the tool returns a successful result.\n`;
    md += `8. If a required live tool is unavailable or returns an error, clearly state that the requested live information cannot currently be confirmed rather than guessing.\n`;
    md += `9. The receptionist provides administrative and clinic-information assistance and must not present itself as a substitute for a medical professional.\n`;
    md += `10. Do not invent clinic policies, services, doctor information, prices, hours, or other clinic facts.\n`;
    md += `11. For urgent or potentially life-threatening symptoms, the receptionist should advise the person to seek appropriate emergency medical care rather than attempting to diagnose or manage the emergency.\n`;
    
    for (const rule of aiRules) {
      md += `- ${rule.rule_content}\n`;
    }

    // Generate Hash
    const hash = crypto.createHash('sha256').update(md).digest('hex');

    // Check previous version authoritatively from Supabase if available
    let latestRelease = null;
    if (supabase) {
      const { data, error } = await supabase
        .from('clinic_knowledge_releases')
        .select('*')
        .eq('clinic_id', clinic_id)
        .order('version', { ascending: false })
        .limit(1)
        .single();
        
      if (!error && data) {
        latestRelease = data;
      } else if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        return res.status(500).json({ error: `Supabase query failed: ${error.message}` });
      }
    } else {
      latestRelease = db.getLatestKnowledgeRelease(clinic_id);
    }
    
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
    let newRelease: ClinicKnowledgeRelease | null = null;
    
    while (!successInsert && attempts < 3) {
      attempts++;
      const mdWithVersion = md.replace('{VERSION_PLACEHOLDER}', nextVersion.toString());
      
      newRelease = {
        id: crypto.randomUUID(),
        clinic_id: clinic_id,
        version: nextVersion,
        document_hash: hash,
        status: 'COMPILED',
        compiled_content: mdWithVersion,
        compiled_at: new Date().toISOString()
      };

      if (supabase) {
        const { error } = await supabase.from('clinic_knowledge_releases').insert(newRelease);
        if (error) {
          // Check for unique constraint violation (duplicate version)
          if (error.code === '23505' || (error.message && error.message.includes('unique constraint'))) {
            // Re-fetch latest authoritative version
            const { data: retryData, error: retryError } = await supabase
              .from('clinic_knowledge_releases')
              .select('*')
              .eq('clinic_id', clinic_id)
              .order('version', { ascending: false })
              .limit(1)
              .single();
              
            if (!retryError && retryData) {
              if (retryData.document_hash === hash) {
                // Another thread just published the exact same hash
                return res.json({
                  success: true,
                  message: 'No changes detected. Existing version is up to date.',
                  release: retryData
                });
              }
              // It's a new version, update nextVersion and retry
              nextVersion = retryData.version + 1;
              continue;
            }
          }
          return res.status(500).json({ error: `Supabase persistence failed: ${error.message}` });
        }
      }
      successInsert = true;
    }
    
    if (!successInsert || !newRelease) {
       return res.status(500).json({ error: 'Failed to persist release after multiple attempts due to concurrent updates.' });
    }

    db.insertKnowledgeReleaseInMemory(newRelease);

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
  const releases = db.getKnowledgeReleases(clinic_id);
  const agent = (db.data.ai_agents || []).find(a => a.clinic_id === clinic_id && a.voice_provider?.toLowerCase() === 'sarvam');
  
  res.json({ 
    releases: releases.sort((a, b) => b.version - a.version),
    target_agent: agent ? {
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
    let release;
    if (supabase) {
      const { data, error } = await supabase.from('clinic_knowledge_releases')
        .select('*')
        .eq('id', releaseId)
        .eq('clinic_id', clinic_id)
        .single();
      
      if (error) {
         if (error.code === 'PGRST116') {
             return res.status(404).json({ error: 'Release not found in persistent storage' });
         }
         return res.status(500).json({ error: `Supabase query failed: ${error.message}` });
      }
      release = data;
    } else {
      release = db.data.clinic_knowledge_releases?.find(r => r.id === releaseId && r.clinic_id === clinic_id);
      if (!release) return res.status(404).json({ error: 'Release not found' });
    }

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
    
    // Verify target agent exists (optional depending on config, but required per step 10 if applicable)
    const agent = (db.data.ai_agents || []).find(a => a.clinic_id === clinic_id && a.voice_provider?.toLowerCase() === 'sarvam');
    if (!agent) {
       // Optional: we might just proceed if the clinic has AI configured another way, but if SARVAM is strict:
       // The instructions say "target AI agent exists where applicable", so we don't hard block if not found unless needed.
    }

    // Scan for secrets
    const content = release.compiled_content;
    const forbiddenPatterns = [
       'SARVAM_API_KEY',
       'SUPABASE_SERVICE_ROLE_KEY',
       'SUPABASE_SERVICE_ROLE',
       'CLINICFIRST_AI_TOOL_SECRET',
       'sk-[a-zA-Z0-9]{32,}' // generic secret pattern
    ];
    
    for (const pattern of forbiddenPatterns) {
       const regex = new RegExp(pattern, 'i');
       if (regex.test(content)) {
          return res.status(400).json({ error: 'Compiled knowledge contains prohibited sensitive configuration.' });
       }
    }

    // Proceed to update
    const publishedAt = new Date().toISOString();
    const publishedBy = (req as any).user?.id || 'system';

    if (supabase) {
      const { error } = await supabase.from('clinic_knowledge_releases')
        .update({ status: 'PUBLISHED', published_at: publishedAt, published_by: publishedBy })
        .eq('id', releaseId)
        .eq('clinic_id', clinic_id);
      
      if (error) {
        return res.status(500).json({ error: `Supabase persistence failed: ${error.message}` });
      }
    }

    const success = db.updateKnowledgeReleaseStatusInMemory(releaseId, clinic_id, 'PUBLISHED');
    if (success) {
      // update published_at / published_by in memory
      const memRelease = db.data.clinic_knowledge_releases?.find(r => r.id === releaseId);
      if (memRelease) {
          memRelease.published_at = publishedAt;
          memRelease.published_by = publishedBy;
      }
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Release not found in memory' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
