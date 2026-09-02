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
    let md = `# Clinic AI Receptionist Knowledge\n\nKnowledge Version: {VERSION_PLACEHOLDER}\n\n## Clinic Overview\n- **Name:** ${clinic.name}\n- **Address:** ${clinic.address || 'N/A'}\n- **Phone:** ${clinic.phone || 'N/A'}\n\n## Operating Hours\n${JSON.stringify(clinic.operating_hours || {}, null, 2)}\n\n## Services\n`;
    
    for (const service of services) {
      md += `### ${service.name}\n- **Description:** ${service.name}\n- **Duration:** ${service.duration_minutes} minutes\n- **General Pricing:** ${service.fee}\n\n`;
    }

    md += `## Doctors\n`;
    for (const doctor of doctors) {
      md += `### Dr. ${doctor.name}\n- **Specialty:** ${doctor.specialization || 'General'}\n- **General Info:** ${doctor.qualification || 'N/A'}\n\n`;
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
  res.json({ releases: releases.sort((a, b) => b.version - a.version) });
});

// Mark published
knowledgeCompilerRouter.post('/:clinic_id/releases/:releaseId/publish', requireAuth, requireClinicPermission('configure_ai_receptionist'), async (req: Request, res: Response) => {
  try {
    const { clinic_id, releaseId } = req.params;
    
    if (supabase) {
      const { error } = await supabase.from('clinic_knowledge_releases')
        .update({ status: 'PUBLISHED', published_at: new Date().toISOString() })
        .eq('id', releaseId)
        .eq('clinic_id', clinic_id);
      
      if (error) {
        return res.status(500).json({ error: `Supabase persistence failed: ${error.message}` });
      }
    }

    const success = db.updateKnowledgeReleaseStatusInMemory(releaseId, clinic_id, 'PUBLISHED');
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Release not found' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
