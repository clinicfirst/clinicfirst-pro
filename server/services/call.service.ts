import { supabase } from '../supabaseDiff';
import { db } from '../db';
import { Call } from '../../src/types';

export class CallService {
  static async listCalls(clinicId: string): Promise<Call[]> {
    if (!clinicId) throw new Error('clinicId is required to list calls');

    if (!supabase) {
      return (db.data as any).calls?.filter((c: Call) => c.clinic_id === clinicId) || [];
    }

    const { data, error } = await supabase
      .from('calls')
      .select(`
        *,
        patient:patients(*),
        doctor:doctors(*),
        service:services(*)
      `)
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[CallService.listCalls] Supabase error:', error);
      throw new Error('Failed to retrieve calls from database.');
    }

    return (data || []).map((row: any) => ({
      ...row,
      duration_seconds: row.duration_seconds || 0,
      transcript: row.transcript || [],
    })) as Call[];
  }

  static async getCallById(clinicId: string, callId: string): Promise<Call | null> {
    if (!clinicId) throw new Error('clinicId is required to get a call');

    if (!supabase) {
      return (db.data as any).calls?.find((c: Call) => c.clinic_id === clinicId && c.id === callId) || null;
    }

    const { data, error } = await supabase
      .from('calls')
      .select(`
        *,
        patient:patients(*),
        doctor:doctors(*),
        service:services(*)
      `)
      .eq('clinic_id', clinicId)
      .eq('id', callId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[CallService.getCallById] Supabase error:', error);
      throw new Error('Failed to retrieve call from database.');
    }

    if (!data) return null;

    return {
      ...data,
      duration_seconds: data.duration_seconds || 0,
      transcript: data.transcript || [],
    } as Call;
  }

  static async createCall(clinicId: string, call: Partial<Call>): Promise<Call> {
    if (!clinicId) throw new Error('clinicId is required to create a call');

    if (!supabase) {
      const newCall = {
        ...call,
        clinic_id: clinicId,
        id: call.id || `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        created_at: call.created_at || new Date().toISOString(),
      } as Call;
      if (!(db.data as any).calls) (db.data as any).calls = [];
      (db.data as any).calls.push(newCall);
      db.flush();
      return newCall;
    }

    // Ensure we don't pass unknown properties or relations to upsert
    const { patient, doctor, service, ...rest } = call;

    const insertData = {
      ...rest,
      clinic_id: clinicId,
      id: call.id || `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      created_at: call.created_at || new Date().toISOString(),
    };

    delete (insertData as any).active_ai_config_version;
    delete (insertData as any).end_time;
    delete (insertData as any).caller_phone;
    delete (insertData as any).patient_phone;
    delete (insertData as any).escalation_id;

    const { data, error } = await supabase
      .from('calls')
      .insert(insertData)
      .select(`
        *,
        patient:patients(*),
        doctor:doctors(*),
        service:services(*)
      `)
      .single();

    if (error) {
      console.error('[CallService.createCall] Supabase error:', error);
      throw new Error('Failed to create call in database.');
    }

    return {
      ...data,
      duration_seconds: data.duration_seconds || 0,
      transcript: data.transcript || [],
    } as Call;
  }

  static async updateCall(clinicId: string, callId: string, updates: Partial<Call>): Promise<Call> {
    if (!clinicId) throw new Error('clinicId is required to update a call');

    if (!supabase) {
      if (!(db.data as any).calls) (db.data as any).calls = [];
      const idx = (db.data as any).calls.findIndex((c: Call) => c.clinic_id === clinicId && c.id === callId);
      if (idx !== -1) {
        (db.data as any).calls[idx] = { ...(db.data as any).calls[idx], ...updates };
        db.flush();
        return (db.data as any).calls[idx];
      }
      throw new Error('Call not found in local DB');
    }

    const { patient, doctor, service, id, clinic_id, ...rest } = updates;

    delete (rest as any).active_ai_config_version;
    delete (rest as any).end_time;
    delete (rest as any).caller_phone;
    delete (rest as any).patient_phone;
    delete (rest as any).escalation_id;

    const { data, error } = await supabase
      .from('calls')
      .update(rest)
      .eq('clinic_id', clinicId)
      .eq('id', callId)
      .select(`
        *,
        patient:patients(*),
        doctor:doctors(*),
        service:services(*)
      `)
      .single();

    if (error) {
      console.error('[CallService.updateCall] Supabase error:', error);
      throw new Error('Failed to update call in database.');
    }

    return {
      ...data,
      duration_seconds: data.duration_seconds || 0,
      transcript: data.transcript || [],
    } as Call;
  }
}
