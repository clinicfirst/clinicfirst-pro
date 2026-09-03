import { supabase } from '../supabaseDiff';
import { db } from '../db';
import { Patient } from '../../src/types';

export interface CreatePatientInput {
  id?: string;
  name: string;
  phone: string;
  email?: string;
  dob?: string;
  gender?: 'Male' | 'Female' | 'Other' | 'Prefer not to say';
  preferred_language?: string;
  notes?: string;
}

export class PatientService {
  /**
   * Retrieves all patients for a clinic, with optional search filter.
   * Direct PostgreSQL query when configured; offline fallback otherwise.
   */
  static async list(clinicId: string, search?: string): Promise<Patient[]> {
    if (!clinicId) return [];

    if (supabase) {
      let query = supabase
        .from('patients')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false });

      if (search && search.trim()) {
        const q = search.trim();
        const cleanDigits = q.replace(/\D/g, '');
        if (cleanDigits.length >= 4) {
          query = query.or(`name.ilike.%${q}%,phone.ilike.%${cleanDigits}%,email.ilike.%${q}%`);
        } else {
          query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
        }
      }

      const { data, error } = await query;
      if (error) {
        console.error('[PatientService.list] Supabase query error:', error);
        throw new Error(`Database error fetching patients: ${error.message}`);
      }
      return (data as Patient[]) || [];
    }

    // Offline / dev fallback
    return db.getPatients(clinicId, search);
  }

  /**
   * Retrieves a single patient by ID within the clinic tenant boundary.
   */
  static async getById(clinicId: string, id: string): Promise<Patient | null> {
    if (!clinicId || !id) return null;

    if (supabase) {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('[PatientService.getById] Supabase query error:', error);
        throw new Error(`Database error fetching patient by id: ${error.message}`);
      }
      return (data as Patient) || null;
    }

    return db.getPatientById(clinicId, id) || null;
  }

  /**
   * Retrieves a patient by phone number with multi-format normalization.
   */
  static async getByPhone(clinicId: string, phone: string): Promise<Patient | null> {
    if (!clinicId || !phone) return null;

    const rawPhone = phone.trim();
    const digits = rawPhone.replace(/\D/g, '');
    const last10 = digits.length >= 10 ? digits.slice(-10) : digits;

    if (supabase) {
      let query = supabase.from('patients').select('*').eq('clinic_id', clinicId);

      if (last10.length >= 7) {
        query = query.or(`phone.eq.${rawPhone},phone.ilike.%${last10}%`);
      } else {
        query = query.eq('phone', rawPhone);
      }

      const { data, error } = await query;
      if (error) {
        console.error('[PatientService.getByPhone] Supabase query error:', error);
        throw new Error(`Database error fetching patient by phone: ${error.message}`);
      }

      if (!data || data.length === 0) return null;

      // Match closest normalized phone
      const exact = (data as Patient[]).find(
        (p) => p.phone.replace(/\D/g, '') === digits || p.phone.replace(/\D/g, '').endsWith(last10)
      );
      return exact || (data[0] as Patient) || null;
    }

    return db.getPatientByPhone(clinicId, phone) || null;
  }

  /**
   * Synchronously creates a new patient directly in PostgreSQL.
   * Ensures patient is committed before returning to prevent FK race conditions with appointments.
   */
  static async create(
    clinicId: string,
    input: CreatePatientInput
  ): Promise<{ success: boolean; patient?: Patient; error?: string; error_code?: string }> {
    if (!clinicId) {
      return { success: false, error_code: 'INVALID_CLINIC', error: 'Clinic ID is required.' };
    }
    if (!input.name || !input.name.trim()) {
      return { success: false, error_code: 'VALIDATION_ERROR', error: 'Patient name is required.' };
    }
    if (!input.phone || !input.phone.trim()) {
      return { success: false, error_code: 'VALIDATION_ERROR', error: 'Patient phone number is required.' };
    }

    const patientId = input.id || `pat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newPatient: Patient = {
      id: patientId,
      clinic_id: clinicId,
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: input.email?.trim() || undefined,
      dob: input.dob || undefined,
      gender: input.gender || 'Prefer not to say',
      preferred_language: input.preferred_language || 'English',
      notes: input.notes?.trim() || undefined,
      created_at: new Date().toISOString(),
    };

    if (supabase) {
      const { error } = await supabase.from('patients').insert(newPatient);
      if (error) {
        console.error('[PatientService.create] Supabase insert error:', error);
        return {
          success: false,
          error_code: 'DATABASE_ERROR',
          error: `Failed to create patient record: ${error.message}`,
        };
      }

      // Update in-memory copy for fast read caches
      db.createPatientInMemory(newPatient);
      return { success: true, patient: newPatient };
    }

    // Offline / dev fallback
    const saved = db.createPatient(newPatient);
    return { success: true, patient: saved };
  }

  /**
   * Synchronously updates an existing patient in PostgreSQL.
   */
  static async update(
    clinicId: string,
    id: string,
    updates: Partial<Patient>
  ): Promise<{ success: boolean; patient?: Patient; error?: string; error_code?: string }> {
    if (!clinicId || !id) {
      return { success: false, error_code: 'VALIDATION_ERROR', error: 'Clinic ID and Patient ID are required.' };
    }

    // Strip unmodifiable or security-sensitive fields
    const { id: _id, clinic_id: _cid, created_at: _cat, ...cleanUpdates } = updates;

    if (supabase) {
      const { data, error } = await supabase
        .from('patients')
        .update(cleanUpdates)
        .eq('clinic_id', clinicId)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) {
        console.error('[PatientService.update] Supabase update error:', error);
        return {
          success: false,
          error_code: 'DATABASE_ERROR',
          error: `Failed to update patient record: ${error.message}`,
        };
      }

      if (!data) {
        return { success: false, error_code: 'PATIENT_NOT_FOUND', error: 'Patient not found.' };
      }

      db.updatePatientInMemory(clinicId, id, data as Patient);
      return { success: true, patient: data as Patient };
    }

    // Offline / dev fallback
    const updated = db.updatePatient(clinicId, id, cleanUpdates);
    if (!updated) {
      return { success: false, error_code: 'PATIENT_NOT_FOUND', error: 'Patient not found.' };
    }
    return { success: true, patient: updated };
  }
}
