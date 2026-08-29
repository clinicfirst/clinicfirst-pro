import { Router, Response } from 'express';
import { db, hashPassword } from '../db';
import { requireAuth, requirePlatformAdmin, AuthenticatedRequest } from '../auth';
import { Clinic, User, OperatingHours } from '../../src/types';

export const platformRouter = Router();

platformRouter.use(requireAuth);
platformRouter.use(requirePlatformAdmin);

// Platform Dashboard Metrics
platformRouter.get('/dashboard', (req: AuthenticatedRequest, res: Response) => {
  const clinics = db.getClinics();
  const today = new Date().toISOString().split('T')[0];

  let totalDoctors = 0;
  let totalTodayAppointments = 0;
  let totalTodayCalls = 0;

  for (const c of clinics) {
    const doctors = db.getDoctors(c.id).filter((d) => d.status === 'ACTIVE');
    totalDoctors += doctors.length;

    const apts = db.getAppointments(c.id, { date: today });
    totalTodayAppointments += apts.length;

    const calls = db.getCalls(c.id).filter((call) => call.created_at.startsWith(today));
    totalTodayCalls += calls.length;
  }

  const activeClinics = clinics.filter((c) => c.status === 'ACTIVE').length;
  const recentClinics = [...clinics]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const recentAuditLogs = db.getAuditLogs().slice(0, 8);

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
});

// List all clinics
platformRouter.get('/clinics', (req: AuthenticatedRequest, res: Response) => {
  const clinics = db.getClinics().map((c) => {
    const doctors = db.getDoctors(c.id);
    const staff = db.getUsers(c.id);
    const agent = db.getAiAgent(c.id);
    return {
      ...c,
      doctorsCount: doctors.filter((d) => d.status === 'ACTIVE').length,
      staffCount: staff.filter((s) => s.status === 'ACTIVE').length,
      aiAgentStatus: agent?.status || 'INACTIVE',
    };
  });

  return res.json({ clinics });
});

// Create a new Clinic + Clinic Admin (§3 Step 2)
platformRouter.post('/clinics', (req: AuthenticatedRequest, res: Response) => {
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
  const existingUser = db.getUserByEmail(adminEmail);
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
  db.createClinic(newClinic);

  // 2. Create Clinic Admin User (tagged with role=CLINIC_ADMIN, clinic_id=clinicId, must_change_password=true)
  const newAdminUser = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    clinic_id: clinicId,
    role: 'CLINIC_ADMIN' as const,
    name: adminName.trim(),
    email: adminEmail.trim().toLowerCase(),
    phone: phone.trim(),
    status: 'ACTIVE' as const,
    must_change_password: true, // Force password change on first login
    created_at: now,
    password_hash: hashPassword(adminPassword),
  };
  const createdAdmin = db.createUser(newAdminUser);

  // 3. Initialize default AI Receptionist for the clinic
  db.saveAiAgent({
    id: `agent_${clinicId}`,
    clinic_id: clinicId,
    name: `${name} AI Receptionist`,
    greeting: `Thank you for calling ${name}. My name is Ava, the clinic AI receptionist. How can I assist you with your appointment or health inquiry today?`,
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
    instructions_note: `${name} is located in ${city}. Please adhere to medical receptionist boundaries and book valid appointment slots.`,
  });

  // 4. Audit Log
  db.logAudit({
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
});

// Clinic Detail
platformRouter.get('/clinics/:id', (req: AuthenticatedRequest, res: Response) => {
  const clinicId = req.params.id;
  const clinic = db.getClinicById(clinicId);
  if (!clinic) {
    return res.status(404).json({ error: 'Clinic not found.' });
  }

  const doctors = db.getDoctors(clinicId);
  const staff = db.getUsers(clinicId);
  const services = db.getServices(clinicId);
  const aiAgent = db.getAiAgent(clinicId);
  const today = new Date().toISOString().split('T')[0];
  const todayAppointments = db.getAppointments(clinicId, { date: today });
  const todayCalls = db.getCalls(clinicId).filter((c) => c.created_at.startsWith(today));

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
});

// Update Clinic
platformRouter.put('/clinics/:id', (req: AuthenticatedRequest, res: Response) => {
  const clinicId = req.params.id;
  const updates = req.body;

  const updated = db.updateClinic(clinicId, updates);
  if (!updated) {
    return res.status(404).json({ error: 'Clinic not found.' });
  }

  db.logAudit({
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
platformRouter.get('/audit-logs', (req: AuthenticatedRequest, res: Response) => {
  const logs = db.getAuditLogs();
  return res.json({ logs });
});

// List all Platform & Clinic Users
platformRouter.get('/users', (req: AuthenticatedRequest, res: Response) => {
  const allUsers = db.getUsers();
  const clinics = db.getClinics();
  const clinicMap = new Map(clinics.map((c) => [c.id, c.name]));

  const enrichedUsers = allUsers.map((u) => ({
    ...u,
    clinic_name: u.clinic_id ? clinicMap.get(u.clinic_id) || 'Unknown Clinic' : 'Platform Scope',
  }));

  return res.json({ users: enrichedUsers });
});

// Create a Platform User / Admin
platformRouter.post('/users', (req: AuthenticatedRequest, res: Response) => {
  const { name, email, password, role, clinic_id, phone } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password, and role are required.' });
  }

  const existing = db.getUserByEmail(email);
  if (existing) {
    return res.status(400).json({ error: `A user with email ${email} already exists.` });
  }

  const now = new Date().toISOString();
  const newUser = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    clinic_id: role === 'PLATFORM_ADMIN' ? null : clinic_id || null,
    role,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone?.trim() || '',
    status: 'ACTIVE' as const,
    must_change_password: true,
    created_at: now,
    password_hash: hashPassword(password),
  };

  const created = db.createUser(newUser);

  db.logAudit({
    clinic_id: newUser.clinic_id,
    actor_user_id: req.user!.id,
    actor_name: req.user!.name,
    action: 'USER_CREATED_BY_PLATFORM_ADMIN',
    target_type: 'USER',
    target_id: created.id,
    metadata: { email: created.email, role: created.role },
  });

  return res.status(201).json({ user: created });
});

// Update Platform or Clinic User
platformRouter.put('/users/:id', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.params.id;
  const updates = req.body;

  // Protect against changing password directly without hash
  if (updates.password) {
    updates.password_hash = hashPassword(updates.password);
    delete updates.password;
  }

  const updated = db.updateUser(userId, updates);
  if (!updated) {
    return res.status(404).json({ error: 'User not found.' });
  }

  db.logAudit({
    clinic_id: updated.clinic_id,
    actor_user_id: req.user!.id,
    actor_name: req.user!.name,
    action: 'USER_UPDATED_BY_PLATFORM_ADMIN',
    target_type: 'USER',
    target_id: userId,
    metadata: updates,
  });

  return res.json({ user: updated });
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

platformRouter.get('/settings', (req: AuthenticatedRequest, res: Response) => {
  return res.json({ settings: platformSettings });
});

platformRouter.put('/settings', (req: AuthenticatedRequest, res: Response) => {
  platformSettings = { ...platformSettings, ...req.body };

  db.logAudit({
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
platformRouter.get('/ai-config', (req: AuthenticatedRequest, res: Response) => {
  const config = db.getPlatformAiConfig();
  return res.json({ config });
});

platformRouter.put('/ai-config', (req: AuthenticatedRequest, res: Response) => {
  const {
    provider,
    model,
    voice_provider,
    voice_name,
    temperature,
    status,
    new_api_key,
    remove_api_key,
    role_definition,
    things_to_do,
    things_to_avoid,
    escalation_rules,
    safety_guidelines,
  } = req.body;

  const updated = db.updatePlatformAiConfig({
    provider,
    model,
    voice_provider,
    voice_name,
    temperature: temperature !== undefined ? Number(temperature) : undefined,
    status,
    new_api_key,
    remove_api_key,
    role_definition,
    things_to_do,
    things_to_avoid,
    escalation_rules,
    safety_guidelines,
  });

  db.logAudit({
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
});

platformRouter.post('/ai-config/test-connection', async (req: AuthenticatedRequest, res: Response) => {
  const startTime = Date.now();
  const apiKey = db.getRawPlatformAiApiKey();
  const config = db.getPlatformAiConfig();

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

platformRouter.post('/ai-config/remove-key', (req: AuthenticatedRequest, res: Response) => {
  const updated = db.updatePlatformAiConfig({ remove_api_key: true });
  db.logAudit({
    clinic_id: null,
    actor_user_id: req.user!.id,
    actor_name: req.user!.name,
    action: 'PLATFORM_AI_KEY_REMOVED',
    target_type: 'AI_CONFIG',
  });
  return res.json({ config: updated, message: 'Platform API key removed.' });
});

// Platform Knowledge Base Endpoints
platformRouter.get('/knowledge-base', (req: AuthenticatedRequest, res: Response) => {
  const { category, search, active_only } = req.query;
  let items = db.getPlatformKnowledgeBase(active_only === 'true');

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

platformRouter.post('/knowledge-base', (req: AuthenticatedRequest, res: Response) => {
  const { title, category, content, is_active, file_name, file_type, file_data, file_size } = req.body;

  if (!title || !category) {
    return res.status(400).json({ error: 'Title and Category are required.' });
  }

  const item = db.createKnowledgeItem({
    title,
    category,
    content: content || '',
    is_active: is_active ?? true,
    file_name,
    file_type,
    file_data,
    file_size,
  });

  db.logAudit({
    clinic_id: null,
    actor_user_id: req.user!.id,
    actor_name: req.user!.name,
    action: 'KNOWLEDGE_BASE_ITEM_CREATED',
    target_type: 'KNOWLEDGE_BASE',
    target_id: item.id,
    metadata: { title, category },
  });

  return res.status(201).json({ item });
});

platformRouter.put('/knowledge-base/:id', (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { title, category, content, is_active, file_name, file_type, file_data, file_size } = req.body;

  const updated = db.updateKnowledgeItem(id, {
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

  db.logAudit({
    clinic_id: null,
    actor_user_id: req.user!.id,
    actor_name: req.user!.name,
    action: 'KNOWLEDGE_BASE_ITEM_UPDATED',
    target_type: 'KNOWLEDGE_BASE',
    target_id: id,
    metadata: { title, category, is_active },
  });

  return res.json({ item: updated });
});

platformRouter.delete('/knowledge-base/:id', (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const deleted = db.deleteKnowledgeItem(id);

  if (!deleted) {
    return res.status(404).json({ error: 'Knowledge base item not found.' });
  }

  db.logAudit({
    clinic_id: null,
    actor_user_id: req.user!.id,
    actor_name: req.user!.name,
    action: 'KNOWLEDGE_BASE_ITEM_DELETED',
    target_type: 'KNOWLEDGE_BASE',
    target_id: id,
  });

  return res.json({ success: true, message: 'Knowledge base item deleted.' });
});



// AI Usage Events
platformRouter.get('/ai-usage', (req: AuthenticatedRequest, res: Response) => {
  const events = db.getAiUsageEvents();
  // We can sort them by timestamp descending
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  res.json({ events });
});
