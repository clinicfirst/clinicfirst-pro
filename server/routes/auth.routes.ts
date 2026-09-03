import { ClinicService } from '../services/clinic.service';
import { UserService } from '../services/user.service';
import { AppointmentService } from '../services/appointment.service';
import { PatientService } from '../services/patient.service';
import { DoctorService } from '../services/doctor.service';
import { AuditService } from "../services/audit.service";
import { CallService } from "../services/call.service";
import { Router, Request, Response } from 'express';
import { db, verifyPassword, hashPassword } from '../db';
import { generateToken, requireAuth, AuthenticatedRequest } from '../auth';
import { ServiceService } from '../services/service.service';
import { AiAgentService } from '../services/ai-agent.service';

export const authRouter = Router();

// Public System Statistics (Real live data from database)
authRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const clinics = await ClinicService.list();
    const activeClinics = clinics.filter((c) => c.status === 'ACTIVE').length;
    const today = new Date().toISOString().split('T')[0];

    let totalDoctors = 0;
    let totalServices = 0;
    let totalAppointments = 0;
    let todayAppointments = 0;
    let totalCalls = 0;
    let todayCalls = 0;
    let activeAiAgents = 0;

    for (const c of clinics) {
      const doctors = await DoctorService.list(c.id, { status: 'ACTIVE' });
      totalDoctors += doctors.length;

      const services = await ServiceService.list(c.id, { status: 'ACTIVE' });
      totalServices += services.length;

      const apts = await AppointmentService.list(c.id, );
      totalAppointments += apts.length;
      todayAppointments += apts.filter((a) => a.date === today).length;

      const calls = await CallService.listCalls(c.id);
      totalCalls += calls.length;
      todayCalls += calls.filter((call) => call.created_at.startsWith(today)).length;

      const agent = await AiAgentService.getAgentByClinic(c.id);
      if (agent && agent.status === 'ACTIVE') {
        activeAiAgents += 1;
      }
    }

    const firstClinic = clinics[0];
    const firstClinicDoctors = firstClinic ? await DoctorService.list(firstClinic.id, { status: 'ACTIVE' }) : [];
    const firstClinicServices = firstClinic ? await ServiceService.list(firstClinic.id, { status: 'ACTIVE' }) : [];
    const firstClinicAgent = firstClinic ? await AiAgentService.getAgentByClinic(firstClinic.id) : null;

    return res.json({
      totalClinics: clinics.length,
      activeClinics,
      totalDoctors,
      totalServices,
      totalAppointments,
      todayAppointments,
      totalCalls,
      todayCalls,
      activeAiAgents,
      primaryClinic: firstClinic
        ? {
            id: firstClinic.id,
            name: firstClinic.name,
            doctorsCount: firstClinicDoctors.length,
            servicesCount: firstClinicServices.length,
            todayAppointmentsCount: (await AppointmentService.list(firstClinic.id, { date: today })).length,
            agentName: firstClinicAgent?.name || 'Ava AI',
            phone: firstClinic.phone,
          }
        : null,
    });
  } catch (err: any) {
    console.error('Error fetching public stats:', err);
    return res.status(500).json({ error: 'Failed to retrieve system statistics.' });
  }
});



// Platform Admin Login (/platform/login)
authRouter.post('/platform/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user: any = await UserService.getByEmail(String(email).trim());
    if (!user || user.role !== 'PLATFORM_ADMIN') {
      return res.status(401).json({ error: 'Invalid platform administrator credentials.' });
    }

    if (!verifyPassword(String(password), (user as any).password_hash)) {
      return res.status(401).json({ error: 'Invalid platform administrator credentials.' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Account is deactivated. Please contact support.' });
    }

    const { password_hash, ...cleanUser } = user;
    const token = generateToken(cleanUser);

    try {
      await AuditService.logAudit({
        clinic_id: null,
        actor_user_id: user.id,
        actor_name: user.name,
        action: 'PLATFORM_ADMIN_LOGIN',
        target_type: 'USER',
        target_id: user.id,
      });
    } catch (auditErr) {
      console.warn('Audit log error ignored:', auditErr);
    }

    return res.json({
      token,
      user: cleanUser,
    });
  } catch (err: any) {
    console.error('Error in /platform/login:', err);
    return res.status(500).json({ error: err?.message || 'Login process encountered an error.' });
  }
});

// Clinic Login (/login) - shared by Clinic Admin and Clinic Staff
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user: any = await UserService.getByEmail(String(email).trim());
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.role === 'PLATFORM_ADMIN') {
      // If platform admin tries logging in via standard /login, route them cleanly
      if (!verifyPassword(String(password), (user as any).password_hash)) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
      const { password_hash, ...cleanUser } = user;
      const token = generateToken(cleanUser);
      return res.json({
        token,
        user: cleanUser,
        isPlatformAdmin: true,
      });
    }

    if (!verifyPassword(String(password), (user as any).password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Account is deactivated. Please contact clinic management.' });
    }

    if (!user.clinic_id) {
      return res.status(403).json({ error: 'User is not assigned to a clinic.' });
    }

    const clinic = await ClinicService.getById(user.clinic_id);
    if (!clinic || clinic.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Clinic is currently inactive or suspended.' });
    }

    const { password_hash, ...cleanUser } = user;
    const token = generateToken(cleanUser);

    try {
      await AuditService.logAudit({
        clinic_id: user.clinic_id,
        actor_user_id: user.id,
        actor_name: user.name,
        action: 'CLINIC_USER_LOGIN',
        target_type: 'USER',
        target_id: user.id,
      });
    } catch (auditErr) {
      console.warn('Audit log error ignored:', auditErr);
    }

    return res.json({
      token,
      user: cleanUser,
      clinic,
    });
  } catch (err: any) {
    console.error('Error in /login:', err);
    return res.status(500).json({ error: err?.message || 'Login process encountered an error.' });
  }
});

// Current User & Session Refresh
authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    let clinic = undefined;
    if (user.clinic_id) {
      clinic = await ClinicService.getById(user.clinic_id);
    }

    return res.json({
      user,
      clinic,
    });
  } catch (err: any) {
    console.error('Error in /me:', err);
    return res.status(500).json({ error: err?.message || 'Failed to fetch user session.' });
  }
});

// Force Password Change / Reset
authRouter.post('/change-password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
    }

    const user = await UserService.getById(req.user!.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // If user was not forced to change, verify current password
    if (!user.must_change_password && currentPassword) {
      if (!verifyPassword(String(currentPassword), (user as any).password_hash)) {
        return res.status(400).json({ error: 'Current password is incorrect.' });
      }
    }

    const newHash = hashPassword(String(newPassword));
    const updated: any = await UserService.update(user.id, {
      password_hash: newHash,
      must_change_password: false,
    } as any);

    try {
      await AuditService.logAudit({
        clinic_id: user.clinic_id,
        actor_user_id: user.id,
        actor_name: user.name,
        action: 'PASSWORD_CHANGED',
        target_type: 'USER',
        target_id: user.id,
      });
    } catch (auditErr) {
      console.warn('Audit log error ignored:', auditErr);
    }

    return res.json({
      success: true,
      message: 'Password updated successfully.',
      user: updated,
    });
  } catch (err: any) {
    console.error('Error in /change-password:', err);
    return res.status(500).json({ error: err?.message || 'Password update failed.' });
  }
});
