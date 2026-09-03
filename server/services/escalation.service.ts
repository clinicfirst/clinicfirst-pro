import { supabase } from '../supabaseDiff';
import { db } from '../db';
import { Escalation } from '../../src/types';

export class EscalationService {
  static async listEscalations(clinicId: string): Promise<Escalation[]> {
    if (!clinicId) throw new Error('clinicId is required to list escalations');

    if (!supabase) {
      return ((db.data as any).escalations || []).filter((e: Escalation) => e.clinic_id === clinicId);
    }

    const { data, error } = await supabase
      .from('escalations')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[EscalationService.listEscalations] Supabase error:', error);
      throw new Error('Failed to retrieve escalations from database.');
    }

    return data as Escalation[];
  }

  static async getEscalationById(clinicId: string, id: string): Promise<Escalation | null> {
    if (!clinicId) throw new Error('clinicId is required to get escalation');

    if (!supabase) {
      return ((db.data as any).escalations || []).find((e: Escalation) => e.clinic_id === clinicId && e.id === id) || null;
    }

    const { data, error } = await supabase
      .from('escalations')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[EscalationService.getEscalationById] Supabase error:', error);
      throw new Error('Failed to retrieve escalation from database.');
    }

    return data as Escalation | null;
  }

  static async createEscalation(clinicId: string, escalation: Partial<Escalation>): Promise<Escalation> {
    if (!clinicId) throw new Error('clinicId is required to create an escalation');

    const insertData = {
      ...escalation,
      clinic_id: clinicId,
      id: escalation.id || `esc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      created_at: escalation.created_at || new Date().toISOString(),
      status: escalation.status || 'pending',
    };

    if (!supabase) {
      if (!(db.data as any).escalations) (db.data as any).escalations = [];
      (db.data as any).escalations.push(insertData);
      db.flush();
      return insertData as Escalation;
    }

    const { data, error } = await supabase
      .from('escalations')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('[EscalationService.createEscalation] Supabase error:', error);
      throw new Error('Failed to create escalation in database.');
    }

    return data as Escalation;
  }

  static async resolveEscalation(clinicId: string, id: string, resolvedBy: string): Promise<Escalation> {
    if (!clinicId) throw new Error('clinicId is required to resolve escalation');

    if (!supabase) {
      const idx = ((db.data as any).escalations || []).findIndex((e: Escalation) => e.clinic_id === clinicId && e.id === id);
      if (idx === -1) throw new Error('Escalation not found');
      (db.data as any).escalations[idx].status = 'resolved';
      (db.data as any).escalations[idx].resolved_by = resolvedBy;
      (db.data as any).escalations[idx].resolved_at = new Date().toISOString();
      db.flush();
      return (db.data as any).escalations[idx];
    }

    const updates = {
      status: 'resolved',
      resolved_by: resolvedBy,
      resolved_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('escalations')
      .update(updates)
      .eq('clinic_id', clinicId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[EscalationService.resolveEscalation] Supabase error:', error);
      throw new Error('Failed to resolve escalation in database.');
    }

    return data as Escalation;
  }
}
