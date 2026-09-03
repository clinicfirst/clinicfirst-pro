import { supabase } from '../supabaseDiff';
import { db } from '../db';
import { Service } from '../../src/types';

export interface CreateServiceInput {
  id?: string;
  name: string;
  duration_minutes?: number;
  fee?: number;
  status?: 'ACTIVE' | 'INACTIVE';
  assigned_doctor_ids?: string[];
}

export class ServiceService {
  /**
   * Retrieves all services for a clinic, with optional status or doctorId filter.
   * Direct PostgreSQL query when configured; offline fallback otherwise.
   */
  static async list(
    clinicId: string,
    filter?: { status?: 'ACTIVE' | 'INACTIVE'; doctorId?: string }
  ): Promise<Service[]> {
    if (!clinicId) return [];

    if (supabase) {
      let query = supabase
        .from('services')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('name', { ascending: true });

      if (filter?.status) {
        query = query.eq('status', filter.status);
      }

      const { data, error } = await query;
      if (error) {
        console.error('[ServiceService.list] Supabase query error:', error);
        throw new Error(`Database error fetching services: ${error.message}`);
      }

      let services: Service[] = (data || []).map((s: any) => ({
        ...s,
        duration_minutes: Number(s.duration_minutes) || 30,
        fee: Number(s.fee) || 0,
        assigned_doctor_ids: Array.isArray(s.assigned_doctor_ids) ? s.assigned_doctor_ids : [],
      }));

      if (filter?.doctorId) {
        services = services.filter(
          (s) =>
            !s.assigned_doctor_ids ||
            s.assigned_doctor_ids.length === 0 ||
            s.assigned_doctor_ids.includes(filter.doctorId!)
        );
      }

      return services;
    }

    // Offline / dev fallback
    let services = db.getServices(clinicId);
    if (filter?.status) {
      services = services.filter((s) => s.status === filter.status);
    }
    if (filter?.doctorId) {
      services = services.filter(
        (s) =>
          !s.assigned_doctor_ids ||
          s.assigned_doctor_ids.length === 0 ||
          s.assigned_doctor_ids.includes(filter.doctorId!)
      );
    }
    return services;
  }

  /**
   * Retrieves a single service by ID within the clinic tenant boundary.
   */
  static async getById(clinicId: string, id: string): Promise<Service | null> {
    if (!clinicId || !id) return null;

    if (supabase) {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('[ServiceService.getById] Supabase query error:', error);
        throw new Error(`Database error fetching service by id: ${error.message}`);
      }
      if (!data) return null;

      return {
        ...data,
        duration_minutes: Number(data.duration_minutes) || 30,
        fee: Number(data.fee) || 0,
        assigned_doctor_ids: Array.isArray(data.assigned_doctor_ids) ? data.assigned_doctor_ids : [],
      };
    }

    return db.getServiceById(clinicId, id) || null;
  }

  /**
   * Synchronously creates a new service directly in PostgreSQL.
   */
  static async create(
    clinicId: string,
    input: CreateServiceInput
  ): Promise<{ success: boolean; service?: Service; error?: string; error_code?: string }> {
    if (!clinicId) {
      return { success: false, error_code: 'INVALID_CLINIC', error: 'Clinic ID is required.' };
    }
    if (!input.name || !input.name.trim()) {
      return { success: false, error_code: 'VALIDATION_ERROR', error: 'Service name is required.' };
    }

    const duration_minutes = Number(input.duration_minutes) || 30;
    if (duration_minutes <= 0) {
      return {
        success: false,
        error_code: 'VALIDATION_ERROR',
        error: 'Duration must be greater than 0 minutes.',
      };
    }

    const fee = input.fee !== undefined ? Number(input.fee) : 0;
    if (fee < 0) {
      return {
        success: false,
        error_code: 'VALIDATION_ERROR',
        error: 'Fee cannot be negative.',
      };
    }

    const serviceId = input.id || `srv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newService: Service = {
      id: serviceId,
      clinic_id: clinicId,
      name: input.name.trim(),
      duration_minutes,
      fee,
      status: input.status || 'ACTIVE',
      assigned_doctor_ids: input.assigned_doctor_ids || [],
    };

    if (supabase) {
      const { error } = await supabase.from('services').insert(newService);
      if (error) {
        console.error('[ServiceService.create] Supabase insert error:', error);
        return {
          success: false,
          error_code: 'DATABASE_ERROR',
          error: `Failed to create service record: ${error.message}`,
        };
      }

      // Sync doctor_services mapping table if assigned_doctor_ids provided
      if (newService.assigned_doctor_ids && newService.assigned_doctor_ids.length > 0) {
        const dsRows = newService.assigned_doctor_ids.map((docId) => ({
          id: `ds_${newService.id}_${docId}`,
          clinic_id: clinicId,
          doctor_id: docId,
          service_id: newService.id,
        }));
        try {
          await supabase.from('doctor_services').insert(dsRows);
        } catch (dsErr) {
          console.warn('[ServiceService.create] Could not insert doctor_services mapping rows:', dsErr);
        }
      }

      // Update in-memory copy for offline mode
      db.createServiceInMemory(newService);
      return { success: true, service: newService };
    }

    // Offline / dev fallback
    const saved = db.createService(newService);
    return { success: true, service: saved };
  }

  /**
   * Synchronously updates an existing service in PostgreSQL.
   */
  static async update(
    clinicId: string,
    id: string,
    updates: Partial<Service>
  ): Promise<{ success: boolean; service?: Service; error?: string; error_code?: string }> {
    if (!clinicId || !id) {
      return {
        success: false,
        error_code: 'VALIDATION_ERROR',
        error: 'Clinic ID and Service ID are required.',
      };
    }

    // Strip unmodifiable fields
    const { id: _id, clinic_id: _cid, ...cleanUpdates } = updates;

    if (cleanUpdates.name !== undefined && !cleanUpdates.name.trim()) {
      return {
        success: false,
        error_code: 'VALIDATION_ERROR',
        error: 'Service name cannot be empty.',
      };
    }

    if (cleanUpdates.duration_minutes !== undefined && Number(cleanUpdates.duration_minutes) <= 0) {
      return {
        success: false,
        error_code: 'VALIDATION_ERROR',
        error: 'Duration must be greater than 0 minutes.',
      };
    }

    if (cleanUpdates.fee !== undefined && Number(cleanUpdates.fee) < 0) {
      return {
        success: false,
        error_code: 'VALIDATION_ERROR',
        error: 'Fee cannot be negative.',
      };
    }

    if (supabase) {
      const { data, error } = await supabase
        .from('services')
        .update(cleanUpdates)
        .eq('clinic_id', clinicId)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) {
        console.error('[ServiceService.update] Supabase update error:', error);
        return {
          success: false,
          error_code: 'DATABASE_ERROR',
          error: `Failed to update service record: ${error.message}`,
        };
      }

      if (!data) {
        return { success: false, error_code: 'SERVICE_NOT_FOUND', error: 'Service not found.' };
      }

      // Sync doctor_services mapping table if assigned_doctor_ids is updated
      if (cleanUpdates.assigned_doctor_ids !== undefined) {
        try {
          await supabase
            .from('doctor_services')
            .delete()
            .eq('clinic_id', clinicId)
            .eq('service_id', id);

          if (cleanUpdates.assigned_doctor_ids.length > 0) {
            const dsRows = cleanUpdates.assigned_doctor_ids.map((docId) => ({
              id: `ds_${id}_${docId}`,
              clinic_id: clinicId,
              doctor_id: docId,
              service_id: id,
            }));
            await supabase.from('doctor_services').insert(dsRows);
          }
        } catch (dsErr) {
          console.warn('[ServiceService.update] Could not sync doctor_services rows:', dsErr);
        }
      }

      const formattedService: Service = {
        ...data,
        duration_minutes: Number(data.duration_minutes) || 30,
        fee: Number(data.fee) || 0,
        assigned_doctor_ids: Array.isArray(data.assigned_doctor_ids) ? data.assigned_doctor_ids : [],
      };

      db.updateServiceInMemory(clinicId, id, formattedService);
      return { success: true, service: formattedService };
    }

    // Offline / dev fallback
    const updated = db.updateService(clinicId, id, cleanUpdates);
    if (!updated) {
      return { success: false, error_code: 'SERVICE_NOT_FOUND', error: 'Service not found.' };
    }
    return { success: true, service: updated };
  }

  /**
   * Deactivates a service (soft-delete / status=INACTIVE).
   */
  static async deactivate(
    clinicId: string,
    id: string
  ): Promise<{ success: boolean; service?: Service; error?: string; error_code?: string }> {
    return this.update(clinicId, id, { status: 'INACTIVE' });
  }

  /**
   * Activates a service (status=ACTIVE).
   */
  static async activate(
    clinicId: string,
    id: string
  ): Promise<{ success: boolean; service?: Service; error?: string; error_code?: string }> {
    return this.update(clinicId, id, { status: 'ACTIVE' });
  }
}
