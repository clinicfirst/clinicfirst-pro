
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

  static async create(clinic: Clinic): Promise<Clinic> {
    if (!supabase) {
      if (!db.data.clinics) db.data.clinics = [];
      db.data.clinics.push(clinic);
      db.flush();
      return clinic;
    }
    const { data, error } = await supabase.from('clinics').insert(clinic).select().single();
    if (error) throw new Error(error.message);
    return data;
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
