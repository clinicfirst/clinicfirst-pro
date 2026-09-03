import { supabase } from '../supabaseDiff';
import { db } from '../db';
import { DoctorSchedule } from '../../src/types';
import { DoctorService } from './doctor.service';

export interface SaveScheduleInput {
  id?: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_start?: string;
  break_end?: string;
  buffer_minutes?: number;
}

export class ScheduleService {
  /**
   * List schedules for a clinic, optionally filtered by doctorId.
   * Directly queries PostgreSQL when available; fails closed on DB error.
   */
  static async list(clinicId: string, doctorId?: string): Promise<DoctorSchedule[]> {
    if (!clinicId) return [];

    if (supabase) {
      let query = supabase
        .from('doctor_schedules')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('day_of_week', { ascending: true });

      if (doctorId) {
        query = query.eq('doctor_id', doctorId);
      }

      const { data, error } = await query;
      if (error) {
        console.error('[ScheduleService.list] Supabase query error:', error);
        throw new Error(`Database error fetching schedules: ${error.message}`);
      }

      return (data as DoctorSchedule[]) || [];
    }

    // Explicit offline / dev fallback
    return db.getSchedules(clinicId, doctorId);
  }

  /**
   * Get a doctor's schedule for a specific day of week (0=Sunday, ..., 6=Saturday).
   */
  static async getByDoctorAndDay(
    clinicId: string,
    doctorId: string,
    dayOfWeek: number
  ): Promise<DoctorSchedule | null> {
    if (!clinicId || !doctorId || dayOfWeek < 0 || dayOfWeek > 6) return null;

    if (supabase) {
      const { data, error } = await supabase
        .from('doctor_schedules')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('doctor_id', doctorId)
        .eq('day_of_week', dayOfWeek)
        .maybeSingle();

      if (error) {
        console.error('[ScheduleService.getByDoctorAndDay] Supabase query error:', error);
        throw new Error(`Database error fetching schedule: ${error.message}`);
      }

      return (data as DoctorSchedule) || null;
    }

    // Explicit offline / dev fallback
    const schedules = db.getSchedules(clinicId, doctorId);
    return schedules.find((s) => s.day_of_week === dayOfWeek) || null;
  }

  /**
   * Save (create or update) a doctor's schedule.
   * Validates doctor ownership and tenant isolation.
   */
  static async save(
    clinicId: string,
    input: SaveScheduleInput
  ): Promise<{ success: boolean; schedule?: DoctorSchedule; error?: string; error_code?: string }> {
    if (!clinicId) {
      return { success: false, error_code: 'INVALID_CLINIC', error: 'Clinic ID is required.' };
    }

    const { doctor_id, day_of_week, start_time, end_time, break_start, break_end, buffer_minutes } = input;

    if (!doctor_id || day_of_week === undefined || day_of_week === null || !start_time || !end_time) {
      return {
        success: false,
        error_code: 'VALIDATION_ERROR',
        error: 'doctor_id, day_of_week, start_time, and end_time are required.',
      };
    }

    const dayNum = Number(day_of_week);
    if (isNaN(dayNum) || dayNum < 0 || dayNum > 6) {
      return {
        success: false,
        error_code: 'VALIDATION_ERROR',
        error: 'day_of_week must be an integer between 0 (Sunday) and 6 (Saturday).',
      };
    }

    // Verify doctor belongs to this clinic
    const doctor = await DoctorService.getById(clinicId, doctor_id);
    if (!doctor) {
      return {
        success: false,
        error_code: 'DOCTOR_NOT_FOUND',
        error: 'Doctor not found in this clinic.',
      };
    }

    const scheduleId = input.id || `sched_${doctor_id}_day_${dayNum}`;
    const scheduleRecord: DoctorSchedule = {
      id: scheduleId,
      clinic_id: clinicId,
      doctor_id,
      day_of_week: dayNum,
      start_time: start_time.trim(),
      end_time: end_time.trim(),
      break_start: break_start ? break_start.trim() : undefined,
      break_end: break_end ? break_end.trim() : undefined,
      buffer_minutes: buffer_minutes !== undefined ? Number(buffer_minutes) : 5,
    };

    if (supabase) {
      const { error: upsertError } = await supabase
        .from('doctor_schedules')
        .upsert(scheduleRecord, { onConflict: 'id' });

      if (upsertError) {
        console.error('[ScheduleService.save] Supabase upsert error:', upsertError);
        return {
          success: false,
          error_code: 'DATABASE_ERROR',
          error: `Failed to save schedule: ${upsertError.message}`,
        };
      }

      // Keep local in-memory in sync for dev inspection
      db.saveSchedule(scheduleRecord);

      return { success: true, schedule: scheduleRecord };
    }

    // Explicit offline / dev fallback
    const saved = db.saveSchedule(scheduleRecord);
    return { success: true, schedule: saved };
  }

  /**
   * Delete a doctor's schedule for a specific day of week.
   */
  static async delete(
    clinicId: string,
    doctorId: string,
    dayOfWeek: number
  ): Promise<{ success: boolean; error?: string; error_code?: string }> {
    if (!clinicId || !doctorId || dayOfWeek === undefined || dayOfWeek === null) {
      return {
        success: false,
        error_code: 'VALIDATION_ERROR',
        error: 'clinicId, doctorId, and dayOfWeek are required.',
      };
    }

    const dayNum = Number(dayOfWeek);

    if (supabase) {
      const { error } = await supabase
        .from('doctor_schedules')
        .delete()
        .eq('clinic_id', clinicId)
        .eq('doctor_id', doctorId)
        .eq('day_of_week', dayNum);

      if (error) {
        console.error('[ScheduleService.delete] Supabase delete error:', error);
        return {
          success: false,
          error_code: 'DATABASE_ERROR',
          error: `Failed to delete schedule: ${error.message}`,
        };
      }

      // Update in-memory copy
      db.deleteSchedule(clinicId, doctorId, dayNum);
      return { success: true };
    }

    // Explicit offline / dev fallback
    db.deleteSchedule(clinicId, doctorId, dayNum);
    return { success: true };
  }

  /**
   * Auto-creates standard Mon-Fri schedule (09:00 - 17:00, break 13:00 - 14:00, buffer 5m) for a doctor.
   */
  static async createDefaultScheduleForDoctor(
    clinicId: string,
    doctorId: string
  ): Promise<DoctorSchedule[]> {
    const schedules: DoctorSchedule[] = [];
    for (let day = 1; day <= 5; day++) {
      schedules.push({
        id: `sched_${doctorId}_day_${day}`,
        clinic_id: clinicId,
        doctor_id: doctorId,
        day_of_week: day,
        start_time: '09:00',
        end_time: '17:00',
        break_start: '13:00',
        break_end: '14:00',
        buffer_minutes: 5,
      });
    }

    if (supabase) {
      try {
        await supabase
          .from('doctor_schedules')
          .upsert(schedules, { onConflict: 'id' });
      } catch (err) {
        console.warn('[ScheduleService.createDefaultScheduleForDoctor] Failed to upsert to Supabase:', err);
      }
    }

    for (const s of schedules) {
      db.saveSchedule(s);
    }

    return schedules;
  }
}
