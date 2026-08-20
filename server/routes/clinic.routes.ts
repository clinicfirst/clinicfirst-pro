import { Router, Response } from 'express';
import { db, hashPassword } from '../db';
import { requireAuth, requireClinicPermission, AuthenticatedRequest } from '../auth';
import {
  Doctor,
  DoctorSchedule,
  DoctorLeave,
  Service,
  Patient,
  Appointment,
  AiAgent,
} from '../../src/types';
import { getAvailableSlots } from '../voice/tools/get-available-slots';

export const clinicRouter = Router();

clinicRouter.use(requireAuth);

// Helper to get authenticated clinic ID
function getAuthClinicId(req: AuthenticatedRequest): string {
  // If Platform Admin is inspecting a specific clinic
  if (req.user?.role === 'PLATFORM_ADMIN' && req.headers['x-clinic-id']) {
    return req.headers['x-clinic-id'] as string;
  }
  return req.user?.clinic_id || '';
}

// -------------------------------------------------------------
// 1. Clinic Dashboard ("What is happening today?" & "What do I need to do next?")
// -------------------------------------------------------------
clinicRouter.get(
  '/dashboard',
  requireClinicPermission('view_own_clinic_dashboard'),
  (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const today = new Date().toISOString().split('T')[0];
    const doctorIdFilter = req.user?.role === 'DOCTOR' ? req.user.doctor_id : undefined;

    const clinic = db.getClinicById(clinicId);
    const allAppointments = db.getAppointments(clinicId, { date: today, doctor_id: doctorIdFilter });
    const confirmed = allAppointments.filter((a) => a.status === 'CONFIRMED');
    const completed = allAppointments.filter((a) => a.status === 'COMPLETED');
    const rescheduled = allAppointments.filter((a) => a.status === 'RESCHEDULED');
    const cancelled = allAppointments.filter((a) => a.status === 'CANCELLED');

    let allCalls = db.getCalls(clinicId);
    if (req.user?.role === 'DOCTOR') {
      allCalls = allCalls.filter(c => c.doctor_id === req.user.doctor_id);
    }
    const todayCalls = allCalls.filter((c) => c.created_at.startsWith(today));
    const todayAiBooked = todayCalls.filter((c) => c.outcome === 'APPOINTMENT_BOOKED').length;

    let doctors = db.getDoctors(clinicId).filter((d) => d.status === 'ACTIVE');
    if (req.user?.role === 'DOCTOR') {
      doctors = doctors.filter(d => d.id === req.user.doctor_id);
    }
    const aiAgent = db.getAiAgent(clinicId);
    const pendingEscalations = db
      .getEscalations(clinicId)
      .filter((e) => e.status === 'pending');

    // Next upcoming appointments today with fully hydrated relations
    const enrichedAppointments = allAppointments.map((apt) => {
      const patient = apt.patient || db.getPatientById(clinicId, apt.patient_id);
      const doctor = apt.doctor || db.getDoctorById(clinicId, apt.doctor_id);
      const service = apt.service || db.getServiceById(clinicId, apt.service_id);
      return {
        ...apt,
        patient,
        doctor,
        service,
        patient_name: patient?.name || 'Registered Patient',
        patient_phone: patient?.phone || '',
        doctor_name: doctor?.name || 'Assigned Physician',
        doctor_specialization: doctor?.specialization || 'General Practice',
        service_name: service?.name || 'General Consultation',
        service_fee: service?.fee || 0,
        service_duration: service?.duration_minutes || 30,
      };
    });

    const upcomingToday = enrichedAppointments
      .filter((a) => a.status !== 'CANCELLED')
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    // -----------------------------------------------------------
    // Weekly Trends & Analytics Calculation (Past 7 Days - Pure Database Driven)
    // -----------------------------------------------------------
    const rawAllAppointments = db.getAppointments(clinicId);
    let rawAllCalls = db.getCalls(clinicId);
    if (req.user?.role === 'DOCTOR') {
      rawAllCalls = rawAllCalls.filter(c => c.doctor_id === req.user.doctor_id);
    }

    // Generate real 7-day trend series ending today
    const trends = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const displayDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      // Match actual DB records for this specific date
      const dayApts = rawAllAppointments.filter(
        (a) => a.date === dateStr || (a.created_at && a.created_at.startsWith(dateStr))
      );
      const dayCalls = rawAllCalls.filter(
        (c) =>
          (c.created_at && c.created_at.startsWith(dateStr)) ||
          (c.start_time && c.start_time.startsWith(dateStr))
      );

      const dayAiApts = dayApts.filter((a) => a.created_via === 'ai_receptionist');
      const dayStaffApts = dayApts.filter((a) => a.created_via !== 'ai_receptionist');

      const totalAppointments = dayApts.length;
      const confirmedAppointments = dayApts.filter((a) => a.status === 'CONFIRMED').length;
      const completedAppointments = dayApts.filter((a) => a.status === 'COMPLETED').length;
      const cancelledAppointments = dayApts.filter((a) => a.status === 'CANCELLED').length;
      const aiBookedAppointments = dayAiApts.length;
      const staffBookedAppointments = dayStaffApts.length;

      const totalCalls = dayCalls.length;
      const aiCallsBooked = dayCalls.filter(
        (c) => c.outcome === 'APPOINTMENT_BOOKED' || Boolean(c.appointment_id)
      ).length;
      const escalatedCalls = dayCalls.filter(
        (c) =>
          c.status === 'escalated' ||
          c.outcome === 'ESCALATED' ||
          c.outcome === 'EMERGENCY_ESCALATED' ||
          Boolean(c.escalation_id)
      ).length;
      const aiCallsResolved = Math.max(0, totalCalls - escalatedCalls);
      const avgCallDurationSeconds =
        dayCalls.length > 0
          ? Math.round(
              dayCalls.reduce((acc, c) => acc + (Number(c.duration_seconds) || 0), 0) / dayCalls.length
            )
          : 0;

      trends.push({
        date: dateStr,
        day: dayName,
        displayDate,
        totalAppointments,
        confirmedAppointments,
        completedAppointments,
        cancelledAppointments,
        aiBookedAppointments,
        staffBookedAppointments,
        totalCalls,
        aiCallsResolved,
        aiCallsBooked,
        escalatedCalls,
        avgCallDurationSeconds,
      });
    }

    // Aggregates & KPIs from Real Database Records
    const weeklyTotalAppointments = trends.reduce((acc, t) => acc + t.totalAppointments, 0);
    const weeklyTotalCalls = trends.reduce((acc, t) => acc + t.totalCalls, 0);
    const weeklyAiBooked = trends.reduce((acc, t) => acc + t.aiCallsBooked, 0);
    const weeklyResolved = trends.reduce((acc, t) => acc + t.aiCallsResolved, 0);

    // Calculate real average handling duration across calls with duration
    const callsWithDuration = rawAllCalls.filter(
      (c) => c.duration_seconds !== undefined && c.duration_seconds !== null && c.duration_seconds > 0
    );
    const weeklyDurationAvg =
      callsWithDuration.length > 0
        ? Math.round(
            callsWithDuration.reduce((acc, c) => acc + (Number(c.duration_seconds) || 0), 0) /
              callsWithDuration.length
          )
        : 0;

    // Real Call Outcome Distribution based strictly on database records
    const outcomeCounts: Record<string, number> = {
      APPOINTMENT_BOOKED: 0,
      GENERAL_INQUIRY: 0,
      APPOINTMENT_RESCHEDULED: 0,
      EMERGENCY_ESCALATED: 0,
      APPOINTMENT_CANCELLED: 0,
    };

    rawAllCalls.forEach((call) => {
      if (call.outcome === 'APPOINTMENT_BOOKED' || call.appointment_id) {
        outcomeCounts.APPOINTMENT_BOOKED++;
      } else if (
        call.status === 'escalated' ||
        call.outcome === 'ESCALATED' ||
        call.outcome === 'EMERGENCY_ESCALATED' ||
        call.escalation_id
      ) {
        outcomeCounts.EMERGENCY_ESCALATED++;
      } else if (
        call.outcome === 'APPOINTMENT_RESCHEDULED' ||
        call.outcome === 'RESCHEDULED'
      ) {
        outcomeCounts.APPOINTMENT_RESCHEDULED++;
      } else if (
        call.outcome === 'APPOINTMENT_CANCELLED' ||
        call.outcome === 'CANCELLED'
      ) {
        outcomeCounts.APPOINTMENT_CANCELLED++;
      } else {
        outcomeCounts.GENERAL_INQUIRY++;
      }
    });

    const totalCalculatedCalls = rawAllCalls.length;
    const callOutcomeMeta = [
      { outcome: 'APPOINTMENT_BOOKED', label: 'Booked New Appointment', color: '#0F4C5C' },
      { outcome: 'GENERAL_INQUIRY', label: 'General / Clinic Info', color: '#2AAFA3' },
      { outcome: 'APPOINTMENT_RESCHEDULED', label: 'Rescheduled / Modified', color: '#0284C7' },
      { outcome: 'EMERGENCY_ESCALATED', label: 'Emergency / Staff Escalated', color: '#E11D48' },
      { outcome: 'APPOINTMENT_CANCELLED', label: 'Cancelled Appointment', color: '#94A3B8' },
    ];

    const callOutcomeDistribution = callOutcomeMeta
      .map((meta) => {
        const count = outcomeCounts[meta.outcome] || 0;
        const percentage =
          totalCalculatedCalls > 0 ? Math.round((count / totalCalculatedCalls) * 100) : 0;
        return {
          outcome: meta.outcome,
          label: meta.label,
          count,
          percentage,
          color: meta.color,
        };
      })
      .filter((item) => totalCalculatedCalls === 0 || item.count > 0);

    // Doctor appointment breakdown from real database appointments
    const appointmentByDoctor = doctors.map((doc) => {
      const docApts = rawAllAppointments.filter((a) => a.doctor_id === doc.id);
      return {
        doctorName: doc.name,
        specialization: doc.specialization,
        appointments: docApts.length,
      };
    });

    // Real dynamic peak call hour calculation
    let peakCallHour = 'No calls recorded';
    if (rawAllCalls.length > 0) {
      const hourBuckets: Record<number, number> = {};
      rawAllCalls.forEach((c) => {
        const timeStr = c.start_time || c.created_at;
        if (timeStr) {
          try {
            const h = new Date(timeStr).getHours();
            if (!isNaN(h)) {
              hourBuckets[h] = (hourBuckets[h] || 0) + 1;
            }
          } catch (e) {
            // ignore
          }
        }
      });
      const entries = Object.entries(hourBuckets);
      if (entries.length > 0) {
        entries.sort((a, b) => b[1] - a[1]);
        const h = parseInt(entries[0][0], 10);
        const startPeriod = h >= 12 ? 'PM' : 'AM';
        const endH = (h + 1) % 24;
        const endPeriod = endH >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 === 0 ? 12 : h % 12;
        const displayEndH = endH % 12 === 0 ? 12 : endH % 12;
        peakCallHour = `${displayH}:00 ${startPeriod} - ${displayEndH}:00 ${endPeriod}`;
      }
    }

    // Busiest Day from Trends
    const busiestDayTrend = trends.reduce(
      (max, t) =>
        t.totalAppointments + t.totalCalls > max.totalAppointments + max.totalCalls ? t : max,
      trends[trends.length - 1]
    );
    const busiestDay =
      busiestDayTrend.totalAppointments + busiestDayTrend.totalCalls > 0
        ? busiestDayTrend.day
        : 'N/A';

    // Real period comparisons
    const firstHalfApts = trends.slice(0, 3).reduce((acc, t) => acc + t.totalAppointments, 0);
    const secondHalfApts = trends.slice(4, 7).reduce((acc, t) => acc + t.totalAppointments, 0);
    const appointmentGrowthPercent =
      firstHalfApts > 0
        ? Math.round(((secondHalfApts - firstHalfApts) / firstHalfApts) * 100)
        : secondHalfApts > 0
        ? 100
        : 0;

    const firstHalfCalls = trends.slice(0, 3).reduce((acc, t) => acc + t.totalCalls, 0);
    const secondHalfCalls = trends.slice(4, 7).reduce((acc, t) => acc + t.totalCalls, 0);
    const callGrowthPercent =
      firstHalfCalls > 0
        ? Math.round(((secondHalfCalls - firstHalfCalls) / firstHalfCalls) * 100)
        : secondHalfCalls > 0
        ? 100
        : 0;

    const weeklyAnalytics = {
      trends,
      summary: {
        totalAppointments: weeklyTotalAppointments,
        appointmentGrowthPercent,
        totalCalls: weeklyTotalCalls,
        callGrowthPercent,
        aiBookingConversionRate:
          weeklyTotalCalls > 0 ? Math.round((weeklyAiBooked / weeklyTotalCalls) * 100) : 0,
        aiAutonomousResolutionRate:
          weeklyTotalCalls > 0 ? Math.round((weeklyResolved / weeklyTotalCalls) * 100) : 100,
        avgCallHandlingSeconds: weeklyDurationAvg,
        peakCallHour,
        busiestDay,
      },
      callOutcomeDistribution,
      appointmentByDoctor,
    };

    const platformAiConfig = db.getPlatformAiConfig();
    const isApiKeySet = Boolean(
      platformAiConfig?.api_key_configured ||
      process.env.GEMINI_API_KEY ||
      process.env.SARVAM_API_KEY
    );
    const isAiActive = aiAgent?.status === 'ACTIVE';
    const isReady = isAiActive && isApiKeySet;

    // Check if user has permission for fee collection (CLINIC_ADMIN and PLATFORM_ADMIN only)
    const canViewDailyCollection =
      req.user?.role === 'CLINIC_ADMIN' || req.user?.role === 'PLATFORM_ADMIN' || req.user?.role === 'DOCTOR';
    let dailyCollection = undefined;

    if (canViewDailyCollection) {
      let totalFeesToday = 0;
      let confirmedCompletedFees = 0;

      for (const apt of enrichedAppointments) {
        const fee = Number(apt.service_fee) || 0;
        if (apt.status !== 'CANCELLED') {
          totalFeesToday += fee;
        }
        if (apt.status === 'CONFIRMED' || apt.status === 'COMPLETED') {
          confirmedCompletedFees += fee;
        }
      }

      dailyCollection = {
        total: totalFeesToday,
        confirmedCompletedTotal: confirmedCompletedFees,
        currency_symbol: clinic?.currency_symbol || '$',
        currency: clinic?.currency || 'USD',
        billedAppointmentsCount: enrichedAppointments.filter((a) => a.status !== 'CANCELLED').length,
      };
    }

    return res.json({
      clinic,
      date: today,
      metrics: {
        todayAppointmentsTotal: allAppointments.length,
        todayConfirmed: confirmed.length,
        todayCompleted: completed.length,
        todayRescheduled: rescheduled.length,
        todayCancelled: cancelled.length,
        todayAiCalls: todayCalls.length,
        todayAiBookedCount: todayAiBooked,
        activeDoctorsCount: doctors.length,
        pendingEscalationsCount: pendingEscalations.length,
        ...(dailyCollection ? { dailyCollection } : {}),
      },
      upcomingToday,
      pendingEscalations: pendingEscalations.slice(0, 5),
      aiStatus: {
        name: aiAgent?.name || 'Ava',
        status: isReady ? 'ACTIVE' : isAiActive ? 'NOT_READY' : 'INACTIVE',
        provider: platformAiConfig?.provider === 'sarvam' ? 'Sarvam' : 'Gemini',
        model: platformAiConfig?.model || 'gemini-3.6-flash',
        phoneStatus: 'Connected',
        isReady,
        apiKeyConfigured: isApiKeySet,
      },
      activeDoctors: doctors,
      weeklyAnalytics,
    });
  }
);

// -------------------------------------------------------------
// Daily Collection of Fees (Admin only - Strictly Forbidden for Staff)
// -------------------------------------------------------------
clinicRouter.get(
  ['/daily-collection', '/finance/daily-collection'],
  requireClinicPermission('view_daily_collection'),
  (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const clinic = db.getClinicById(clinicId);
    const today = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const doctorIdFilter = req.user?.role === 'DOCTOR' ? req.user.doctor_id : undefined;

    const appointments = db.getAppointments(clinicId, { date: today, doctor_id: doctorIdFilter });

    const items = appointments
      .map((apt) => {
        const patient = apt.patient || db.getPatientById(clinicId, apt.patient_id);
        const doctor = apt.doctor || db.getDoctorById(clinicId, apt.doctor_id);
        const service = apt.service || db.getServiceById(clinicId, apt.service_id);
        const fee = Number(service?.fee) || 0;

        return {
          appointment_id: apt.id,
          patient_id: apt.patient_id,
          patient_name: patient?.name || 'Registered Patient',
          patient_phone: patient?.phone || '',
          patient_email: patient?.email || '',
          doctor_id: apt.doctor_id,
          doctor_name: doctor?.name || 'Assigned Physician',
          doctor_specialization: doctor?.specialization || 'General Practice',
          service_id: apt.service_id,
          service_name: service?.name || 'General Consultation',
          service_duration: service?.duration_minutes || 30,
          fee,
          date: apt.date,
          start_time: apt.start_time,
          end_time: apt.end_time,
          status: apt.status,
          created_via: apt.created_via,
          created_at: apt.created_at,
        };
      })
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    let totalCollection = 0;
    let confirmedCompletedTotal = 0;
    let confirmedCount = 0;
    let completedCount = 0;
    let rescheduledCount = 0;
    let cancelledCount = 0;

    const doctorMap: Record<
      string,
      { doctor_id: string; doctor_name: string; specialization: string; count: number; total_fees: number }
    > = {};
    const serviceMap: Record<
      string,
      { service_id: string; service_name: string; count: number; fee: number; total_fees: number }
    > = {};

    for (const item of items) {
      if (item.status === 'CONFIRMED') confirmedCount++;
      else if (item.status === 'COMPLETED') completedCount++;
      else if (item.status === 'RESCHEDULED') rescheduledCount++;
      else if (item.status === 'CANCELLED') cancelledCount++;

      if (item.status === 'COMPLETED') {
        totalCollection += item.fee;

        // Group by doctor
        if (!doctorMap[item.doctor_id]) {
          doctorMap[item.doctor_id] = {
            doctor_id: item.doctor_id,
            doctor_name: item.doctor_name,
            specialization: item.doctor_specialization,
            count: 0,
            total_fees: 0,
          };
        }
        doctorMap[item.doctor_id].count++;
        doctorMap[item.doctor_id].total_fees += item.fee;

        // Group by service
        if (!serviceMap[item.service_id]) {
          serviceMap[item.service_id] = {
            service_id: item.service_id,
            service_name: item.service_name,
            count: 0,
            fee: item.fee,
            total_fees: 0,
          };
        }
        serviceMap[item.service_id].count++;
        serviceMap[item.service_id].total_fees += item.fee;
      }

      if (item.status === 'CONFIRMED' || item.status === 'COMPLETED') {
        confirmedCompletedTotal += item.fee;
      }
    }

    return res.json({
      date: today,
      currency_symbol: clinic?.currency_symbol || '$',
      currency: clinic?.currency || 'USD',
      total_collection: totalCollection,
      confirmed_completed_total: confirmedCompletedTotal,
      total_appointments_count: items.length,
      confirmed_count: confirmedCount,
      completed_count: completedCount,
      rescheduled_count: rescheduledCount,
      cancelled_count: cancelledCount,
      by_doctor: Object.values(doctorMap),
      by_service: Object.values(serviceMap),
      items,
    });
  }
);

// -------------------------------------------------------------
// 2. Doctors Management
// -------------------------------------------------------------
clinicRouter.get(
  '/doctors',
  requireClinicPermission('view_doctors'),
  (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    let doctors = db.getDoctors(clinicId);
    if (req.user?.role === 'DOCTOR') {
      doctors = doctors.filter(d => d.id === req.user.doctor_id);
    }
    return res.json({ doctors });
  }
);

clinicRouter.post(
  '/doctors',
  requireClinicPermission('manage_doctors'),
  (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const { name, specialization, qualification, phone, email, consultation_duration_minutes } = req.body;

    if (!name || !specialization) {
      return res.status(400).json({ error: 'Doctor name and specialization are required.' });
    }

    const doctor: Doctor = {
      id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      clinic_id: clinicId,
      name: name.trim(),
      specialization: specialization.trim(),
      qualification: qualification?.trim() || '',
      phone: phone?.trim() || '',
      email: email?.trim() || '',
      consultation_duration_minutes: Number(consultation_duration_minutes) || 30,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    };

    db.createDoctor(doctor);

    // Auto-create standard Mon-Fri 09:00-17:00 schedule for new doctor
    for (let day = 1; day <= 5; day++) {
      db.saveSchedule({
        id: `sched_${doctor.id}_day_${day}`,
        clinic_id: clinicId,
        doctor_id: doctor.id,
        day_of_week: day,
        start_time: '09:00',
        end_time: '17:00',
        break_start: '13:00',
        break_end: '14:00',
        buffer_minutes: 5,
      });
    }

    db.logAudit({
      clinic_id: clinicId,
      actor_user_id: req.user!.id,
      actor_name: req.user!.name,
      action: 'DOCTOR_CREATED',
      target_type: 'DOCTOR',
      target_id: doctor.id,
      metadata: { name: doctor.name, specialization: doctor.specialization },
    });

    return res.status(201).json({ doctor });
  }
);

clinicRouter.put(
  '/doctors/:id',
  requireClinicPermission('manage_doctors'),
  (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const doctorId = req.params.id;
    const updates = req.body;

    const updated = db.updateDoctor(clinicId, doctorId, updates);
    if (!updated) {
      return res.status(404).json({ error: 'Doctor not found.' });
    }

    db.logAudit({
      clinic_id: clinicId,
      actor_user_id: req.user!.id,
      actor_name: req.user!.name,
      action: updates.status === 'INACTIVE' ? 'DOCTOR_DEACTIVATED' : 'DOCTOR_UPDATED',
      target_type: 'DOCTOR',
      target_id: doctorId,
      metadata: updates,
    });

    return res.json({ doctor: updated });
  }
);

// -------------------------------------------------------------
// 3. Staff Management (Clinic Admin only)
// -------------------------------------------------------------
clinicRouter.get(
  '/staff',
  requireClinicPermission('manage_staff'),
  (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const staff = db.getUsers(clinicId).filter((u) => u.role === 'CLINIC_STAFF' || u.role === 'CLINIC_ADMIN');
    return res.json({ staff });
  }
);

clinicRouter.post(
  '/staff',
  requireClinicPermission('manage_staff'),
  (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const { name, email, phone, tempPassword } = req.body;

    if (!name || !email || !tempPassword) {
      return res.status(400).json({ error: 'Staff name, email, and temporary password are required.' });
    }

    const existing = db.getUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: `A user with email ${email} already exists.` });
    }

    const newStaff = {
      id: `usr_staff_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      clinic_id: clinicId,
      role: 'CLINIC_STAFF' as const,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || '',
      status: 'ACTIVE' as const,
      must_change_password: true,
      created_at: new Date().toISOString(),
      password_hash: hashPassword(tempPassword),
    };

    const created = db.createUser(newStaff);

    db.logAudit({
      clinic_id: clinicId,
      actor_user_id: req.user!.id,
      actor_name: req.user!.name,
      action: 'STAFF_CREATED',
      target_type: 'USER',
      target_id: created.id,
      metadata: { name: created.name, email: created.email },
    });

    return res.status(201).json({ staff: created });
  }
);

clinicRouter.put(
  '/staff/:id',
  requireClinicPermission('manage_staff'),
  (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const staffId = req.params.id;
    const targetUser = db.getUserById(staffId);

    if (!targetUser || targetUser.clinic_id !== clinicId) {
      return res.status(404).json({ error: 'Staff member not found.' });
    }

    const updates = req.body;
    const updated = db.updateUser(staffId, updates);

    db.logAudit({
      clinic_id: clinicId,
      actor_user_id: req.user!.id,
      actor_name: req.user!.name,
      action: updates.status === 'INACTIVE' ? 'STAFF_DEACTIVATED' : 'STAFF_UPDATED',
      target_type: 'USER',
      target_id: staffId,
      metadata: updates,
    });

    return res.json({ staff: updated });
  }
);

clinicRouter.post(
  '/staff/:id/reset-password',
  requireClinicPermission('manage_staff'),
  (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const staffId = req.params.id;
    const { newTempPassword } = req.body;

    if (!newTempPassword || newTempPassword.length < 8) {
      return res.status(400).json({ error: 'Temporary password must be at least 8 characters long.' });
    }

    const targetUser = db.getUserById(staffId);
    if (!targetUser || targetUser.clinic_id !== clinicId) {
      return res.status(404).json({ error: 'Staff member not found.' });
    }

    db.updateUser(staffId, {
      password_hash: hashPassword(newTempPassword),
      must_change_password: true,
    });

    db.logAudit({
      clinic_id: clinicId,
      actor_user_id: req.user!.id,
      actor_name: req.user!.name,
      action: 'STAFF_PASSWORD_RESET',
      target_type: 'USER',
      target_id: staffId,
      metadata: { target_email: targetUser.email },
    });

    return res.json({ success: true, message: 'Temporary password reset successfully.' });
  }
);

// -------------------------------------------------------------
// 4. Services Management
// -------------------------------------------------------------
clinicRouter.get(
  '/services',
  requireClinicPermission('view_services'),
  (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    let services = db.getServices(clinicId);
    if (req.user?.role === 'DOCTOR') {
      services = services.filter(s => !s.assigned_doctor_ids || s.assigned_doctor_ids.length === 0 || s.assigned_doctor_ids.includes(req.user.doctor_id || ''));
    }
    return res.json({ services });
  }
);

clinicRouter.post(
  '/services',
  requireClinicPermission('manage_services'),
  (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const { name, duration_minutes, fee, assigned_doctor_ids } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Service name is required.' });
    }

    const service: Service = {
      id: `srv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      clinic_id: clinicId,
      name: name.trim(),
      duration_minutes: Number(duration_minutes) || 30,
      fee: Number(fee) || 0,
      status: 'ACTIVE',
      assigned_doctor_ids: assigned_doctor_ids || [],
    };

    db.createService(service);

    db.logAudit({
      clinic_id: clinicId,
      actor_user_id: req.user!.id,
      actor_name: req.user!.name,
      action: 'SERVICE_CREATED',
      target_type: 'SERVICE',
      target_id: service.id,
      metadata: { name: service.name, fee: service.fee },
    });

    return res.status(201).json({ service });
  }
);

clinicRouter.put(
  '/services/:id',
  requireClinicPermission('manage_services'),
  (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const serviceId = req.params.id;
    const updates = req.body;

    const updated = db.updateService(clinicId, serviceId, updates);
    if (!updated) {
      return res.status(404).json({ error: 'Service not found.' });
    }

    db.logAudit({
      clinic_id: clinicId,
      actor_user_id: req.user!.id,
      actor_name: req.user!.name,
      action: 'SERVICE_UPDATED',
      target_type: 'SERVICE',
      target_id: serviceId,
      metadata: updates,
    });

    return res.json({ service: updated });
  }
);

// -------------------------------------------------------------
// 5. Schedules & Leaves Management
// -------------------------------------------------------------
clinicRouter.get(
  '/schedules',
  requireClinicPermission('view_schedules'),
  (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const doctorId = req.user?.role === 'DOCTOR' ? req.user.doctor_id : (req.query.doctor_id as string | undefined);

    const schedules = db.getSchedules(clinicId, doctorId);
    const leaves = db.getLeaves(clinicId, doctorId);

    return res.json({ schedules, leaves });
  }
);

clinicRouter.post(
  '/schedules',
  requireClinicPermission('manage_schedules'),
  (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const { doctor_id, day_of_week, start_time, end_time, break_start, break_end, buffer_minutes } = req.body;

    if (!doctor_id || day_of_week === undefined || !start_time || !end_time) {
      return res.status(400).json({ error: 'doctor_id, day_of_week, start_time, and end_time are required.' });
    }

    const schedule: DoctorSchedule = {
      id: `sched_${doctor_id}_day_${day_of_week}`,
      clinic_id: clinicId,
      doctor_id,
      day_of_week: Number(day_of_week),
      start_time,
      end_time,
      break_start,
      break_end,
      buffer_minutes: Number(buffer_minutes) || 5,
    };

    const saved = db.saveSchedule(schedule);

    db.logAudit({
      clinic_id: clinicId,
      actor_user_id: req.user!.id,
      actor_name: req.user!.name,
      action: 'SCHEDULE_UPDATED',
      target_type: 'SCHEDULE',
      target_id: saved.id,
      metadata: schedule,
    });

    return res.json({ schedule: saved });
  }
);

clinicRouter.delete(
  '/schedules',
  requireClinicPermission('manage_schedules'),
  (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const doctorId = req.query.doctor_id as string;
    const dayOfWeek = req.query.day_of_week as string;

    if (!doctorId || dayOfWeek === undefined) {
      return res.status(400).json({ error: 'doctor_id and day_of_week are required.' });
    }

    db.deleteSchedule(clinicId, doctorId, Number(dayOfWeek));

    db.logAudit({
      clinic_id: clinicId,
      actor_user_id: req.user!.id,
      actor_name: req.user!.name,
      action: 'SCHEDULE_DELETED',
      target_type: 'SCHEDULE',
      target_id: `sched_${doctorId}_day_${dayOfWeek}`,
      metadata: { doctor_id: doctorId, day_of_week: Number(dayOfWeek) },
    });

    return res.json({ success: true });
  }
);

clinicRouter.post(
  '/leaves',
  requireClinicPermission('manage_schedules'),
  (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const { doctor_id, start_date, end_date, reason } = req.body;

    if (!doctor_id || !start_date || !end_date) {
      return res.status(400).json({ error: 'doctor_id, start_date, and end_date are required.' });
    }

    const leave: DoctorLeave = {
      id: `leave_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      clinic_id: clinicId,
      doctor_id,
      start_date,
      end_date,
      reason: reason || 'Scheduled Leave',
    };

    const created = db.createLeave(leave);

    db.logAudit({
      clinic_id: clinicId,
      actor_user_id: req.user!.id,
      actor_name: req.user!.name,
      action: 'DOCTOR_LEAVE_LOGGED',
      target_type: 'LEAVE',
      target_id: created.id,
      metadata: leave,
    });

    return res.status(201).json({ leave: created });
  }
);

clinicRouter.delete(
  '/leaves/:id',
  requireClinicPermission('manage_schedules'),
  (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const leaveId = req.params.id;

    const deleted = db.deleteLeave(clinicId, leaveId);
    if (!deleted) {
      return res.status(404).json({ error: 'Leave record not found.' });
    }

    return res.json({ success: true });
  }
);

// -------------------------------------------------------------
// 6. Patients Management
// -------------------------------------------------------------
clinicRouter.get(
  '/patients',
  requireClinicPermission('manage_patients'),
  (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const search = req.query.search as string | undefined;

    let patients = db.getPatients(clinicId, search);
    if (req.user?.role === 'DOCTOR') {
      const myPatientIds = new Set(db.getAppointments(clinicId, { doctor_id: req.user.doctor_id }).map(a => a.patient_id));
      patients = patients.filter(p => myPatientIds.has(p.id));
    }
    return res.json({ patients });
  }
);

clinicRouter.get(
  '/patients/:id',
  requireClinicPermission('manage_patients'),
  (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const patientId = req.params.id;

    const patient = db.getPatientById(clinicId, patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found.' });
    }

    const appointments = db.getAppointments(clinicId).filter((a) => a.patient_id === patientId);
    const calls = db.getCalls(clinicId).filter((c) => c.patient_id === patientId);

    return res.json({ patient, appointments, calls });
  }
);

clinicRouter.post(
  '/patients',
  requireClinicPermission('manage_patients'),
  (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const { name, phone, email, dob, gender, preferred_language, notes } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Patient name and phone number are required.' });
    }

    const patient: Patient = {
      id: `pat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      clinic_id: clinicId,
      name: name.trim(),
      phone: phone.trim(),
      email: email?.trim() || '',
      dob: dob || '',
      gender: gender || 'Prefer not to say',
      preferred_language: preferred_language || 'English',
      notes: notes || '',
      created_at: new Date().toISOString(),
    };

    const created = db.createPatient(patient);

    db.logAudit({
      clinic_id: clinicId,
      actor_user_id: req.user!.id,
      actor_name: req.user!.name,
      action: 'PATIENT_CREATED',
      target_type: 'PATIENT',
      target_id: created.id,
      metadata: { name: created.name, phone: created.phone },
    });

    return res.status(201).json({ patient: created });
  }
);

clinicRouter.put(
  '/patients/:id',
  requireClinicPermission('manage_patients'),
  (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const patientId = req.params.id;
    const updates = req.body;

    const updated = db.updatePatient(clinicId, patientId, updates);
    if (!updated) {
      return res.status(404).json({ error: 'Patient not found.' });
    }

    return res.json({ patient: updated });
  }
);

// -------------------------------------------------------------
// 7. Appointments & Real-Time Availability
// -------------------------------------------------------------
clinicRouter.get(
  '/appointments',
  requireClinicPermission('manage_appointments'),
  (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const { date, doctor_id, status } = req.query as {
      date?: string;
      doctor_id?: string;
      status?: string;
    };

    const appointments = db.getAppointments(clinicId, { date, doctor_id, status });
    return res.json({ appointments });
  }
);

clinicRouter.get(
  '/available-slots',
  requireClinicPermission('manage_appointments'),
  async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const { date, doctorId, serviceId } = req.query as {
      date?: string;
      doctorId?: string;
      serviceId?: string;
    };

    if (!date) {
      return res.status(400).json({ error: 'Date (YYYY-MM-DD) is required.' });
    }

    const slots = await getAvailableSlots(clinicId, { date, doctorId, serviceId });
    return res.json(slots);
  }
);

clinicRouter.post(
  '/appointments',
  requireClinicPermission('manage_appointments'),
  (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const { patient_id, doctor_id, service_id, date, start_time, notes } = req.body;

    if (!patient_id || !doctor_id || !service_id || !date || !start_time) {
      return res.status(400).json({
        error: 'Missing required appointment fields: patient_id, doctor_id, service_id, date, and start_time are all required.',
      });
    }

    const service = db.getServiceById(clinicId, service_id);
    const duration = service?.duration_minutes || 30;

    const [h, m] = start_time.split(':').map(Number);
    const totalMin = h * 60 + m + duration;
    const endH = Math.floor(totalMin / 60);
    const endM = totalMin % 60;
    const endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

    const appointment: Appointment = {
      id: `apt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      clinic_id: clinicId,
      patient_id,
      doctor_id,
      service_id,
      date,
      start_time,
      end_time: endTime,
      status: 'CONFIRMED',
      created_via: 'staff',
      notes: notes || 'Booked by clinic staff via web dashboard',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = db.createAppointment(appointment);
    if (!result.success) {
      return res.status(409).json({ error: result.error });
    }

    db.logAudit({
      clinic_id: clinicId,
      actor_user_id: req.user!.id,
      actor_name: req.user!.name,
      action: 'APPOINTMENT_BOOKED_BY_STAFF',
      target_type: 'APPOINTMENT',
      target_id: appointment.id,
      metadata: { date, start_time, doctor_id, patient_id },
    });

    return res.status(201).json({ appointment: result.appointment });
  }
);

clinicRouter.put(
  '/appointments/:id/status',
  requireClinicPermission('manage_appointments'),
  (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const appointmentId = req.params.id;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required.' });
    }

    const result = db.updateAppointment(clinicId, appointmentId, {
      status,
      notes: notes !== undefined ? notes : undefined,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    db.logAudit({
      clinic_id: clinicId,
      actor_user_id: req.user!.id,
      actor_name: req.user!.name,
      action: `APPOINTMENT_STATUS_${status}`,
      target_type: 'APPOINTMENT',
      target_id: appointmentId,
      metadata: { status },
    });

    return res.json({ appointment: result.appointment });
  }
);

clinicRouter.post(
  '/appointments/:id/reschedule',
  requireClinicPermission('manage_appointments'),
  (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const appointmentId = req.params.id;
    const { newDate, newStartTime, reason } = req.body;

    if (!newDate || !newStartTime) {
      return res.status(400).json({ error: 'newDate and newStartTime are required.' });
    }

    const existing = db.getAppointmentById(clinicId, appointmentId);
    if (!existing) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    const service = db.getServiceById(clinicId, existing.service_id);
    const duration = service?.duration_minutes || 30;

    const [h, m] = newStartTime.split(':').map(Number);
    const totalMin = h * 60 + m + duration;
    const endH = Math.floor(totalMin / 60);
    const endM = totalMin % 60;
    const newEndTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

    const result = db.updateAppointment(clinicId, appointmentId, {
      date: newDate,
      start_time: newStartTime,
      end_time: newEndTime,
      status: 'RESCHEDULED',
      notes: `${existing.notes || ''} | Rescheduled: ${reason || 'Staff update'}`,
    });

    if (!result.success) {
      return res.status(409).json({ error: result.error });
    }

    db.logAudit({
      clinic_id: clinicId,
      actor_user_id: req.user!.id,
      actor_name: req.user!.name,
      action: 'APPOINTMENT_RESCHEDULED_BY_STAFF',
      target_type: 'APPOINTMENT',
      target_id: appointmentId,
      metadata: { old_date: existing.date, newDate, newStartTime },
    });

    return res.json({ appointment: result.appointment });
  }
);

// -------------------------------------------------------------
// 8. AI Receptionist Configuration (Clinic Admin only)
// -------------------------------------------------------------
clinicRouter.get(
  '/ai-agent',
  requireClinicPermission('view_calls'),
  (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const agent = db.getAiAgent(clinicId);
    const today = new Date().toISOString().split('T')[0];
    const callsToday = db.getCalls(clinicId).filter((c) => c.created_at.startsWith(today)).length;

    return res.json({
      agent,
      callsTodayCount: callsToday,
    });
  }
);

clinicRouter.put(
  '/ai-agent',
  requireClinicPermission('configure_ai_receptionist'),
  (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const { name, greeting, voice_provider, voice_config, languages, status, escalation_contact, instructions_note } = req.body;

    const current = db.getAiAgent(clinicId);
    const updatedAgent: AiAgent = {
      id: current?.id || `agent_${clinicId}`,
      clinic_id: clinicId,
      name: name?.trim() || current?.name || 'AI Receptionist',
      greeting: greeting?.trim() || current?.greeting || 'Thank you for calling.',
      voice_provider: voice_provider || current?.voice_provider || 'gemini_live',
      voice_config: voice_config || current?.voice_config || {},
      languages: languages || current?.languages || ['English'],
      status: status || current?.status || 'ACTIVE',
      escalation_contact: escalation_contact || current?.escalation_contact || {},
      instructions_note: instructions_note !== undefined ? instructions_note : current?.instructions_note,
    };

    const saved = db.saveAiAgent(updatedAgent);

    db.logAudit({
      clinic_id: clinicId,
      actor_user_id: req.user!.id,
      actor_name: req.user!.name,
      action: 'AI_RECEPTIONIST_CONFIG_UPDATED',
      target_type: 'AI_AGENT',
      target_id: saved.id,
      metadata: { voice_provider: saved.voice_provider, status: saved.status },
    });

    return res.json({ agent: saved });
  }
);

// -------------------------------------------------------------
// 9. Calls & Escalations History
// -------------------------------------------------------------
clinicRouter.get(
  '/calls',
  requireClinicPermission('view_calls'),
  (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    let calls = db.getCalls(clinicId);
    if (req.user?.role === 'DOCTOR') {
      calls = calls.filter(c => c.doctor_id === req.user.doctor_id);
    }
    return res.json({ calls });
  }
);

clinicRouter.get(
  '/escalations',
  requireClinicPermission('view_calls'),
  (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const escalations = db.getEscalations(clinicId);
    return res.json({ escalations });
  }
);

clinicRouter.put(
  '/escalations/:id/resolve',
  requireClinicPermission('manage_appointments'),
  (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const escalationId = req.params.id;

    const resolved = db.resolveEscalation(clinicId, escalationId, req.user!.name);
    if (!resolved) {
      return res.status(404).json({ error: 'Escalation not found.' });
    }

    db.logAudit({
      clinic_id: clinicId,
      actor_user_id: req.user!.id,
      actor_name: req.user!.name,
      action: 'ESCALATION_RESOLVED',
      target_type: 'ESCALATION',
      target_id: escalationId,
    });

    return res.json({ escalation: resolved });
  }
);

// -------------------------------------------------------------
// 10. Audit Logs
// -------------------------------------------------------------
clinicRouter.get(
  '/audit-logs',
  requireClinicPermission('view_audit_logs'),
  (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const logs = db.getAuditLogs(clinicId);
    return res.json({ logs });
  }
);
