import { ClinicService } from '../services/clinic.service';
import { UserService } from '../services/user.service';
import { AppointmentService } from '../services/appointment.service';
import { PatientService } from '../services/patient.service';
import { DoctorService } from '../services/doctor.service';
import { KnowledgeService } from "../services/knowledge.service";
import { AuditService } from "../services/audit.service";
import { EscalationService } from "../services/escalation.service";
import { CallService } from "../services/call.service";
import { StaffService } from '../services/staff.service';
import { ScheduleService } from '../services/schedule.service';
import { LeaveService } from '../services/leave.service';
import { ServiceService } from '../services/service.service';
import { AiAgentService } from '../services/ai-agent.service';
import { AiConfigService } from '../services/ai-config.service';
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
import { isSarvamApiConfigured } from '../config/sarvam';
import {
  validateReceptionistPreferences,
  generateSafeGreeting,
  validateGreetingContent,
} from '../services/aiValidator';

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
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const clinicId = getAuthClinicId(req);
      const today = new Date().toISOString().split('T')[0];
      const doctorIdFilter = req.user?.role === 'DOCTOR' ? req.user.doctor_id : undefined;

      const clinic = await ClinicService.getById(clinicId);
      const allAppointments = await AppointmentService.list(clinicId, { date: today, doctor_id: doctorIdFilter });
      const confirmed = allAppointments.filter((a) => a.status === 'CONFIRMED');
      const completed = allAppointments.filter((a) => a.status === 'COMPLETED');
      const rescheduled = allAppointments.filter((a) => a.status === 'RESCHEDULED');
      const cancelled = allAppointments.filter((a) => a.status === 'CANCELLED');

      let allCalls = await CallService.listCalls(clinicId);
      if (req.user?.role === 'DOCTOR') {
        allCalls = allCalls.filter(c => c.doctor_id === req.user.doctor_id);
      }
      const todayCalls = allCalls.filter((c) => c.created_at.startsWith(today));
      const todayAiBooked = todayCalls.filter((c) => c.outcome === 'APPOINTMENT_BOOKED').length;

      let doctors = (await DoctorService.list(clinicId, { status: 'ACTIVE' }));
      if (req.user?.role === 'DOCTOR') {
        doctors = doctors.filter(d => d.id === req.user.doctor_id);
      }
      const doctorMapById = new Map(doctors.map(d => [d.id, d]));
      const aiAgent = await AiAgentService.getAgentByClinic(clinicId);
      const pendingEscalations = (await EscalationService.listEscalations(clinicId))
        .filter((e) => e.status === 'pending');

      const allPatients = await PatientService.list(clinicId);
      const patientMap = new Map(allPatients.map(p => [p.id, p]));
      const allServices = await ServiceService.list(clinicId);
      const serviceMap = new Map(allServices.map(s => [s.id, s]));

      // Next upcoming appointments today with fully hydrated relations
      const enrichedAppointments = await Promise.all(allAppointments.map(async (apt) => {
        const patient = apt.patient || patientMap.get(apt.patient_id) || await PatientService.getById(clinicId, apt.patient_id);
        const doctor = apt.doctor || doctorMapById.get(apt.doctor_id) || await DoctorService.getById(clinicId, apt.doctor_id);
        const service = apt.service || serviceMap.get(apt.service_id);
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
      }));

      const upcomingToday = enrichedAppointments
        .filter((a) => a.status !== 'CANCELLED')
        .sort((a, b) => a.start_time.localeCompare(b.start_time));

      // -----------------------------------------------------------
      // Weekly Trends & Analytics Calculation (Past 7 Days - Pure Database Driven)
      // -----------------------------------------------------------
      const rawAllAppointments = await AppointmentService.list(clinicId, );
      let rawAllCalls = await CallService.listCalls(clinicId);
      if (req.user?.role === 'DOCTOR') {
        rawAllCalls = rawAllCalls.filter(c => c.doctor_id === req.user.doctor_id);
      }

    const newPatientsToday = allPatients.filter(
      (p) => p.created_at && p.created_at.startsWith(today)
    ).length;
    const weekAgoDate = new Date(Date.now() - 7 * 86400000);
    const newPatientsThisWeek = allPatients.filter((p) => {
      try {
        return new Date(p.created_at) >= weekAgoDate;
      } catch (e) {
        return false;
      }
    }).length;

    // Real Call Breakdown (Autonomous AI vs Transferred/Escalated vs Missed)
    let aiAnsweredCount = 0;
    let staffTransferredCount = 0;
    let missedCount = 0;

    rawAllCalls.forEach((call) => {
      const statusStr = String(call.status || '');
      const outcomeStr = String(call.outcome || '').toUpperCase();
      if (
        statusStr === 'escalated' ||
        outcomeStr === 'ESCALATED' ||
        outcomeStr === 'EMERGENCY_ESCALATED' ||
        Boolean(call.escalation_id)
      ) {
        staffTransferredCount++;
      } else if (
        statusStr === 'missed' ||
        statusStr === 'failed' ||
        statusStr === 'dropped' ||
        statusStr === 'abandoned'
      ) {
        missedCount++;
      } else {
        aiAnsweredCount++;
      }
    });

    const totalRawCalls = rawAllCalls.length;
    const aiAnsweredPercent = totalRawCalls > 0 ? Math.round((aiAnsweredCount / totalRawCalls) * 100) : 0;
    const staffTransferredPercent = totalRawCalls > 0 ? Math.round((staffTransferredCount / totalRawCalls) * 100) : 0;
    const missedPercent = totalRawCalls > 0 ? Math.max(0, 100 - aiAnsweredPercent - staffTransferredPercent) : 0;

    const callBreakdown = {
      total: totalRawCalls,
      today: todayCalls.length,
      aiAnsweredCount,
      aiAnsweredPercent,
      staffTransferredCount,
      staffTransferredPercent,
      missedCount,
      missedPercent,
    };

    // Real Top Call Reasons from Database
    const reasonsMap: Record<string, { label: string; count: number; color: string }> = {
      booking: { label: 'Appointment Booking', count: 0, color: '#0052FF' },
      reschedule: { label: 'Reschedule Appointment', count: 0, color: '#00C2CB' },
      cancel: { label: 'Cancel Appointment', count: 0, color: '#94A3B8' },
      inquiry: { label: 'Clinic Information', count: 0, color: '#0284C7' },
      escalation: { label: 'Staff / Emergency Escalation', count: 0, color: '#E11D48' },
      other: { label: 'Other Queries', count: 0, color: '#F59E0B' },
    };

    rawAllCalls.forEach((c) => {
      const outcome = (c.outcome || '').toUpperCase();
      const summary = ((c.summary || '') + ' ' + ((c as any).notes || '')).toLowerCase();
      const statusStr = String(c.status || '');
      if (outcome.includes('BOOKED') || c.appointment_id) {
        reasonsMap.booking.count++;
      } else if (outcome.includes('RESCHEDULE') || summary.includes('reschedule')) {
        reasonsMap.reschedule.count++;
      } else if (outcome.includes('CANCEL') || summary.includes('cancel')) {
        reasonsMap.cancel.count++;
      } else if (outcome.includes('ESCALAT') || statusStr === 'escalated' || c.escalation_id) {
        reasonsMap.escalation.count++;
      } else if (summary.includes('hour') || summary.includes('timing') || summary.includes('doctor') || summary.includes('fee') || summary.includes('address') || outcome.includes('INQUIRY')) {
        reasonsMap.inquiry.count++;
      } else {
        reasonsMap.other.count++;
      }
    });

    const topCallReasons = Object.values(reasonsMap)
      .map((r) => ({
        label: r.label,
        count: r.count,
        percentage: totalRawCalls > 0 ? Math.round((r.count / totalRawCalls) * 100) : 0,
        color: r.color,
      }))
      .filter((r) => totalRawCalls === 0 || r.count > 0)
      .sort((a, b) => b.count - a.count);

    // Calculated Patient Satisfaction and Resolution Rates
    let patientSatisfaction = '5.0';
    if (totalRawCalls > 0) {
      const successFraction = aiAnsweredCount / totalRawCalls;
      const score = Math.min(5.0, 4.0 + successFraction * 1.0);
      patientSatisfaction = score.toFixed(1);
    }

    const aiResolutionRate = totalRawCalls > 0
      ? Math.round((aiAnsweredCount / totalRawCalls) * 100)
      : 100;

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

    const platformAiConfig = await AiConfigService.getPlatformAiConfig();
    const isApiKeySet = Boolean(
      platformAiConfig?.api_key_configured ||
      process.env.GEMINI_API_KEY ||
      isSarvamApiConfigured()
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
        totalAppointmentsCount: rawAllAppointments.length,
        todayConfirmed: confirmed.length,
        todayCompleted: completed.length,
        todayRescheduled: rescheduled.length,
        todayCancelled: cancelled.length,
        todayAiCalls: todayCalls.length,
        totalAiCalls: totalRawCalls,
        todayAiBookedCount: todayAiBooked,
        totalPatientsCount: allPatients.length,
        newPatientsToday,
        newPatientsThisWeek,
        activeDoctorsCount: doctors.length,
        pendingEscalationsCount: pendingEscalations.length,
        patientSatisfaction,
        aiResolutionRate,
        aiActiveHours: isReady ? '24/7' : '0 hrs',
        callBreakdown,
        topCallReasons,
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
  } catch (err: any) {
    console.error('[GET /dashboard] Error:', err);
    return res.status(500).json({ error: 'Failed to load dashboard data.' });
  }
}
);

// -------------------------------------------------------------
// Daily Collection of Fees (Admin only - Strictly Forbidden for Staff)
// -------------------------------------------------------------
clinicRouter.get(
  ['/daily-collection', '/finance/daily-collection'],
  requireClinicPermission('view_daily_collection'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const clinicId = getAuthClinicId(req);
      const clinic = await ClinicService.getById(clinicId);
      const today = (req.query.date as string) || new Date().toISOString().split('T')[0];
      const doctorIdFilter = req.user?.role === 'DOCTOR' ? req.user.doctor_id : undefined;

      const appointments = await AppointmentService.list(clinicId, { date: today, doctor_id: doctorIdFilter });
      const allPatients = await PatientService.list(clinicId);
      const patientMap = new Map(allPatients.map(p => [p.id, p]));
      const allServices = await ServiceService.list(clinicId);
      const serviceLookupMap = new Map(allServices.map(s => [s.id, s]));

      const items = (await Promise.all(appointments
        .map(async (apt) => {
          const patient = apt.patient || patientMap.get(apt.patient_id) || await PatientService.getById(clinicId, apt.patient_id);
          const doctor = apt.doctor || await DoctorService.getById(clinicId, apt.doctor_id);
          const service = apt.service || serviceLookupMap.get(apt.service_id);
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
        })))
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
  } catch (err: any) {
    console.error('[GET /daily-collection] Error:', err);
    return res.status(500).json({ error: 'Failed to load daily collection data.' });
  }
}
);

// -------------------------------------------------------------
// 2. Doctors Management
// -------------------------------------------------------------
clinicRouter.get(
  '/doctors',
  requireClinicPermission('view_doctors'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const clinicId = getAuthClinicId(req);
      let doctors = await DoctorService.list(clinicId);
      if (req.user?.role === 'DOCTOR') {
        doctors = doctors.filter(d => d.id === req.user.doctor_id);
      }
      return res.json({ doctors });
    } catch (err: any) {
      console.error('[GET /doctors] Error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to fetch doctors.' });
    }
  }
);

clinicRouter.post(
  '/doctors',
  requireClinicPermission('manage_doctors'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const clinicId = getAuthClinicId(req);
      const { name, specialization, qualification, phone, email, consultation_duration_minutes } = req.body;

      if (!name || !specialization) {
        return res.status(400).json({ error: 'Doctor name and specialization are required.' });
      }

      const result = await DoctorService.create(clinicId, {
        name,
        specialization,
        qualification,
        phone,
        email,
        consultation_duration_minutes,
        status: 'ACTIVE',
      });

      if (!result.success || !result.doctor) {
        return res.status(400).json({ error: result.error || 'Failed to create doctor.' });
      }

      await AuditService.logAudit({
        clinic_id: clinicId,
        actor_user_id: req.user!.id,
        actor_name: req.user!.name,
        action: 'DOCTOR_CREATED',
        target_type: 'DOCTOR',
        target_id: result.doctor.id,
        metadata: { name: result.doctor.name, specialization: result.doctor.specialization },
      });

      return res.status(201).json({ doctor: result.doctor });
    } catch (err: any) {
      console.error('[POST /doctors] Error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to create doctor.' });
    }
  }
);

clinicRouter.put(
  '/doctors/:id',
  requireClinicPermission('manage_doctors'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const clinicId = getAuthClinicId(req);
      const doctorId = req.params.id;
      const updates = req.body;

      const result = await DoctorService.update(clinicId, doctorId, updates);
      if (!result.success || !result.doctor) {
        return res
          .status(result.error_code === 'DOCTOR_NOT_FOUND' ? 404 : 400)
          .json({ error: result.error || 'Doctor not found.' });
      }

      await AuditService.logAudit({
        clinic_id: clinicId,
        actor_user_id: req.user!.id,
        actor_name: req.user!.name,
        action: updates.status === 'INACTIVE' ? 'DOCTOR_DEACTIVATED' : 'DOCTOR_UPDATED',
        target_type: 'DOCTOR',
        target_id: doctorId,
        metadata: updates,
      });

      return res.json({ doctor: result.doctor });
    } catch (err: any) {
      console.error('[PUT /doctors/:id] Error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to update doctor.' });
    }
  }
);

// -------------------------------------------------------------
// 3. Staff Management (Clinic Admin only)
// -------------------------------------------------------------
clinicRouter.get(
  '/staff',
  requireClinicPermission('view_staff'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const clinicId = getAuthClinicId(req);
      const staff = await StaffService.listStaff(clinicId);
      return res.json({ staff });
    } catch (err: any) {
      console.error('[GET /staff] Error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to fetch staff.' });
    }
  }
);

clinicRouter.post(
  '/staff',
  requireClinicPermission('manage_staff'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const clinicId = getAuthClinicId(req);
      const { name, email, phone, tempPassword } = req.body;

      if (!name || !email || !tempPassword) {
        return res.status(400).json({ error: 'Staff name, email, and temporary password are required.' });
      }

      const result = await StaffService.create(clinicId, {
        role: 'CLINIC_STAFF',
        name: name.trim(),
        email: email.trim(),
        phone: phone?.trim(),
        status: 'ACTIVE',
        must_change_password: true,
        password_hash: hashPassword(tempPassword),
      });

      if (!result.success || !result.user) {
        return res.status(result.error_code === 'EMAIL_ALREADY_EXISTS' ? 400 : 500).json({
          error: result.error || 'Failed to create staff member.',
        });
      }

      await AuditService.logAudit({
        clinic_id: clinicId,
        actor_user_id: req.user!.id,
        actor_name: req.user!.name,
        action: 'STAFF_CREATED',
        target_type: 'USER',
        target_id: result.user.id,
        metadata: { name: result.user.name, email: result.user.email },
      });

      return res.status(201).json({ staff: result.user });
    } catch (err: any) {
      console.error('[POST /staff] Error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to create staff member.' });
    }
  }
);

clinicRouter.put(
  '/staff/:id',
  requireClinicPermission('manage_staff'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const clinicId = getAuthClinicId(req);
      const staffId = req.params.id;
      const updates = req.body;

      const result = await StaffService.update(staffId, updates, clinicId);
      if (!result.success || !result.user) {
        return res
          .status(result.error_code === 'USER_NOT_FOUND' ? 404 : 400)
          .json({ error: result.error || 'Staff member not found.' });
      }

      await AuditService.logAudit({
        clinic_id: clinicId,
        actor_user_id: req.user!.id,
        actor_name: req.user!.name,
        action: updates.status === 'INACTIVE' ? 'STAFF_DEACTIVATED' : 'STAFF_UPDATED',
        target_type: 'USER',
        target_id: staffId,
        metadata: updates,
      });

      return res.json({ staff: result.user });
    } catch (err: any) {
      console.error('[PUT /staff/:id] Error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to update staff member.' });
    }
  }
);

clinicRouter.post(
  '/staff/:id/reset-password',
  requireClinicPermission('manage_staff'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const clinicId = getAuthClinicId(req);
      const staffId = req.params.id;
      const { newTempPassword } = req.body;

      if (!newTempPassword || newTempPassword.length < 8) {
        return res.status(400).json({ error: 'Temporary password must be at least 8 characters long.' });
      }

      const targetUser = await StaffService.getById(staffId, clinicId);
      if (!targetUser) {
        return res.status(404).json({ error: 'Staff member not found.' });
      }

      const result = await StaffService.resetPassword(staffId, hashPassword(newTempPassword), clinicId);
      if (!result.success) {
        return res.status(500).json({ error: result.error || 'Failed to reset password.' });
      }

      await AuditService.logAudit({
        clinic_id: clinicId,
        actor_user_id: req.user!.id,
        actor_name: req.user!.name,
        action: 'STAFF_PASSWORD_RESET',
        target_type: 'USER',
        target_id: staffId,
        metadata: { target_email: targetUser.email },
      });

      return res.json({ success: true, message: 'Temporary password reset successfully.' });
    } catch (err: any) {
      console.error('[POST /staff/:id/reset-password] Error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to reset password.' });
    }
  }
);

// -------------------------------------------------------------
// 4. Services Management
// -------------------------------------------------------------
clinicRouter.get(
  '/services',
  requireClinicPermission('view_services'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const clinicId = getAuthClinicId(req);
      const doctorId = req.user?.role === 'DOCTOR' ? req.user.doctor_id : undefined;
      const services = await ServiceService.list(clinicId, { doctorId });
      return res.json({ services });
    } catch (err: any) {
      console.error('[GET /api/clinic/services] Error:', err);
      return res.status(500).json({ error: err.message || 'Failed to fetch services.' });
    }
  }
);

clinicRouter.post(
  '/services',
  requireClinicPermission('manage_services'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const clinicId = getAuthClinicId(req);
      const { name, duration_minutes, fee, assigned_doctor_ids, status } = req.body;

      const result = await ServiceService.create(clinicId, {
        name,
        duration_minutes,
        fee,
        assigned_doctor_ids,
        status,
      });

      if (!result.success || !result.service) {
        const statusCode = result.error_code === 'VALIDATION_ERROR' ? 400 : 500;
        return res.status(statusCode).json({ error: result.error || 'Failed to create service.' });
      }

      await AuditService.logAudit({
        clinic_id: clinicId,
        actor_user_id: req.user!.id,
        actor_name: req.user!.name,
        action: 'SERVICE_CREATED',
        target_type: 'SERVICE',
        target_id: result.service.id,
        metadata: { name: result.service.name, fee: result.service.fee },
      });

      return res.status(201).json({ service: result.service });
    } catch (err: any) {
      console.error('[POST /api/clinic/services] Error:', err);
      return res.status(500).json({ error: err.message || 'Failed to create service.' });
    }
  }
);

clinicRouter.put(
  '/services/:id',
  requireClinicPermission('manage_services'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const clinicId = getAuthClinicId(req);
      const serviceId = req.params.id;
      const updates = req.body;

      const result = await ServiceService.update(clinicId, serviceId, updates);
      if (!result.success || !result.service) {
        const statusCode =
          result.error_code === 'SERVICE_NOT_FOUND'
            ? 404
            : result.error_code === 'VALIDATION_ERROR'
            ? 400
            : 500;
        return res.status(statusCode).json({ error: result.error || 'Failed to update service.' });
      }

      await AuditService.logAudit({
        clinic_id: clinicId,
        actor_user_id: req.user!.id,
        actor_name: req.user!.name,
        action: updates.status === 'INACTIVE' ? 'SERVICE_DEACTIVATED' : 'SERVICE_UPDATED',
        target_type: 'SERVICE',
        target_id: serviceId,
        metadata: updates,
      });

      return res.json({ service: result.service });
    } catch (err: any) {
      console.error('[PUT /api/clinic/services/:id] Error:', err);
      return res.status(500).json({ error: err.message || 'Failed to update service.' });
    }
  }
);

// -------------------------------------------------------------
// 5. Schedules & Leaves Management
// -------------------------------------------------------------
clinicRouter.get(
  '/schedules',
  requireClinicPermission('view_schedules'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const clinicId = getAuthClinicId(req);
      const doctorId = req.user?.role === 'DOCTOR' ? req.user.doctor_id : (req.query.doctor_id as string | undefined);

      const [schedules, leaves] = await Promise.all([
        ScheduleService.list(clinicId, doctorId),
        LeaveService.list(clinicId, doctorId),
      ]);

      return res.json({ schedules, leaves });
    } catch (err: any) {
      console.error('[GET /schedules] Error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to retrieve schedules and leaves.' });
    }
  }
);

clinicRouter.post(
  '/schedules',
  requireClinicPermission('manage_schedules'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const clinicId = getAuthClinicId(req);
      const { doctor_id, day_of_week, start_time, end_time, break_start, break_end, buffer_minutes } = req.body;

      if (!doctor_id || day_of_week === undefined || !start_time || !end_time) {
        return res.status(400).json({ error: 'doctor_id, day_of_week, start_time, and end_time are required.' });
      }

      const result = await ScheduleService.save(clinicId, {
        doctor_id,
        day_of_week: Number(day_of_week),
        start_time,
        end_time,
        break_start,
        break_end,
        buffer_minutes: buffer_minutes !== undefined ? Number(buffer_minutes) : 5,
      });

      if (!result.success || !result.schedule) {
        return res.status(result.error_code === 'DOCTOR_NOT_FOUND' ? 404 : 400).json({
          error: result.error || 'Failed to save schedule.',
        });
      }

      await AuditService.logAudit({
        clinic_id: clinicId,
        actor_user_id: req.user!.id,
        actor_name: req.user!.name,
        action: 'SCHEDULE_UPDATED',
        target_type: 'SCHEDULE',
        target_id: result.schedule.id,
        metadata: result.schedule,
      });

      return res.json({ schedule: result.schedule });
    } catch (err: any) {
      console.error('[POST /schedules] Error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to save schedule.' });
    }
  }
);

clinicRouter.delete(
  '/schedules',
  requireClinicPermission('manage_schedules'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const clinicId = getAuthClinicId(req);
      const doctorId = req.query.doctor_id as string;
      const dayOfWeek = req.query.day_of_week as string;

      if (!doctorId || dayOfWeek === undefined) {
        return res.status(400).json({ error: 'doctor_id and day_of_week are required.' });
      }

      const result = await ScheduleService.delete(clinicId, doctorId, Number(dayOfWeek));
      if (!result.success) {
        return res.status(500).json({ error: result.error || 'Failed to delete schedule.' });
      }

      await AuditService.logAudit({
        clinic_id: clinicId,
        actor_user_id: req.user!.id,
        actor_name: req.user!.name,
        action: 'SCHEDULE_DELETED',
        target_type: 'SCHEDULE',
        target_id: `sched_${doctorId}_day_${dayOfWeek}`,
        metadata: { doctor_id: doctorId, day_of_week: Number(dayOfWeek) },
      });

      return res.json({ success: true });
    } catch (err: any) {
      console.error('[DELETE /schedules] Error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to delete schedule.' });
    }
  }
);

clinicRouter.post(
  '/leaves',
  requireClinicPermission('manage_schedules'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const clinicId = getAuthClinicId(req);
      const { doctor_id, start_date, end_date, reason } = req.body;

      if (!doctor_id || !start_date || !end_date) {
        return res.status(400).json({ error: 'doctor_id, start_date, and end_date are required.' });
      }

      const result = await LeaveService.create(clinicId, {
        doctor_id,
        start_date,
        end_date,
        reason: reason || 'Scheduled Leave',
      });

      if (!result.success || !result.leave) {
        return res.status(result.error_code === 'DOCTOR_NOT_FOUND' ? 404 : 400).json({
          error: result.error || 'Failed to create leave.',
        });
      }

      await AuditService.logAudit({
        clinic_id: clinicId,
        actor_user_id: req.user!.id,
        actor_name: req.user!.name,
        action: 'DOCTOR_LEAVE_LOGGED',
        target_type: 'LEAVE',
        target_id: result.leave.id,
        metadata: result.leave,
      });

      return res.status(201).json({ leave: result.leave });
    } catch (err: any) {
      console.error('[POST /leaves] Error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to create leave record.' });
    }
  }
);

clinicRouter.delete(
  '/leaves/:id',
  requireClinicPermission('manage_schedules'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const clinicId = getAuthClinicId(req);
      const leaveId = req.params.id;

      const result = await LeaveService.delete(clinicId, leaveId);
      if (!result.success) {
        return res.status(result.error_code === 'LEAVE_NOT_FOUND' ? 404 : 500).json({
          error: result.error || 'Leave record not found.',
        });
      }

      await AuditService.logAudit({
        clinic_id: clinicId,
        actor_user_id: req.user!.id,
        actor_name: req.user!.name,
        action: 'DOCTOR_LEAVE_CANCELLED',
        target_type: 'LEAVE',
        target_id: leaveId,
      });

      return res.json({ success: true });
    } catch (err: any) {
      console.error('[DELETE /leaves/:id] Error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to delete leave record.' });
    }
  }
);

// -------------------------------------------------------------
// 6. Patients Management
// -------------------------------------------------------------
clinicRouter.get(
  '/patients',
  requireClinicPermission('view_patients'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const clinicId = getAuthClinicId(req);
      const search = req.query.search as string | undefined;

      let patients = await PatientService.list(clinicId, search);
      if (req.user?.role === 'DOCTOR') {
        const myPatientIds = new Set((await AppointmentService.list(clinicId, { doctor_id: req.user.doctor_id })).map(a => a.patient_id));
        patients = patients.filter(p => myPatientIds.has(p.id));
      }
      return res.json({ patients });
    } catch (err: any) {
      console.error('[GET /patients] Error:', err);
      return res.status(500).json({ error: 'Failed to retrieve patients.' });
    }
  }
);

clinicRouter.get(
  '/patients/:id',
  requireClinicPermission('view_patients'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const clinicId = getAuthClinicId(req);
      const patientId = req.params.id;

      const patient = await PatientService.getById(clinicId, patientId);
      if (!patient) {
        return res.status(404).json({ error: 'Patient not found.' });
      }

      const appointments = (await AppointmentService.list(clinicId, )).filter((a) => a.patient_id === patientId);
      const calls = (await CallService.listCalls(clinicId)).filter((c) => c.patient_id === patientId);

      return res.json({ patient, appointments, calls });
    } catch (err: any) {
      console.error('[GET /patients/:id] Error:', err);
      return res.status(500).json({ error: 'Failed to retrieve patient details.' });
    }
  }
);

clinicRouter.post(
  '/patients',
  requireClinicPermission('manage_patients'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const clinicId = getAuthClinicId(req);
      const { name, phone, email, dob, gender, preferred_language, notes } = req.body;

      if (!name || !phone) {
        return res.status(400).json({ error: 'Patient name and phone number are required.' });
      }

      const result = await PatientService.create(clinicId, {
        name: name.trim(),
        phone: phone.trim(),
        email: email?.trim() || '',
        dob: dob || '',
        gender: gender || 'Prefer not to say',
        preferred_language: preferred_language || 'English',
        notes: notes || '',
      });

      if (!result.success || !result.patient) {
        return res.status(500).json({ error: result.error || 'Failed to create patient.' });
      }

      const created = result.patient;

      await AuditService.logAudit({
        clinic_id: clinicId,
        actor_user_id: req.user!.id,
        actor_name: req.user!.name,
        action: 'PATIENT_CREATED',
        target_type: 'PATIENT',
        target_id: created.id,
        metadata: { name: created.name, phone: created.phone },
      });

      return res.status(201).json({ patient: created });
    } catch (err: any) {
      console.error('[POST /patients] Error:', err);
      return res.status(500).json({ error: 'Failed to create patient.' });
    }
  }
);

clinicRouter.put(
  '/patients/:id',
  requireClinicPermission('manage_patients'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const clinicId = getAuthClinicId(req);
      const patientId = req.params.id;
      const updates = req.body;

      const result = await PatientService.update(clinicId, patientId, updates);
      if (!result.success || !result.patient) {
        if (result.error_code === 'PATIENT_NOT_FOUND') {
          return res.status(404).json({ error: 'Patient not found.' });
        }
        return res.status(500).json({ error: result.error || 'Failed to update patient.' });
      }

      return res.json({ patient: result.patient });
    } catch (err: any) {
      console.error('[PUT /patients/:id] Error:', err);
      return res.status(500).json({ error: 'Failed to update patient.' });
    }
  }
);

// -------------------------------------------------------------
// 7. Appointments & Real-Time Availability
// -------------------------------------------------------------
clinicRouter.get(
  '/appointments',
  requireClinicPermission('view_appointments'),
  async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const { date, doctor_id, status } = req.query as {
      date?: string;
      doctor_id?: string;
      status?: string;
    };

    const appointments = await AppointmentService.list(clinicId, { date, doctor_id, status });
    return res.json({ appointments });
  }
);

clinicRouter.get(
  '/available-slots',
  requireClinicPermission('view_appointments'),
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
  async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const { patient_id, doctor_id, service_id, date, start_time, notes } = req.body;

    const result = await AppointmentService.book(clinicId, {
      patientId: patient_id,
      doctorId: doctor_id,
      serviceId: service_id,
      date,
      startTime: start_time,
      notes
    }, {
      type: 'HUMAN_RECEPTIONIST',
      userId: req.user!.id,
      name: req.user!.name
    });

    if (!result.success) {
      const status = result.error_code === 'SLOT_NO_LONGER_AVAILABLE' || result.error_code === 'VALIDATION_ERROR' ? 409 : 400;
      return res.status(status).json({ error: result.error });
    }

    return res.status(201).json({ appointment: result.appointment });
  }
);

clinicRouter.put(
  '/appointments/:id/status',
  requireClinicPermission('manage_appointments'),
  async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const appointmentId = req.params.id;
    const { status, notes } = req.body;

    const result = await AppointmentService.updateStatus(clinicId, appointmentId, {
      status,
      notes: notes !== undefined ? notes : undefined
    }, {
      type: 'HUMAN_RECEPTIONIST',
      userId: req.user!.id,
      name: req.user!.name
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({ appointment: result.appointment });
  }
);

clinicRouter.post(
  '/appointments/:id/reschedule',
  requireClinicPermission('manage_appointments'),
  async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const appointmentId = req.params.id;
    const { newDate, newStartTime, reason } = req.body;

    const result = await AppointmentService.reschedule(clinicId, appointmentId, {
      newDate,
      newStartTime,
      reason
    }, {
      type: 'HUMAN_RECEPTIONIST',
      userId: req.user!.id,
      name: req.user!.name
    });

    if (!result.success) {
      const status = result.error_code === 'SLOT_NO_LONGER_AVAILABLE' || result.error_code === 'VALIDATION_ERROR' ? 409 : 400;
      return res.status(status).json({ error: result.error });
    }

    return res.json({ appointment: result.appointment });
  }
);

// -------------------------------------------------------------
// 8. AI Receptionist Configuration (Clinic Admin only)
// -------------------------------------------------------------
clinicRouter.get(
  '/me/ai-widget-config',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // 1. Authenticated user exists & clinic membership is valid
      const clinicId = req.user?.clinic_id;
      if (!clinicId) {
        return res.status(403).json({ error: 'User does not belong to a valid clinic' });
      }

      // 2. Platform AI is enabled
      const isPlatformEnabled = await AiConfigService.isPlatformAiEnabled();
      if (!isPlatformEnabled) {
        return res.status(403).json({ error: 'Platform AI features are currently disabled.' });
      }

      // 3. Clinic AI agent exists and is enabled
      const agent = await AiAgentService.getAgentByClinic(clinicId);
      if (!agent || agent.status !== 'ACTIVE' || !agent.enabled) {
        return res.status(403).json({ error: 'AI Receptionist is not enabled for this clinic.' });
      }

      // 4. Provider agent ID is configured
      const providerAgentId = agent.provider_agent_id;
      if (!providerAgentId) {
        return res.status(404).json({ error: 'AI Receptionist provider agent is not configured for this clinic.' });
      }

      // 5. Return browser-safe configuration required by the Sarvam Embed
      const orgId = process.env.VITE_SARVAM_ORG_ID || 'demo-org-id';
      const workspaceId = process.env.VITE_SARVAM_WORKSPACE_ID || 'demo-workspace-id';
      const embedKey = process.env.VITE_SARVAM_EMBED_KEY || 'demo-embed-key';
      
      return res.json({
        enabled: true,
        clinic_id: clinicId,
        provider_agent_id: providerAgentId,
        appId: providerAgentId,
        orgId: orgId,
        workspaceId: workspaceId,
        embedKey: embedKey,
      });
    } catch (err: any) {
      console.error('[GET /me/ai-widget-config] Error:', err);
      return res.status(500).json({ error: 'Failed to retrieve AI widget configuration.' });
    }
  }
);

clinicRouter.get(
  '/ai-agent',
  requireClinicPermission('view_calls'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const clinicId = getAuthClinicId(req);
      const agent = await AiAgentService.getAgentByClinic(clinicId);
      const today = new Date().toISOString().split('T')[0];
      const callsToday = (await CallService.listCalls(clinicId)).filter((c) => c.created_at.startsWith(today)).length;

      return res.json({
        agent,
        callsTodayCount: callsToday,
      });
    } catch (err: any) {
      console.error('[GET /ai-agent] Error:', err);
      return res.status(500).json({ error: 'Failed to load AI Receptionist configuration.' });
    }
  }
);

clinicRouter.put(
  '/ai-agent',
  requireClinicPermission('configure_ai_receptionist'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const clinicId = getAuthClinicId(req);
      const clinic = await ClinicService.getById(clinicId);
      if (!clinic) {
        return res.status(404).json({ error: 'Clinic not found.' });
      }

      const {
        name,
        greeting,
        greeting_style,
        voice_provider,
        voice_config,
        languages,
        status,
        escalation_contact,
        instructions_note,
        provider_agent_id,
        enabled,
      } = req.body;

      // Defense-in-depth validation for Receptionist Preferences & Instructions
      if (instructions_note !== undefined && instructions_note !== null) {
        const valResult = validateReceptionistPreferences(instructions_note);
        if (!valResult.isValid) {
          return res.status(400).json({ error: valResult.error });
        }
      }

      // Check cross-clinic uniqueness of provider_agent_id if specified
      if (
        provider_agent_id !== undefined &&
        provider_agent_id !== null &&
        typeof provider_agent_id === 'string' &&
        provider_agent_id.trim().length > 0
      ) {
        const trimmedProviderId = provider_agent_id.trim();
        const existingWithProvider = await AiAgentService.getAgentByProviderAgentId(trimmedProviderId);
        if (existingWithProvider && existingWithProvider.clinic_id !== clinicId) {
          return res.status(409).json({ error: 'This provider agent ID is already assigned to another clinic.' });
        }
      }

      const current = await AiAgentService.getAgentByClinic(clinicId);

      // Resolve AI Greeting safely from template/style + authoritative clinic name
      let resolvedGreeting = current?.greeting;
      if (greeting !== undefined || greeting_style !== undefined) {
        const templateOrStyle = greeting_style || greeting;
        resolvedGreeting = generateSafeGreeting(clinic.name, templateOrStyle);
        const greetingVal = validateGreetingContent(resolvedGreeting);
        if (!greetingVal.isValid) {
          return res.status(400).json({ error: greetingVal.error });
        }
      }

      if (!resolvedGreeting) {
        resolvedGreeting = generateSafeGreeting(clinic.name);
      }

      const updatedAgentPayload: Partial<AiAgent> = {
        name: name?.trim() || current?.name || 'AI Receptionist',
        greeting: resolvedGreeting,
        voice_provider: voice_provider || current?.voice_provider || 'gemini_live',
        voice_config: voice_config || current?.voice_config || {},
        languages: languages || current?.languages || ['English'],
        status: status || current?.status || 'ACTIVE',
        enabled: enabled !== undefined ? Boolean(enabled) : (status ? status === 'ACTIVE' : (current?.enabled ?? true)),
        escalation_contact: escalation_contact || current?.escalation_contact || {},
        instructions_note:
          instructions_note !== undefined
            ? (typeof instructions_note === 'string' ? instructions_note.trim() : instructions_note)
            : current?.instructions_note,
        provider_agent_id:
          provider_agent_id !== undefined
            ? (typeof provider_agent_id === 'string' ? provider_agent_id.trim() || undefined : undefined)
            : current?.provider_agent_id,
      };

      const saved = await AiAgentService.updateAgent(clinicId, updatedAgentPayload);

      await AuditService.logAudit({
        clinic_id: clinicId,
        actor_user_id: req.user!.id,
        actor_name: req.user!.name,
        action: 'AI_RECEPTIONIST_CONFIG_UPDATED',
        target_type: 'AI_AGENT',
        target_id: saved.id,
        metadata: { voice_provider: saved.voice_provider, status: saved.status },
      });

      return res.json({ agent: saved });
    } catch (err: any) {
      console.error('[PUT /ai-agent] Error:', err);
      return res.status(500).json({ error: 'Failed to update AI Receptionist configuration.' });
    }
  }
);

// -------------------------------------------------------------
// 9. Calls & Escalations History
// -------------------------------------------------------------
clinicRouter.get(
  '/calls',
  requireClinicPermission('view_calls'),
  async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    let calls = await CallService.listCalls(clinicId);
    if (req.user?.role === 'DOCTOR') {
      calls = calls.filter(c => c.doctor_id === req.user.doctor_id);
    }
    return res.json({ calls });
  }
);

clinicRouter.get(
  '/escalations',
  requireClinicPermission('view_calls'),
  async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const escalations = await EscalationService.listEscalations(clinicId);
    return res.json({ escalations });
  }
);

clinicRouter.put(
  '/escalations/:id/resolve',
  requireClinicPermission('manage_appointments'),
  async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const escalationId = req.params.id;

    const resolved = await EscalationService.resolveEscalation(clinicId, escalationId, req.user!.name);
    if (!resolved) {
      return res.status(404).json({ error: 'Escalation not found.' });
    }

    await AuditService.logAudit({
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
  async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const logs = await AuditService.listAuditLogs(clinicId);
    return res.json({ logs });
  }
);

// -------------------------------------------------------------
// 11. Clinic AI Knowledge (Read-only for Clinic Users, Governed by Platform Admin)
// -------------------------------------------------------------
clinicRouter.get(
  ['/ai-knowledge', '/me/ai-knowledge'],
  requireClinicPermission('view_ai_receptionist'),
  async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const { status, category, search } = req.query;

    const items = await KnowledgeService.listClinicKnowledge(clinicId, {
      status: status as string,
      category: category as string,
      search: search as string,
    });

    return res.json({
      clinic_id: clinicId,
      items,
      total: items.length,
    });
  }
);

clinicRouter.post(
  '/ai-knowledge',
  async (req: AuthenticatedRequest, res: Response) => {
    return res.status(403).json({
      error: 'Clinic AI Rules & Knowledge are governed exclusively by the Platform Administrator. To add or modify clinic rules, please contact your Platform Administrator.',
    });
  }
);

clinicRouter.put(
  '/ai-knowledge/:id',
  async (req: AuthenticatedRequest, res: Response) => {
    return res.status(403).json({
      error: 'Clinic AI Rules & Knowledge are governed exclusively by the Platform Administrator. To edit clinic rules, please contact your Platform Administrator.',
    });
  }
);

clinicRouter.delete(
  '/ai-knowledge/:id',
  async (req: AuthenticatedRequest, res: Response) => {
    return res.status(403).json({
      error: 'Clinic AI Rules & Knowledge are governed exclusively by the Platform Administrator. To delete clinic rules, please contact your Platform Administrator.',
    });
  }
);

clinicRouter.post(
  '/ai-knowledge/publish',
  async (req: AuthenticatedRequest, res: Response) => {
    return res.status(403).json({
      error: 'Clinic AI Knowledge publishing is restricted to the Platform Administrator.',
    });
  }
);

