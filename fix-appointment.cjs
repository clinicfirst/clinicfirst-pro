const fs = require('fs');
let code = fs.readFileSync('server/services/appointment.service.ts', 'utf8');

if (!code.includes('static async list')) {
  code = code.replace(
    /class AppointmentService \{/,
    `class AppointmentService {
  static async list(clinicId: string, filters?: { date?: string; doctor_id?: string; status?: string }): Promise<Appointment[]> {
    if (!supabase) {
      let items = ((db.data as any).appointments || []).filter((a: any) => a.clinic_id === clinicId);
      if (filters?.date) items = items.filter((a: any) => a.date === filters.date);
      if (filters?.doctor_id) items = items.filter((a: any) => a.doctor_id === filters.doctor_id);
      if (filters?.status) items = items.filter((a: any) => a.status === filters.status);
      return items;
    }
    let query = supabase.from('appointments').select('*').eq('clinic_id', clinicId);
    if (filters?.date) query = query.eq('date', filters.date);
    if (filters?.doctor_id) query = query.eq('doctor_id', filters.doctor_id);
    if (filters?.status) query = query.eq('status', filters.status);
    const { data, error } = await query;
    if (error) throw new Error('Failed to list appointments: ' + error.message);
    return data || [];
  }

  static async getById(clinicId: string, id: string): Promise<Appointment | null> {
    if (!supabase) {
      return ((db.data as any).appointments || []).find((a: any) => a.id === id && a.clinic_id === clinicId) || null;
    }
    const { data, error } = await supabase.from('appointments').select('*').eq('clinic_id', clinicId).eq('id', id).single();
    if (error && error.code !== 'PGRST116') throw new Error('Failed to get appointment: ' + error.message);
    return data || null;
  }
`
  );
  fs.writeFileSync('server/services/appointment.service.ts', code);
}
