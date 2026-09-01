import { db } from '../../db';

// Helper to convert "HH:MM" to minutes from midnight
function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// Helper to convert minutes from midnight to "HH:MM"
function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export async function getAvailableSlots(
  clinicId: string,
  params: {
    doctorId?: string;
    serviceId?: string;
    date: string; // "YYYY-MM-DD"
    excludeAppointmentId?: string;
  }
) {
  const { doctorId, serviceId, date, excludeAppointmentId } = params;
  if (!date) {
    return { error: 'Date (YYYY-MM-DD) is required to check slot availability.' };
  }

  const clinic = db.getClinicById(clinicId);
  if (!clinic) {
    return { error: 'Clinic not found.' };
  }

  // Determine day of week
  // date format YYYY-MM-DD
  const targetDateObj = new Date(date + 'T00:00:00Z');
  const dayOfWeekIndex = targetDateObj.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
  const dayName = dayNames[dayOfWeekIndex];
  const clinicHours = clinic.operating_hours?.[dayName];

  if (!clinicHours || clinicHours.closed) {
    return {
      available: false,
      reason: `Clinic is closed on ${dayName}s (${date}).`,
      slots: [],
    };
  }

  // Find candidate doctors
  let candidateDoctors = db.getDoctors(clinicId).filter((d) => d.status === 'ACTIVE');
  if (doctorId) {
    candidateDoctors = candidateDoctors.filter((d) => d.id === doctorId);
  } else if (serviceId) {
    const service = db.getServiceById(clinicId, serviceId);
    if (service?.assigned_doctor_ids && service.assigned_doctor_ids.length > 0) {
      candidateDoctors = candidateDoctors.filter((d) => service.assigned_doctor_ids?.includes(d.id));
    }
  }

  if (candidateDoctors.length === 0) {
    return {
      available: false,
      reason: 'No active doctors found for the specified criteria.',
      slots: [],
    };
  }

  // Check if doctor is on leave
  const leaves = db.getLeaves(clinicId);
  if (doctorId && candidateDoctors.length === 1) {
    const doc = candidateDoctors[0];
    const leave = leaves.find(
      (l) => l.doctor_id === doc.id && date >= l.start_date && date <= l.end_date
    );
    if (leave) {
      return {
        available: false,
        on_leave: true,
        leave_reason: leave.reason,
        leave_range: `${leave.start_date} to ${leave.end_date}`,
        reason: `Dr. ${doc.name} is on scheduled leave on ${date} (${leave.reason}). Availability is blocked.`,
        slots: [],
      };
    }
  }

  // Get service duration
  let slotDuration = 30;
  if (serviceId) {
    const service = db.getServiceById(clinicId, serviceId);
    if (service) slotDuration = service.duration_minutes;
  }

  const allAvailableSlots: Array<{
    time: string;
    endTime: string;
    doctorId: string;
    doctorName: string;
  }> = [];

  const existingAppointments = db.getAppointments(clinicId, { date });
  const activeBookings = existingAppointments.filter((a) =>
    ['CONFIRMED', 'REQUESTED', 'RESCHEDULED'].includes(a.status) &&
    (!excludeAppointmentId || a.id !== excludeAppointmentId)
  );

  for (const doc of candidateDoctors) {
    // 1. Check if doctor is on leave
    const isOnLeave = leaves.some(
      (l) => l.doctor_id === doc.id && date >= l.start_date && date <= l.end_date
    );
    if (isOnLeave) {
      continue;
    }

    // 2. Check doctor schedule for this day of week
    const schedules = db.getSchedules(clinicId, doc.id);
    const daySchedule = schedules.find((s) => s.day_of_week === dayOfWeekIndex);
    if (!daySchedule) {
      continue; // Doctor does not work on this day
    }

    const docDuration = doc.consultation_duration_minutes || slotDuration;
    const effectiveDuration = serviceId ? slotDuration : docDuration;
    const buffer = daySchedule.buffer_minutes || 0;

    const schedStartMin = timeToMinutes(daySchedule.start_time);
    const schedEndMin = timeToMinutes(daySchedule.end_time);
    const clinicOpenMin = timeToMinutes(clinicHours.open);
    const clinicCloseMin = timeToMinutes(clinicHours.close);

    const startMin = Math.max(schedStartMin, clinicOpenMin);
    const endMin = Math.min(schedEndMin, clinicCloseMin);

    const breakStartMin = daySchedule.break_start ? timeToMinutes(daySchedule.break_start) : -1;
    const breakEndMin = daySchedule.break_end ? timeToMinutes(daySchedule.break_end) : -1;

    // Doctor's bookings on this day
    const docBookings = activeBookings.filter((a) => a.doctor_id === doc.id);

    let cursor = startMin;
    while (cursor + effectiveDuration <= endMin) {
      const slotStart = cursor;
      const slotEnd = cursor + effectiveDuration;
      const slotTimeStr = minutesToTime(slotStart);
      const slotEndTimeStr = minutesToTime(slotEnd);

      // Check if overlaps break
      const overlapsBreak =
        breakStartMin !== -1 &&
        breakEndMin !== -1 &&
        !(slotEnd <= breakStartMin || slotStart >= breakEndMin);

      // Check if overlaps existing booking
      const overlapsBooking = docBookings.some((b) => {
        const bStart = timeToMinutes(b.start_time);
        const bEnd = timeToMinutes(b.end_time);
        return !(slotEnd <= bStart || slotStart >= bEnd);
      });

      if (!overlapsBreak && !overlapsBooking) {
        allAvailableSlots.push({
          time: slotTimeStr,
          endTime: slotEndTimeStr,
          doctorId: doc.id,
          doctorName: doc.name,
        });
      }

      // Step cursor
      cursor += effectiveDuration + buffer;
    }
  }

  return {
    available: allAvailableSlots.length > 0,
    date,
    total_slots_found: allAvailableSlots.length,
    slots: allAvailableSlots.slice(0, 20), // return top valid slots
    reason: allAvailableSlots.length === 0 ? 'No open consultation slots on this date.' : undefined,
  };
}
