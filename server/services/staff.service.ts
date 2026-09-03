import { supabase } from '../supabaseDiff';
import { db } from '../db';
import { User, UserRole } from '../../src/types';

export interface CreateUserInput {
  id?: string;
  clinic_id?: string | null;
  role: UserRole;
  name: string;
  email: string;
  phone?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  must_change_password?: boolean;
  password_hash: string;
  doctor_id?: string;
}

export class StaffService {
  /**
   * Retrieves all staff members (CLINIC_STAFF and CLINIC_ADMIN) for a clinic.
   * Strips sensitive password hashes.
   */
  static async listStaff(clinicId: string): Promise<Omit<User, 'password_hash'>[]> {
    if (!clinicId) return [];

    if (supabase) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('clinic_id', clinicId)
        .in('role', ['CLINIC_STAFF', 'CLINIC_ADMIN'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[StaffService.listStaff] Supabase query error:', error);
        throw new Error(`Database error fetching staff: ${error.message}`);
      }

      return (data || []).map(({ password_hash, ...rest }) => rest as User);
    }

    // Offline / dev fallback
    return db
      .getUsers(clinicId)
      .filter((u) => u.role === 'CLINIC_STAFF' || u.role === 'CLINIC_ADMIN');
  }

  /**
   * Retrieves all users (with optional clinic filtering for Platform Admin views).
   */
  static async listAll(clinicId?: string | null): Promise<Omit<User, 'password_hash'>[]> {
    if (supabase) {
      let query = supabase.from('users').select('*').order('created_at', { ascending: false });

      if (clinicId !== undefined) {
        if (clinicId === null) {
          query = query.is('clinic_id', null);
        } else {
          query = query.eq('clinic_id', clinicId);
        }
      }

      const { data, error } = await query;
      if (error) {
        console.error('[StaffService.listAll] Supabase query error:', error);
        throw new Error(`Database error fetching users: ${error.message}`);
      }

      return (data || []).map(({ password_hash, ...rest }) => rest as User);
    }

    return db.getUsers(clinicId);
  }

  /**
   * Retrieves a single user by ID. If clinicId is provided, strictly enforces tenant isolation.
   */
  static async getById(
    id: string,
    clinicId?: string
  ): Promise<(User & { password_hash: string }) | null> {
    if (!id) return null;

    if (supabase) {
      let query = supabase.from('users').select('*').eq('id', id);
      if (clinicId) {
        query = query.eq('clinic_id', clinicId);
      }

      const { data, error } = await query.maybeSingle();
      if (error) {
        console.error('[StaffService.getById] Supabase query error:', error);
        throw new Error(`Database error fetching user by id: ${error.message}`);
      }

      return (data as (User & { password_hash: string })) || null;
    }

    const u = db.getUserById(id);
    if (!u) return null;
    if (clinicId && u.clinic_id !== clinicId) return null;
    return u as (User & { password_hash: string });
  }

  /**
   * Retrieves a user by email address (case-insensitive) for authentication.
   */
  static async getByEmail(
    email: string
  ): Promise<(User & { password_hash: string }) | null> {
    if (!email) return null;
    const cleanEmail = email.trim().toLowerCase();

    if (supabase) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (error) {
        console.error('[StaffService.getByEmail] Supabase query error:', error);
        throw new Error(`Database error fetching user by email: ${error.message}`);
      }

      return (data as (User & { password_hash: string })) || null;
    }

    return (db.getUserByEmail(cleanEmail) as (User & { password_hash: string })) || null;
  }

  /**
   * Creates a new user record directly in PostgreSQL.
   */
  static async create(
    clinicId: string | null,
    input: CreateUserInput
  ): Promise<{ success: boolean; user?: Omit<User, 'password_hash'>; error?: string; error_code?: string }> {
    if (!input.name || !input.name.trim()) {
      return { success: false, error_code: 'VALIDATION_ERROR', error: 'User name is required.' };
    }
    if (!input.email || !input.email.trim()) {
      return { success: false, error_code: 'VALIDATION_ERROR', error: 'User email is required.' };
    }
    if (!input.password_hash) {
      return { success: false, error_code: 'VALIDATION_ERROR', error: 'Password is required.' };
    }

    const cleanEmail = input.email.trim().toLowerCase();

    // Check if email already exists
    const existing = await StaffService.getByEmail(cleanEmail);
    if (existing) {
      return {
        success: false,
        error_code: 'EMAIL_ALREADY_EXISTS',
        error: `A user with email ${cleanEmail} already exists.`,
      };
    }

    const userId = input.id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullUser: User & { password_hash: string } = {
      id: userId,
      clinic_id: clinicId,
      role: input.role,
      name: input.name.trim(),
      email: cleanEmail,
      phone: input.phone?.trim() || undefined,
      status: input.status || 'ACTIVE',
      must_change_password: input.must_change_password ?? true,
      created_at: new Date().toISOString(),
      password_hash: input.password_hash,
      doctor_id: input.doctor_id || undefined,
    };

    if (supabase) {
      const { error } = await supabase.from('users').insert(fullUser);
      if (error) {
        console.error('[StaffService.create] Supabase insert error:', error);
        return {
          success: false,
          error_code: 'DATABASE_ERROR',
          error: `Failed to create user record: ${error.message}`,
        };
      }

      db.createUserInMemory(fullUser);
      const { password_hash, ...clean } = fullUser;
      return { success: true, user: clean };
    }

    const created = db.createUser(fullUser);
    return { success: true, user: created };
  }

  /**
   * Updates a user record in PostgreSQL.
   */
  static async update(
    id: string,
    updates: Partial<User & { password_hash?: string }>,
    clinicId?: string
  ): Promise<{ success: boolean; user?: Omit<User, 'password_hash'>; error?: string; error_code?: string }> {
    if (!id) {
      return { success: false, error_code: 'VALIDATION_ERROR', error: 'User ID is required.' };
    }

    // Verify existing user exists and matches clinic boundary if specified
    const existing = await StaffService.getById(id, clinicId);
    if (!existing) {
      return { success: false, error_code: 'USER_NOT_FOUND', error: 'User not found.' };
    }

    const { id: _id, created_at: _cat, ...cleanUpdates } = updates;
    if (cleanUpdates.email) {
      cleanUpdates.email = cleanUpdates.email.trim().toLowerCase();
    }

    if (supabase) {
      let query = supabase
        .from('users')
        .update(cleanUpdates)
        .eq('id', id);

      if (clinicId) {
        query = query.eq('clinic_id', clinicId);
      }

      const { data, error } = await query.select().maybeSingle();
      if (error) {
        console.error('[StaffService.update] Supabase update error:', error);
        return {
          success: false,
          error_code: 'DATABASE_ERROR',
          error: `Failed to update user record: ${error.message}`,
        };
      }

      if (!data) {
        return { success: false, error_code: 'USER_NOT_FOUND', error: 'User not found.' };
      }

      db.updateUserInMemory(id, data);
      const { password_hash, ...clean } = data;
      return { success: true, user: clean as User };
    }

    const updated = db.updateUser(id, cleanUpdates);
    if (!updated) {
      return { success: false, error_code: 'USER_NOT_FOUND', error: 'User not found.' };
    }
    return { success: true, user: updated };
  }

  /**
   * Resets temporary password for a staff member.
   */
  static async resetPassword(
    id: string,
    newPasswordHash: string,
    clinicId?: string
  ): Promise<{ success: boolean; error?: string; error_code?: string }> {
    return await StaffService.update(
      id,
      {
        password_hash: newPasswordHash,
        must_change_password: true,
      },
      clinicId
    );
  }
}
