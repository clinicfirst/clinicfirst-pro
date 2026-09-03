import { supabase } from '../supabaseDiff';
import { db } from '../db';
import { DoctorLeave } from '../../src/types';
import { DoctorService } from './doctor.service';

export interface CreateLeaveInput {
  id?: string;
  doctor_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
}

export class LeaveService {
  /**
   * List leaves for a clinic, optionally filtered by doctorId.
   * Direct PostgreSQL query when available; fails closed on DB error.
   */
  static async list(clinicId: string, doctorId?: string): Promise<DoctorLeave[]> {
    if (!clinicId) return [];

    if (supabase) {
      let query = supabase
        .from('doctor_leaves')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('start_date', { ascending: false });

      if (doctorId) {
        query = query.eq('doctor_id', doctorId);
      }

      const { data, error } = await query;
      if (error) {
        console.error('[LeaveService.list] Supabase query error:', error);
        throw new Error(`Database error fetching doctor leaves: ${error.message}`);
      }

      return (data as DoctorLeave[]) || [];
    }

    // Explicit offline / dev fallback
    return db.getLeaves(clinicId, doctorId);
  }

  /**
   * Get a single leave record by ID.
   */
  static async getById(clinicId: string, id: string): Promise<DoctorLeave | null> {
    if (!clinicId || !id) return null;

    if (supabase) {
      const { data, error } = await supabase
        .from('doctor_leaves')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('[LeaveService.getById] Supabase query error:', error);
        throw new Error(`Database error fetching leave: ${error.message}`);
      }

      return (data as DoctorLeave) || null;
    }

    // Explicit offline / dev fallback
    const leaves = db.getLeaves(clinicId);
    return leaves.find((l) => l.id === id) || null;
  }

  /**
   * Create a new doctor leave record.
   * Validates doctor ownership, date range, and tenant isolation.
   */
  static async create(
    clinicId: string,
    input: CreateLeaveInput
  ): Promise<{ success: boolean; leave?: DoctorLeave; error?: string; error_code?: string }> {
    if (!clinicId) {
      return { success: false, error_code: 'INVALID_CLINIC', error: 'Clinic ID is required.' };
    }

    const { doctor_id, start_date, end_date, reason } = input;

    if (!doctor_id || !start_date || !end_date) {
      return {
        success: false,
        error_code: 'VALIDATION_ERROR',
        error: 'doctor_id, start_date, and end_date are required.',
      };
    }

    // Date range validation
    if (end_date < start_date) {
      return {
        success: false,
        error_code: 'INVALID_DATE_RANGE',
        error: 'end_date cannot be earlier than start_date.',
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

    const leaveRecord: DoctorLeave = {
      id: input.id || `leave_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      clinic_id: clinicId,
      doctor_id,
      start_date: start_date.trim(),
      end_date: end_date.trim(),
      reason: reason?.trim() || 'Scheduled Leave',
    };

    if (supabase) {
      const { error } = await supabase.from('doctor_leaves').insert(leaveRecord);
      if (error) {
        console.error('[LeaveService.create] Supabase insert error:', error);
        return {
          success: false,
          error_code: 'DATABASE_ERROR',
          error: `Failed to create leave: ${error.message}`,
        };
      }

      // Update in-memory copy
      db.createLeave(leaveRecord);
      return { success: true, leave: leaveRecord };
    }

    // Explicit offline / dev fallback
    const created = db.createLeave(leaveRecord);
    return { success: true, leave: created };
  }

  /**
   * Delete a leave record by ID within tenant boundary.
   */
  static async delete(
    clinicId: string,
    id: string
  ): Promise<{ success: boolean; error?: string; error_code?: string }> {
    if (!clinicId || !id) {
      return {
        success: false,
        error_code: 'VALIDATION_ERROR',
        error: 'clinicId and id are required.',
      };
    }

    if (supabase) {
      // Check existing leave first to ensure tenant ownership
      const existing = await this.getById(clinicId, id);
      if (!existing) {
        return {
          success: false,
          error_code: 'LEAVE_NOT_FOUND',
          error: 'Leave record not found.',
        };
      }

      const { error } = await supabase
        .from('doctor_leaves')
        .delete()
        .eq('clinic_id', clinicId)
        .eq('id', id);

      if (error) {
        console.error('[LeaveService.delete] Supabase delete error:', error);
        return {
          success: false,
          error_code: 'DATABASE_ERROR',
          error: `Failed to delete leave: ${error.message}`,
        };
      }

      // Update in-memory copy
      db.deleteLeave(clinicId, id);
      return { success: true };
    }

    // Explicit offline / dev fallback
    const deleted = db.deleteLeave(clinicId, id);
    if (!deleted) {
      return { success: false, error_code: 'LEAVE_NOT_FOUND', error: 'Leave record not found.' };
    }
    return { success: true };
  }

  /**
   * Check if a specific doctor is on leave on a given date (YYYY-MM-DD).
   * Queries PostgreSQL directly with date interval condition.
   */
  static async isDoctorOnLeave(
    clinicId: string,
    doctorId: string,
    date: string
  ): Promise<{ onLeave: boolean; leave?: DoctorLeave }> {
    if (!clinicId || !doctorId || !date) {
      return { onLeave: false };
    }

    if (supabase) {
      const { data, error } = await supabase
        .from('doctor_leaves')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('doctor_id', doctorId)
        .lte('start_date', date)
        .gte('end_date', date)
        .limit(1);

      if (error) {
        console.error('[LeaveService.isDoctorOnLeave] Supabase query error:', error);
        throw new Error(`Database error checking doctor leave: ${error.message}`);
      }

      if (data && data.length > 0) {
        return { onLeave: true, leave: data[0] as DoctorLeave };
      }
      return { onLeave: false };
    }

    // Explicit offline / dev fallback
    const leaves = db.getLeaves(clinicId, doctorId);
    const leave = leaves.find((l) => date >= l.start_date && date <= l.end_date);
    if (leave) {
      return { onLeave: true, leave };
    }
    return { onLeave: false };
  }

  /**
   * Get all leaves in a clinic active on a given date (YYYY-MM-DD).
   */
  static async getLeavesForDate(clinicId: string, date: string): Promise<DoctorLeave[]> {
    if (!clinicId || !date) return [];

    if (supabase) {
      const { data, error } = await supabase
        .from('doctor_leaves')
        .select('*')
        .eq('clinic_id', clinicId)
        .lte('start_date', date)
        .gte('end_date', date);

      if (error) {
        console.error('[LeaveService.getLeavesForDate] Supabase query error:', error);
        throw new Error(`Database error fetching leaves for date: ${error.message}`);
      }

      return (data as DoctorLeave[]) || [];
    }

    // Explicit offline / dev fallback
    return db.getLeaves(clinicId).filter((l) => date >= l.start_date && date <= l.end_date);
  }
}
