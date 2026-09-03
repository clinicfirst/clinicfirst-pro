const fs = require('fs');
let code = fs.readFileSync('server/services/knowledge.service.ts', 'utf8');

code = code.replace(
  /static async listClinicKnowledge\(clinicId: string, status\?: string\): Promise<ClinicKnowledgeItem\[\]> \{[\s\S]*?return data as ClinicKnowledgeItem\[\];\n  \}/m,
`static async listClinicKnowledge(clinicId: string, filters?: { status?: string, category?: string, search?: string } | string): Promise<ClinicKnowledgeItem[]> {
    if (!clinicId) throw new Error('clinicId is required to list clinic knowledge');
    
    let status = typeof filters === 'string' ? filters : filters?.status;
    let category = typeof filters === 'object' ? filters?.category : undefined;
    let search = typeof filters === 'object' ? filters?.search : undefined;

    if (!supabase) {
      let items = ((db.data as any).clinic_knowledge_base || []).filter((k: ClinicKnowledgeItem) => k.clinic_id === clinicId);
      if (status) items = items.filter((k: ClinicKnowledgeItem) => k.status === status);
      if (category) items = items.filter((k: ClinicKnowledgeItem) => k.category === category);
      if (search) items = items.filter((k: ClinicKnowledgeItem) => k.title.toLowerCase().includes(search.toLowerCase()) || k.content.toLowerCase().includes(search.toLowerCase()));
      return items;
    }

    let query = supabase.from('clinic_knowledge_base').select('*').eq('clinic_id', clinicId).order('created_at', { ascending: false });
    if (status) {
      query = query.eq('status', status);
    }
    if (category) {
      query = query.eq('category', category);
    }
    const { data, error } = await query;
    if (error) {
      console.error('[KnowledgeService.listClinicKnowledge] Supabase error:', error);
      throw new Error('Failed to retrieve clinic knowledge from database.');
    }
    
    let result = data as ClinicKnowledgeItem[];
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(k => k.title.toLowerCase().includes(s) || k.content.toLowerCase().includes(s));
    }
    return result;
  }`
);

fs.writeFileSync('server/services/knowledge.service.ts', code);
