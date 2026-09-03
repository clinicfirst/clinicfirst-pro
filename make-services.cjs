const fs = require('fs');

const clinicServiceCode = `
import { supabase } from '../supabaseDiff';
import { db } from '../db';
import { Clinic } from '../../src/types';

export class ClinicService {
  static async list(): Promise<Clinic[]> {
    if (!supabase) return (db.data as any).clinics || [];
    const { data, error } = await supabase.from('clinics').select('*');
    if (error) throw new Error(error.message);
    return data || [];
  }

  static async getById(id: string): Promise<Clinic | null> {
    if (!supabase) return ((db.data as any).clinics || []).find((c: any) => c.id === id) || null;
    const { data, error } = await supabase.from('clinics').select('*').eq('id', id).single();
    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data || null;
  }

  static async update(id: string, updates: Partial<Clinic>): Promise<Clinic> {
    if (!supabase) {
      const idx = ((db.data as any).clinics || []).findIndex((c: any) => c.id === id);
      if (idx === -1) throw new Error('Not found');
      (db.data as any).clinics[idx] = { ...(db.data as any).clinics[idx], ...updates };
      db.flush();
      return (db.data as any).clinics[idx];
    }
    const { data, error } = await supabase.from('clinics').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
}
`;

const userServiceCode = `
import { supabase } from '../supabaseDiff';
import { db } from '../db';
import { User } from '../../src/types';

export class UserService {
  static async list(clinicId?: string | null): Promise<User[]> {
    if (!supabase) {
      return clinicId === undefined
        ? (db.data as any).users
        : ((db.data as any).users || []).filter((u: any) => u.clinic_id === clinicId);
    }
    let query = supabase.from('users').select('*');
    if (clinicId !== undefined) {
      if (clinicId === null) query = query.is('clinic_id', null);
      else query = query.eq('clinic_id', clinicId);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  }

  static async getById(id: string): Promise<User | null> {
    if (!supabase) return ((db.data as any).users || []).find((u: any) => u.id === id) || null;
    const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data || null;
  }

  static async getByEmail(email: string): Promise<User | null> {
    if (!supabase) return ((db.data as any).users || []).find((u: any) => u.email.toLowerCase() === email.toLowerCase()) || null;
    const { data, error } = await supabase.from('users').select('*').ilike('email', email).single();
    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data || null;
  }

  static async update(id: string, updates: Partial<User>): Promise<User> {
    if (!supabase) {
      const idx = ((db.data as any).users || []).findIndex((u: any) => u.id === id);
      if (idx === -1) throw new Error('Not found');
      (db.data as any).users[idx] = { ...(db.data as any).users[idx], ...updates };
      db.flush();
      return (db.data as any).users[idx];
    }
    const { data, error } = await supabase.from('users').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
}
`;

fs.writeFileSync('server/services/clinic.service.ts', clinicServiceCode);
fs.writeFileSync('server/services/user.service.ts', userServiceCode);
