import { supabase } from '../supabaseDiff';
import { db, hashPassword } from '../db';
import { Doctor } from '../../src/types';
import { ScheduleService } from './schedule.service';

export interface CreateDoctorInput {
  id?: string;
  name: string;
  specialization: string;
  qualification?: string;
  phone?: string;
  email?: string;
  consultation_duration_minutes?: number;
  status?: 'ACTIVE' | 'INACTIVE';
}

export class DoctorService {
  /**
   * Retrieves all doctors for a clinic, with optional status or ID filter.
   * Direct PostgreSQL query when configured; offline fallback otherwise.
   */
  static async list(
    clinicId: string,
    filter?: { status?: 'ACTIVE' | 'INACTIVE'; doctorId?: string }
  ): Promise<Doctor[]> {
    if (!clinicId) return [];

    if (supabase) {
      let query = supabase
        .from('doctors')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('name', { ascending: true });

      if (filter?.status) {
        query = query.eq('status', filter.status);
      }
      if (filter?.doctorId) {
        query = query.eq('id', filter.doctorId);
      }

      const { data, error } = await query;
      if (error) {
        console.error('[DoctorService.list] Supabase query error:', error);
        throw new Error(`Database error fetching doctors: ${error.message}`);
      }
      return (data as Doctor[]) || [];
    }

    // Offline / dev fallback
    let doctors = db.getDoctors(clinicId);
    if (filter?.status) {
      doctors = doctors.filter((d) => d.status === filter.status);
    }
    if (filter?.doctorId) {
      doctors = doctors.filter((d) => d.id === filter.doctorId);
    }
    return doctors;
  }

  /**
   * Retrieves a single doctor by ID within the clinic tenant boundary.
   */
  static async getById(clinicId: string, id: string): Promise<Doctor | null> {
    if (!clinicId || !id) return null;

    if (supabase) {
      const { data, error } = await supabase
        .from('doctors')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('[DoctorService.getById] Supabase query error:', error);
        throw new Error(`Database error fetching doctor by id: ${error.message}`);
      }
      return (data as Doctor) || null;
    }

    return db.getDoctorById(clinicId, id) || null;
  }

  /**
   * Synchronously creates a new doctor directly in PostgreSQL.
   * Also provisions a linked user account and standard default schedule.
   */
  static async create(
    clinicId: string,
    input: CreateDoctorInput
  ): Promise<{ success: boolean; doctor?: Doctor; error?: string; error_code?: string }> {
    if (!clinicId) {
      return { success: false, error_code: 'INVALID_CLINIC', error: 'Clinic ID is required.' };
    }
    if (!input.name || !input.name.trim()) {
      return { success: false, error_code: 'VALIDATION_ERROR', error: 'Doctor name is required.' };
    }
    if (!input.specialization || !input.specialization.trim()) {
      return { success: false, error_code: 'VALIDATION_ERROR', error: 'Specialization is required.' };
    }

    const doctorId = input.id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newDoctor: Doctor = {
      id: doctorId,
      clinic_id: clinicId,
      name: input.name.trim(),
      specialization: input.specialization.trim(),
      qualification: input.qualification?.trim() || '',
      phone: input.phone?.trim() || '',
      email: input.email?.trim() || '',
      consultation_duration_minutes: Number(input.consultation_duration_minutes) || 30,
      status: input.status || 'ACTIVE',
      created_at: new Date().toISOString(),
    };

    if (supabase) {
      const { error } = await supabase.from('doctors').insert(newDoctor);
      if (error) {
        console.error('[DoctorService.create] Supabase insert error:', error);
        return {
          success: false,
          error_code: 'DATABASE_ERROR',
          error: `Failed to create doctor record: ${error.message}`,
        };
      }

      // Auto-create user account if email provided
      if (newDoctor.email) {
        const cleanEmail = newDoctor.email.toLowerCase().trim();
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .ilike('email', cleanEmail)
          .maybeSingle();

        if (!existingUser) {
          const doctorUser = {
            id: `usr_${newDoctor.id}`,
            clinic_id: newDoctor.clinic_id,
            role: 'DOCTOR',
            name: newDoctor.name,
            email: cleanEmail,
            phone: newDoctor.phone || null,
            status: newDoctor.status,
            must_change_password: true,
            created_at: new Date().toISOString(),
            password_hash: hashPassword('DoctorPass2026!'),
            doctor_id: newDoctor.id,
          };
          const { error: userErr } = await supabase.from('users').insert(doctorUser);
          if (!userErr) {
            db.createUserInMemory(doctorUser as any);
          }
        }
      }

      // Auto-create standard Mon-Fri schedule via ScheduleService
      await ScheduleService.createDefaultScheduleForDoctor(clinicId, newDoctor.id);

      // Update in-memory copy
      db.createDoctorInMemory(newDoctor);
      return { success: true, doctor: newDoctor };
    }

    // Offline / dev fallback
    const saved = db.createDoctor(newDoctor);
    await ScheduleService.createDefaultScheduleForDoctor(clinicId, newDoctor.id);
    return { success: true, doctor: saved };
  }

  /**
   * Synchronously updates an existing doctor in PostgreSQL.
   */
  static async update(
    clinicId: string,
    id: string,
    updates: Partial<Doctor>
  ): Promise<{ success: boolean; doctor?: Doctor; error?: string; error_code?: string }> {
    if (!clinicId || !id) {
      return { success: false, error_code: 'VALIDATION_ERROR', error: 'Clinic ID and Doctor ID are required.' };
    }

    // Strip unmodifiable fields
    const { id: _id, clinic_id: _cid, created_at: _cat, ...cleanUpdates } = updates;

    if (supabase) {
      const { data, error } = await supabase
        .from('doctors')
        .update(cleanUpdates)
        .eq('clinic_id', clinicId)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) {
        console.error('[DoctorService.update] Supabase update error:', error);
        return {
          success: false,
          error_code: 'DATABASE_ERROR',
          error: `Failed to update doctor record: ${error.message}`,
        };
      }

      if (!data) {
        return { success: false, error_code: 'DOCTOR_NOT_FOUND', error: 'Doctor not found.' };
      }

      // If status changed, update corresponding user account if present
      if (cleanUpdates.status) {
        try {
          await supabase
            .from('users')
            .update({ status: cleanUpdates.status })
            .eq('clinic_id', clinicId)
            .eq('doctor_id', id);
        } catch (uErr) {
          console.warn('[DoctorService.update] Failed to sync user status:', uErr);
        }
      }

      db.updateDoctorInMemory(clinicId, id, data as Doctor);
      return { success: true, doctor: data as Doctor };
    }

    // Offline / dev fallback
    const updated = db.updateDoctor(clinicId, id, cleanUpdates);
    if (!updated) {
      return { success: false, error_code: 'DOCTOR_NOT_FOUND', error: 'Doctor not found.' };
    }
    return { success: true, doctor: updated };
  }
}
