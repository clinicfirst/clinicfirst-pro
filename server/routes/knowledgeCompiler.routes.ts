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

    // Check previous version
    const latestRelease = db.getLatestKnowledgeRelease(clinic_id);
    
    if (latestRelease && latestRelease.document_hash === hash) {
      return res.json({
        success: true,
        message: 'No changes detected. Existing version is up to date.',
        release: latestRelease
      });
    }

    const nextVersion = latestRelease ? latestRelease.version + 1 : 1;
    md = md.replace('{VERSION_PLACEHOLDER}', nextVersion.toString());
    
    // Re-hash with version string
    const finalHash = hash;

    const newRelease: ClinicKnowledgeRelease = {
      id: crypto.randomUUID(),
      clinic_id: clinic_id,
      version: nextVersion,
      document_hash: finalHash,
      status: 'COMPILED',
      compiled_content: md,
      compiled_at: new Date().toISOString()
    };

    if (supabase) {
      const { error } = await supabase.from('clinic_knowledge_releases').insert(newRelease);
      if (error) {
        return res.status(500).json({ error: `Supabase persistence failed: ${error.message}` });
      }
    }
    db.insertKnowledgeRelease(newRelease);

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

    const success = db.updateKnowledgeReleaseStatus(releaseId, clinic_id, 'PUBLISHED');
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Release not found' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
