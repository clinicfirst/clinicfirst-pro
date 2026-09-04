import { ClinicService } from '../services/clinic.service';
import { UserService } from '../services/user.service';
import { AppointmentService } from '../services/appointment.service';
import { PatientService } from '../services/patient.service';
import { DoctorService } from '../services/doctor.service';
import { KnowledgeService } from "../services/knowledge.service";
import { AuditService } from "../services/audit.service";
import { CallService } from "../services/call.service";
import { Router, Response } from 'express';
import { db, hashPassword } from '../db';
import { requireAuth, requirePlatformAdmin, AuthenticatedRequest } from '../auth';
import { Clinic, User, OperatingHours } from '../../src/types';
import { generateSafeGreeting } from '../services/aiValidator';
import { StaffService } from '../services/staff.service';
import { ServiceService } from '../services/service.service';
import { AiAgentService } from '../services/ai-agent.service';
import { AiConfigService } from '../services/ai-config.service';

export const platformRouter = Router();

platformRouter.use(requireAuth);
platformRouter.use(requirePlatformAdmin);

// Platform Dashboard Metrics
platformRouter.get('/dashboard', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinics = await ClinicService.list();
    const today = new Date().toISOString().split('T')[0];

    let totalDoctors = 0;
    let totalTodayAppointments = 0;
    let totalTodayCalls = 0;

    for (const c of clinics) {
      const doctors = await DoctorService.list(c.id, { status: 'ACTIVE' });
      totalDoctors += doctors.length;

      const apts = await AppointmentService.list(c.id, { date: today });
      totalTodayAppointments += apts.length;

      const calls = (await CallService.listCalls(c.id)).filter((call) => call.created_at.startsWith(today));
      totalTodayCalls += calls.length;
    }

    const activeClinics = clinics.filter((c) => c.status === 'ACTIVE').length;
    const recentClinics = [...clinics]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);

    const recentAuditLogs = (await AuditService.listAuditLogs()).slice(0, 8);

    return res.json({
      metrics: {
        totalClinics: clinics.length,
        activeClinics,
        totalDoctors,
        todayAppointments: totalTodayAppointments,
        todayAiCalls: totalTodayCalls,
      },
      recentClinics,
      recentActivity: recentAuditLogs,
    });
  } catch (err: any) {
    console.error('[GET /platform/dashboard] Error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to load platform dashboard metrics.' });
  }
});

// List all clinics
platformRouter.get('/clinics', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawClinics = await ClinicService.list();
    const clinics = await Promise.all(
      rawClinics.map(async (c) => {
        const doctors = await DoctorService.list(c.id);
        const staff = await StaffService.listAll(c.id);
        const agent = await AiAgentService.getAgentByClinic(c.id);
        return {
          ...c,
          doctorsCount: doctors.filter((d) => d.status === 'ACTIVE').length,
          staffCount: staff.filter((s) => s.status === 'ACTIVE').length,
          aiAgentStatus: agent?.status || 'INACTIVE',
        };
      })
    );

    return res.json({ clinics });
  } catch (err: any) {
    console.error('[GET /platform/clinics] Error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to load clinics.' });
  }
});

// Create a new Clinic + Clinic Admin (§3 Step 2)
platformRouter.post('/clinics', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      name,
      address,
      phone,
      email,
      website,
      city,
      timezone,
      currency,
      currency_symbol,
      operating_hours,
      adminName,
      adminEmail,
      adminPassword,
    } = req.body;

    if (!name || !phone || !email || !city || !adminName || !adminEmail || !adminPassword) {
      return res.status(400).json({
        error: 'Missing required fields: clinic name, phone, email, city, admin name, admin email, and admin password are required.',
      });
    }

    // Check if admin email is already registered
    const existingUser = await StaffService.getByEmail(adminEmail);
    if (existingUser) {
      return res.status(400).json({ error: `A user with email ${adminEmail} already exists.` });
    }

    const now = new Date().toISOString();
    const clinicId = `clinic_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const defaultOperatingHours: OperatingHours = operating_hours || {
      monday: { open: '09:00', close: '17:00', closed: false },
      tuesday: { open: '09:00', close: '17:00', closed: false },
      wednesday: { open: '09:00', close: '17:00', closed: false },
      thursday: { open: '09:00', close: '17:00', closed: false },
      friday: { open: '09:00', close: '17:00', closed: false },
      saturday: { open: '09:00', close: '13:00', closed: false },
      sunday: { open: '09:00', close: '13:00', closed: true },
    };

    // 1. Create Clinic
    const newClinic: Clinic = {
      id: clinicId,
      name: name.trim(),
      address: address?.trim() || '',
      phone: phone.trim(),
      email: email.trim(),
      website: website?.trim(),
      city: city.trim(),
      timezone: timezone || 'America/Los_Angeles',
      currency: currency?.trim() || 'USD',
      currency_symbol: currency_symbol?.trim() || '$',
      operating_hours: defaultOperatingHours,
      status: 'ACTIVE',
      created_at: now,
    };
    await ClinicService.create(newClinic);

    // 2. Create Clinic Admin User (tagged with role=CLINIC_ADMIN, clinic_id=clinicId, must_change_password=true)
    const adminCreateResult = await StaffService.create(clinicId, {
      role: 'CLINIC_ADMIN',
      name: adminName.trim(),
      email: adminEmail.trim(),
      phone: phone.trim(),
      status: 'ACTIVE',
      must_change_password: true,
      password_hash: hashPassword(adminPassword),
    });

    if (!adminCreateResult.success || !adminCreateResult.user) {
      return res.status(500).json({ error: adminCreateResult.error || 'Failed to create clinic admin user.' });
    }

    const createdAdmin = adminCreateResult.user;

    // 3. Initialize default AI Receptionist for the clinic
    await AiAgentService.createAgent(clinicId, {
      id: `agent_${clinicId}`,
      clinic_id: clinicId,
      name: `${name} AI Receptionist`,
      greeting: generateSafeGreeting(name),
      voice_provider: 'gemini_live',
      voice_config: {
        voice_name: 'Zephyr',
        temperature: 0.2,
      },
      languages: ['English'],
      status: 'ACTIVE',
      escalation_contact: {
        phone: phone.trim(),
        email: email.trim(),
        name: `${adminName} (Clinic Admin)`,
      },
      instructions_note: 'Please keep responses concise and clear, speak politely, and verify patient details before confirming.',
    });

    // 4. Audit Log
    await AuditService.logAudit({
      clinic_id: clinicId,
      actor_user_id: req.user!.id,
      actor_name: req.user!.name,
      action: 'CLINIC_AND_ADMIN_CREATED',
      target_type: 'CLINIC',
      target_id: clinicId,
      metadata: {
        clinic_name: name,
        admin_email: adminEmail,
      },
    });

    return res.status(201).json({
      success: true,
      clinic: newClinic,
      adminUser: createdAdmin,
    });
  } catch (err: any) {
    console.error('[POST /platform/clinics] Error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to create clinic.' });
  }
});

// Clinic Detail
platformRouter.get('/clinics/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.params.id;
    const clinic = await ClinicService.getById(clinicId);
    if (!clinic) {
      return res.status(404).json({ error: 'Clinic not found.' });
    }

    const doctors = await DoctorService.list(clinicId);
    const staff = await StaffService.listAll(clinicId);
    const services = await ServiceService.list(clinicId);
    const aiAgent = await AiAgentService.getAgentByClinic(clinicId);
    const today = new Date().toISOString().split('T')[0];
    const todayAppointments = await AppointmentService.list(clinicId, { date: today });
    const todayCalls = (await CallService.listCalls(clinicId)).filter((c) => c.created_at.startsWith(today));

    return res.json({
      clinic,
      doctors,
      staff,
      services,
      aiAgent,
      todayCounts: {
        appointments: todayAppointments.length,
        calls: todayCalls.length,
      },
    });
  } catch (err: any) {
    console.error('[GET /platform/clinics/:id] Error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to fetch clinic detail.' });
  }
});

// Update Clinic
platformRouter.put('/clinics/:id', async (req: AuthenticatedRequest, res: Response) => {
  const clinicId = req.params.id;
  const updates = req.body;

  const updated = await ClinicService.update(clinicId, updates);
  if (!updated) {
    return res.status(404).json({ error: 'Clinic not found.' });
  }

  await AuditService.logAudit({
    clinic_id: clinicId,
    actor_user_id: req.user!.id,
    actor_name: req.user!.name,
    action: 'CLINIC_UPDATED_BY_PLATFORM_ADMIN',
    target_type: 'CLINIC',
    target_id: clinicId,
    metadata: updates,
  });

  return res.json({ clinic: updated });
});

// Platform Audit Logs
platformRouter.get('/audit-logs', async (req: AuthenticatedRequest, res: Response) => {
  const logs = await AuditService.listAuditLogs();
  return res.json({ logs });
});

// List all Platform & Clinic Users
platformRouter.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const allUsers = await StaffService.listAll();
    const clinics = await ClinicService.list();
    const clinicMap = new Map(clinics.map((c) => [c.id, c.name]));

    const enrichedUsers = allUsers.map((u) => ({
      ...u,
      clinic_name: u.clinic_id ? clinicMap.get(u.clinic_id) || 'Unknown Clinic' : 'Platform Scope',
    }));

    return res.json({ users: enrichedUsers });
  } catch (err: any) {
    console.error('[GET /platform/users] Error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to list users.' });
  }
});

// Create a Platform User / Admin
platformRouter.post('/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, email, password, role, clinic_id, phone } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required.' });
    }

    const existing = await StaffService.getByEmail(email);
    if (existing) {
      return res.status(400).json({ error: `A user with email ${email} already exists.` });
    }

    const targetClinicId = role === 'PLATFORM_ADMIN' ? null : (clinic_id || null);
    const result = await StaffService.create(targetClinicId, {
      role,
      name: name.trim(),
      email: email.trim(),
      phone: phone?.trim() || '',
      status: 'ACTIVE',
      must_change_password: true,
      password_hash: hashPassword(password),
    });

    if (!result.success || !result.user) {
      return res.status(result.error_code === 'EMAIL_ALREADY_EXISTS' ? 400 : 500).json({
        error: result.error || 'Failed to create user.',
      });
    }

    const created = result.user;

    await AuditService.logAudit({
      clinic_id: created.clinic_id,
      actor_user_id: req.user!.id,
      actor_name: req.user!.name,
      action: 'USER_CREATED_BY_PLATFORM_ADMIN',
      target_type: 'USER',
      target_id: created.id,
      metadata: { email: created.email, role: created.role },
    });

    return res.status(201).json({ user: created });
  } catch (err: any) {
    console.error('[POST /platform/users] Error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to create user.' });
  }
});

// Update Platform or Clinic User
platformRouter.put('/users/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.params.id;
    const updates = req.body;

    // Protect against changing password directly without hash
    if (updates.password) {
      updates.password_hash = hashPassword(updates.password);
      delete updates.password;
    }

    const result = await StaffService.update(userId, updates);
    if (!result.success || !result.user) {
      return res.status(result.error_code === 'USER_NOT_FOUND' ? 404 : 400).json({
        error: result.error || 'User not found.',
      });
    }

    const updated = result.user;

    await AuditService.logAudit({
      clinic_id: updated.clinic_id,
      actor_user_id: req.user!.id,
      actor_name: req.user!.name,
      action: 'USER_UPDATED_BY_PLATFORM_ADMIN',
      target_type: 'USER',
      target_id: userId,
      metadata: updates,
    });

    return res.json({ user: updated });
  } catch (err: any) {
    console.error('[PUT /platform/users/:id] Error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to update user.' });
  }
});

// Platform Settings (In-memory persistent config)
let platformSettings = {
  system_name: 'CLINICFIRST Platform Engine',
  version: '1.0.0',
  tenant_isolation_mode: 'STRICT_RLS',
  default_ai_voice: 'Zephyr',
  default_ai_provider: 'gemini_live',
  default_timezone: 'America/Los_Angeles',
  enforce_password_rotation_days: 90,
  max_failed_logins: 5,
  session_timeout_minutes: 480,
  allow_self_service_onboarding: false,
};

platformRouter.get('/settings', async (req: AuthenticatedRequest, res: Response) => {
  return res.json({ settings: platformSettings });
});

platformRouter.put('/settings', async (req: AuthenticatedRequest, res: Response) => {
  platformSettings = { ...platformSettings, ...req.body };

  await AuditService.logAudit({
    clinic_id: null,
    actor_user_id: req.user!.id,
    actor_name: req.user!.name,
    action: 'PLATFORM_SETTINGS_UPDATED',
    target_type: 'SETTINGS',
    metadata: req.body,
  });

  return res.json({ settings: platformSettings });
});

// Platform AI Configuration (§ Platform Admin Controlled)
platformRouter.get('/ai-config', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const config = await AiConfigService.getPlatformAiConfig();
    return res.json({ config });
  } catch (err: any) {
    console.error('[GET /platform/ai-config] Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve platform AI configuration.' });
  }
});

platformRouter.put('/ai-config', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      provider,
      model,
      voice_provider,
      voice_name,
      temperature,
      status,
      platform_ai_enabled,
      new_api_key,
      remove_api_key,
      role_definition,
      things_to_do,
      things_to_avoid,
      escalation_rules,
      safety_guidelines,
    } = req.body;

    const updated = await AiConfigService.updatePlatformAiConfig({
      provider,
      model,
      voice_provider,
      voice_name,
      temperature: temperature !== undefined ? Number(temperature) : undefined,
      status,
      platform_ai_enabled,
      new_api_key,
      remove_api_key,
      role_definition,
      things_to_do,
      things_to_avoid,
      escalation_rules,
      safety_guidelines,
    });

    await AuditService.logAudit({
      clinic_id: null,
      actor_user_id: req.user!.id,
      actor_name: req.user!.name,
      action: 'PLATFORM_AI_CONFIG_UPDATED',
      target_type: 'AI_CONFIG',
      metadata: {
        provider,
        model,
        status,
        apiKeyChanged: Boolean(new_api_key || remove_api_key),
      },
    });

    return res.json({ config: updated, message: 'Platform AI configuration successfully saved.' });
  } catch (err: any) {
    console.error('[PUT /platform/ai-config] Error:', err);
    return res.status(500).json({ error: 'Failed to update platform AI configuration.' });
  }
});

platformRouter.post('/ai-config/test-connection', async (req: AuthenticatedRequest, res: Response) => {
  const startTime = Date.now();
  const apiKey = await AiConfigService.getRawPlatformAiApiKey();
  const config = await AiConfigService.getPlatformAiConfig();

  if (!apiKey) {
    return res.status(400).json({
      success: false,
      error: 'No API Key configured. Please save a valid Gemini API Key first.',
    });
  }

  try {
    let latencyMs = 0;
    let modelToUse = config.model || 'gemini-3.6-flash';
    let rawOutput = 'OK';

    if (config.provider === 'sarvam') {
      const response = await fetch('https://api.sarvam.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': apiKey,
        },
        body: JSON.stringify({
          model: 'sarvam-105b',
          messages: [{ role: 'user', content: 'Respond with exactly "HEALTH_CHECK_OK"' }]
        }),
      });

      if (!response.ok) {
        throw new Error(`Sarvam API Error: ${response.status} ${response.statusText}`);
      }
      latencyMs = Date.now() - startTime;
    } else {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      if (modelToUse.includes('gemini-2.5')) {
        modelToUse = modelToUse.replace('gemini-2.5', 'gemini-3.6');
      }

      const testResponse = await ai.models.generateContent({
        model: modelToUse,
        contents: 'Respond with exactly "HEALTH_CHECK_OK" to verify connection.',
      });
      latencyMs = Date.now() - startTime;
      rawOutput = testResponse.text?.trim() || 'OK';
    }

    return res.json({
      success: true,
      provider: config.provider,
      model: config.provider === 'sarvam' ? 'sarvam-105b' : modelToUse,
      latencyMs,
      message: `Connection successful. Model '${config.provider === 'sarvam' ? 'sarvam-105b' : modelToUse}' responded in ${latencyMs}ms.`,
      rawOutput,
    });
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return res.status(500).json({
      success: false,
      latencyMs,
      error: err.message || 'Failed to connect to AI provider API.',
    });
  }
});

platformRouter.post('/ai-config/remove-key', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = await AiConfigService.updatePlatformAiConfig({ remove_api_key: true });
    await AuditService.logAudit({
      clinic_id: null,
      actor_user_id: req.user!.id,
      actor_name: req.user!.name,
      action: 'PLATFORM_AI_KEY_REMOVED',
      target_type: 'AI_CONFIG',
    });
    return res.json({ config: updated, message: 'Platform API key removed.' });
  } catch (err: any) {
    console.error('[POST /platform/ai-config/remove-key] Error:', err);
    return res.status(500).json({ error: 'Failed to remove platform API key.' });
  }
});

// Platform Knowledge Base Endpoints
platformRouter.get('/knowledge-base', async (req: AuthenticatedRequest, res: Response) => {
  const { category, search, active_only } = req.query;
  let items = await KnowledgeService.listPlatformKnowledge(active_only === 'true');

  if (category && category !== 'ALL') {
    items = items.filter((k) => k.category === category);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    items = items.filter(
      (k) => k.title.toLowerCase().includes(q) || k.content.toLowerCase().includes(q)
    );
  }

  return res.json({ items });
});

platformRouter.post('/knowledge-base', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, category, content, is_active, file_name, file_type, file_data, file_size } = req.body;

    if (!title || !category) {
      return res.status(400).json({ error: 'Title and Category are required.' });
    }

    const item = await KnowledgeService.createPlatformKnowledge({
      title,
      category,
      content: content || '',
      is_active: is_active ?? true,
      file_name,
      file_type,
      file_data,
      file_size,
    });

    await AuditService.logAudit({
      clinic_id: null,
      actor_user_id: req.user!.id,
      actor_name: req.user!.name,
      action: 'KNOWLEDGE_BASE_ITEM_CREATED',
      target_type: 'KNOWLEDGE_BASE',
      target_id: item.id,
      metadata: { title, category },
    });

    return res.status(201).json({ item });
  } catch (err: any) {
    console.error('[POST /knowledge-base] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create knowledge base item.' });
  }
});

platformRouter.put('/knowledge-base/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, category, content, is_active, file_name, file_type, file_data, file_size } = req.body;

    const updated = await KnowledgeService.updatePlatformKnowledge(id, {
      title,
      category,
      content: content || '',
      is_active,
      ...(file_name !== undefined && { file_name }),
      ...(file_type !== undefined && { file_type }),
      ...(file_data !== undefined && { file_data }),
      ...(file_size !== undefined && { file_size }),
    });

    if (!updated) {
      return res.status(404).json({ error: 'Knowledge base item not found.' });
    }

    await AuditService.logAudit({
      clinic_id: null,
      actor_user_id: req.user!.id,
      actor_name: req.user!.name,
      action: 'KNOWLEDGE_BASE_ITEM_UPDATED',
      target_type: 'KNOWLEDGE_BASE',
      target_id: id,
      metadata: { title, category, is_active },
    });

    return res.json({ item: updated });
  } catch (err: any) {
    console.error('[PUT /knowledge-base/:id] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to update knowledge base item.' });
  }
});

platformRouter.delete('/knowledge-base/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await KnowledgeService.deletePlatformKnowledge(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Knowledge base item not found.' });
    }

    await AuditService.logAudit({
      clinic_id: null,
      actor_user_id: req.user!.id,
      actor_name: req.user!.name,
      action: 'KNOWLEDGE_BASE_ITEM_DELETED',
      target_type: 'KNOWLEDGE_BASE',
      target_id: id,
    });

    return res.json({ success: true, message: 'Knowledge base item deleted.' });
  } catch (err: any) {
    console.error('[DELETE /knowledge-base/:id] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete knowledge base item.' });
  }
});



// AI Usage Events
platformRouter.get('/ai-usage', async (req: AuthenticatedRequest, res: Response) => {
  const events: any[] = [];
  // We can sort them by timestamp descending
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  res.json({ events });
});

// =============================================================================
// Clinic-Specific AI Knowledge Management (Platform Admin Governed)
// =============================================================================

const APPROVED_CLINIC_KNOWLEDGE_CATEGORIES = [
  'CLINIC_POLICY',
  'WORKFLOW',
  'ESCALATION',
  'COMMUNICATION',
  'ARRIVAL',
  'PAYMENT',
  'CANCELLATION',
  'REGISTRATION',
  'OTHER_APPROVED_CLINIC_RULE',
];

// Get AI Knowledge items for a specific clinic
platformRouter.get('/clinics/:clinic_id/ai-knowledge', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clinic_id } = req.params;
    const { status, category, search } = req.query;

    const clinic = await ClinicService.getById(clinic_id);
    if (!clinic) {
      return res.status(404).json({ error: `Clinic with ID '${clinic_id}' not found.` });
    }

    const items = await KnowledgeService.listClinicKnowledge(clinic_id, {
      status: status as string,
      category: category as string,
      search: search as string,
    });

    return res.json({
      clinic_id,
      clinic_name: clinic.name,
      items,
      total: items.length,
    });
  } catch (err: any) {
    console.error('[GET /clinics/:clinic_id/ai-knowledge] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch clinic AI knowledge.' });
  }
});

// Create AI Knowledge item for a specific clinic
platformRouter.post('/clinics/:clinic_id/ai-knowledge', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clinic_id } = req.params;
    const { title, category, content, status } = req.body;

    const clinic = await ClinicService.getById(clinic_id);
    if (!clinic) {
      return res.status(404).json({ error: `Clinic with ID '${clinic_id}' not found.` });
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required.' });
    }

    if (!category || !APPROVED_CLINIC_KNOWLEDGE_CATEGORIES.includes(category)) {
      return res.status(400).json({
        error: `Invalid category. Must be one of: ${APPROVED_CLINIC_KNOWLEDGE_CATEGORIES.join(', ')}`,
      });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content/Instruction is required.' });
    }

    const validStatuses = ['DRAFT', 'VALIDATED', 'PUBLISHED'];
    const ruleStatus = status && validStatuses.includes(status) ? status : 'DRAFT';

    const newItem = await KnowledgeService.createClinicKnowledge(clinic_id, { 
      title: title.trim(),
      category,
      content: content.trim(),
      status: ruleStatus,
      version: 1,
      created_by: req.user!.id,
      updated_by: req.user!.id,
      ...(ruleStatus === 'PUBLISHED' && {
        published_at: new Date().toISOString(),
        published_by: req.user!.id,
      }),
    });

    await AuditService.logAudit({
      clinic_id,
      actor_user_id: req.user!.id,
      actor_name: req.user!.name,
      action: 'CLINIC_AI_KNOWLEDGE_CREATED',
      target_type: 'CLINIC_AI_KNOWLEDGE',
      target_id: newItem.id,
      metadata: { title: newItem.title, category: newItem.category, status: newItem.status },
    });

    return res.status(201).json({ item: newItem });
  } catch (err: any) {
    console.error('[POST /clinics/:clinic_id/ai-knowledge] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create clinic AI knowledge rule.' });
  }
});

// Update AI Knowledge item for a specific clinic
platformRouter.put('/clinics/:clinic_id/ai-knowledge/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clinic_id, id } = req.params;
    const { title, category, content, status } = req.body;

    const clinic = await ClinicService.getById(clinic_id);
    if (!clinic) {
      return res.status(404).json({ error: `Clinic with ID '${clinic_id}' not found.` });
    }

    const existingItem = await KnowledgeService.getClinicKnowledgeById(clinic_id, id);
    if (!existingItem) {
      return res.status(404).json({ error: 'Clinic AI Knowledge item not found for this clinic.' });
    }

    if (category && !APPROVED_CLINIC_KNOWLEDGE_CATEGORIES.includes(category)) {
      return res.status(400).json({
        error: `Invalid category. Must be one of: ${APPROVED_CLINIC_KNOWLEDGE_CATEGORIES.join(', ')}`,
      });
    }

    const validStatuses = ['DRAFT', 'VALIDATED', 'PUBLISHED'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const updates: any = {
      ...(title !== undefined && { title: title.trim() }),
      ...(category !== undefined && { category }),
      ...(content !== undefined && { content: content.trim() }),
      ...(status !== undefined && { status }),
      updated_by: req.user!.id,
    };

    if (status === 'PUBLISHED' && existingItem.status !== 'PUBLISHED') {
      updates.published_at = new Date().toISOString();
      updates.published_by = req.user!.id;
    }

    const updatedItem = await KnowledgeService.updateClinicKnowledge(clinic_id, id, updates);
    if (!updatedItem) {
      return res.status(500).json({ error: 'Failed to update Clinic AI Knowledge item.' });
    }

    await AuditService.logAudit({
      clinic_id,
      actor_user_id: req.user!.id,
      actor_name: req.user!.name,
      action: 'CLINIC_AI_KNOWLEDGE_UPDATED',
      target_type: 'CLINIC_AI_KNOWLEDGE',
      target_id: id,
      metadata: { title: updatedItem.title, category: updatedItem.category, status: updatedItem.status },
    });

    return res.json({ item: updatedItem });
  } catch (err: any) {
    console.error('[PUT /clinics/:clinic_id/ai-knowledge/:id] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to update clinic AI knowledge rule.' });
  }
});

// Delete AI Knowledge item for a specific clinic
platformRouter.delete('/clinics/:clinic_id/ai-knowledge/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clinic_id, id } = req.params;

    const clinic = await ClinicService.getById(clinic_id);
    if (!clinic) {
      return res.status(404).json({ error: `Clinic with ID '${clinic_id}' not found.` });
    }

    const existingItem = await KnowledgeService.getClinicKnowledgeById(clinic_id, id);
    if (!existingItem) {
      return res.status(404).json({ error: 'Clinic AI Knowledge item not found for this clinic.' });
    }

    const deleted = await KnowledgeService.deleteClinicKnowledge(clinic_id, id);
    if (!deleted) {
      return res.status(500).json({ error: 'Failed to delete Clinic AI Knowledge item.' });
    }

    await AuditService.logAudit({
      clinic_id,
      actor_user_id: req.user!.id,
      actor_name: req.user!.name,
      action: 'CLINIC_AI_KNOWLEDGE_DELETED',
      target_type: 'CLINIC_AI_KNOWLEDGE',
      target_id: id,
      metadata: { title: existingItem.title, category: existingItem.category },
    });

    return res.json({ success: true, message: 'Clinic AI Knowledge item deleted.' });
  } catch (err: any) {
    console.error('[DELETE /clinics/:clinic_id/ai-knowledge/:id] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete clinic AI knowledge rule.' });
  }
});

// Publish all or validated AI Knowledge for a specific clinic
platformRouter.post('/clinics/:clinic_id/ai-knowledge/publish', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clinic_id } = req.params;

    const clinic = await ClinicService.getById(clinic_id);
    if (!clinic) {
      return res.status(404).json({ error: `Clinic with ID '${clinic_id}' not found.` });
    }

    const publishedItems = await KnowledgeService.publishClinicKnowledge(clinic_id, req.user!.id);

    await AuditService.logAudit({
      clinic_id,
      actor_user_id: req.user!.id,
      actor_name: req.user!.name,
      action: 'CLINIC_AI_KNOWLEDGE_PUBLISHED',
      target_type: 'CLINIC_AI_KNOWLEDGE',
      target_id: clinic_id,
      metadata: { published_count: publishedItems.length },
    });

    return res.json({
      success: true,
      message: `Successfully published ${publishedItems.length} knowledge items for ${clinic.name}.`,
      items: publishedItems,
    });
  } catch (err: any) {
    console.error('[POST /clinics/:clinic_id/ai-knowledge/publish] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to publish clinic AI knowledge.' });
  }
});

