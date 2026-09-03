import { supabase } from '../supabaseDiff';
import { db } from '../db';
import { AuditLog } from '../../src/types';

export class AuditService {
  static async logAudit(entry: Omit<AuditLog, 'id' | 'created_at'>): Promise<AuditLog> {
    const newEntry = {
      ...entry,
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      created_at: new Date().toISOString(),
    };

    if (!supabase) {
      if (!(db.data as any).audit_logs) (db.data as any).audit_logs = [];
      (db.data as any).audit_logs.push(newEntry);
      db.flush();
      return newEntry as AuditLog;
    }

    const { data, error } = await supabase
      .from('audit_logs')
      .insert(newEntry)
      .select()
      .single();

    if (error) {
      console.error('[AuditService.logAudit] Supabase error:', error);
      throw new Error('Failed to create audit log in database.');
    }

    return data as AuditLog;
  }

  static async listAuditLogs(clinicId?: string): Promise<AuditLog[]> {
    if (!supabase) {
      const logs = (db.data as any).audit_logs || [];
      return clinicId ? logs.filter((l: AuditLog) => l.clinic_id === clinicId) : logs;
    }

    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (clinicId) {
      query = query.eq('clinic_id', clinicId);
    } else {
      // Platform admin can see platform level logs or all logs (based on UI logic).
      // The old db.ts allowed fetching all if clinicId is undefined.
    }

    const { data, error } = await query;

    if (error) {
      console.error('[AuditService.listAuditLogs] Supabase error:', error);
      throw new Error('Failed to retrieve audit logs from database.');
    }

    return data as AuditLog[];
  }
}
