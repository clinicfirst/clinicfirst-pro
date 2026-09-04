import crypto from 'crypto';
import { supabase } from '../supabaseDiff';
import { db } from '../db';
import { PlatformKnowledgeItem, ClinicKnowledgeItem, ClinicKnowledgeRelease } from '../../src/types';

export class KnowledgeService {
  // --- Platform Knowledge Base ---

  static async listPlatformKnowledge(activeOnly: boolean = false): Promise<PlatformKnowledgeItem[]> {
    if (!supabase) {
      let items = (db.data as any).platform_knowledge_base || [];
      if (activeOnly) {
        items = items.filter((k: PlatformKnowledgeItem) => k.is_active);
      }
      return items;
    }

    let query = supabase.from('platform_knowledge_base').select('*').order('created_at', { ascending: false });
    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    const { data, error } = await query;
    if (error) {
      console.error('[KnowledgeService.listPlatformKnowledge] Supabase error:', error);
      throw new Error('Failed to retrieve platform knowledge from database.');
    }
    return data as PlatformKnowledgeItem[];
  }

  static async getPlatformKnowledgeById(id: string): Promise<PlatformKnowledgeItem | null> {
    if (!supabase) {
      return ((db.data as any).platform_knowledge_base || []).find((k: PlatformKnowledgeItem) => k.id === id) || null;
    }

    const { data, error } = await supabase.from('platform_knowledge_base').select('*').eq('id', id).single();
    if (error && error.code !== 'PGRST116') {
      console.error('[KnowledgeService.getPlatformKnowledgeById] Supabase error:', error);
      throw new Error('Failed to retrieve platform knowledge by ID.');
    }
    return data as PlatformKnowledgeItem | null;
  }

  static async createPlatformKnowledge(item: Omit<PlatformKnowledgeItem, 'id' | 'created_at' | 'updated_at'>): Promise<PlatformKnowledgeItem> {
    const newItem: PlatformKnowledgeItem = {
      ...item,
      id: `pk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (!supabase) {
      if (!(db.data as any).platform_knowledge_base) (db.data as any).platform_knowledge_base = [];
      (db.data as any).platform_knowledge_base.unshift(newItem);
      db.flush();
      return newItem as PlatformKnowledgeItem;
    }

    const corePayload: Record<string, any> = {
      id: newItem.id,
      title: newItem.title,
      category: newItem.category,
      content: newItem.content,
      is_active: newItem.is_active ?? true,
      created_at: newItem.created_at,
      updated_at: newItem.updated_at,
    };

    const fullPayload: Record<string, any> = {
      ...corePayload,
      ...(newItem.file_name ? { file_name: newItem.file_name } : {}),
      ...(newItem.file_type ? { file_type: newItem.file_type } : {}),
      ...(newItem.file_data ? { file_data: newItem.file_data } : {}),
      ...(newItem.file_size ? { file_size: newItem.file_size } : {}),
    };

    let resultData: any = null;
    const { data, error } = await supabase.from('platform_knowledge_base').insert(fullPayload).select().single();
    if (error) {
      if (error.code === 'PGRST204' || (error.message && error.message.includes('schema cache'))) {
        console.warn('[KnowledgeService.createPlatformKnowledge] Supabase schema missing optional file columns, retrying with core payload:', error.message);
        const retryResult = await supabase.from('platform_knowledge_base').insert(corePayload).select().single();
        if (retryResult.error) {
          console.error('[KnowledgeService.createPlatformKnowledge] Supabase retry error:', retryResult.error);
          throw new Error(`Failed to create platform knowledge in database: ${retryResult.error.message || retryResult.error.code}`);
        }
        resultData = retryResult.data;
      } else {
        console.error('[KnowledgeService.createPlatformKnowledge] Supabase error:', error);
        throw new Error(`Failed to create platform knowledge in database: ${error.message || error.code}`);
      }
    } else {
      resultData = data;
    }
    return { ...newItem, ...resultData } as PlatformKnowledgeItem;
  }

  static async updatePlatformKnowledge(id: string, updates: Partial<PlatformKnowledgeItem>): Promise<PlatformKnowledgeItem> {
    if (!supabase) {
      const idx = ((db.data as any).platform_knowledge_base || []).findIndex((k: PlatformKnowledgeItem) => k.id === id);
      if (idx === -1) throw new Error('Platform knowledge not found');
      (db.data as any).platform_knowledge_base[idx] = {
        ...(db.data as any).platform_knowledge_base[idx],
        ...updates,
        updated_at: new Date().toISOString()
      };
      db.flush();
      return (db.data as any).platform_knowledge_base[idx];
    }

    const cleanUpdates: Record<string, any> = { ...updates, updated_at: new Date().toISOString() };
    delete cleanUpdates.id;

    let { data, error } = await supabase.from('platform_knowledge_base').update(cleanUpdates).eq('id', id).select().single();
    if (error) {
      if (error.code === 'PGRST204' || (error.message && error.message.includes('schema cache'))) {
        console.warn('[KnowledgeService.updatePlatformKnowledge] Supabase schema missing optional columns, retrying with core fields:', error.message);
        const coreUpdates = { ...cleanUpdates };
        delete coreUpdates.file_name;
        delete coreUpdates.file_type;
        delete coreUpdates.file_data;
        delete coreUpdates.file_size;
        const retryResult = await supabase.from('platform_knowledge_base').update(coreUpdates).eq('id', id).select().single();
        if (retryResult.error) {
          console.error('[KnowledgeService.updatePlatformKnowledge] Supabase retry error:', retryResult.error);
          throw new Error(`Failed to update platform knowledge in database: ${retryResult.error.message || retryResult.error.code}`);
        }
        data = retryResult.data;
      } else {
        console.error('[KnowledgeService.updatePlatformKnowledge] Supabase error:', error);
        throw new Error(`Failed to update platform knowledge in database: ${error.message || error.code}`);
      }
    }
    return data as PlatformKnowledgeItem;
  }

  static async deletePlatformKnowledge(id: string): Promise<boolean> {
    if (!supabase) {
      const initial = ((db.data as any).platform_knowledge_base || []).length;
      (db.data as any).platform_knowledge_base = ((db.data as any).platform_knowledge_base || []).filter((k: PlatformKnowledgeItem) => k.id !== id);
      db.flush();
      return ((db.data as any).platform_knowledge_base || []).length < initial;
    }

    const { error } = await supabase.from('platform_knowledge_base').delete().eq('id', id);
    if (error) {
      console.error('[KnowledgeService.deletePlatformKnowledge] Supabase error:', error);
      throw new Error('Failed to delete platform knowledge from database.');
    }
    return true;
  }


  // --- Clinic Knowledge Base ---

  static async listClinicKnowledge(clinicId: string, filters?: { status?: string, category?: string, search?: string } | string): Promise<ClinicKnowledgeItem[]> {
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
  }

  static async getClinicKnowledgeById(clinicIdOrId: string, idOrClinicId: string): Promise<ClinicKnowledgeItem | null> {
    if (!clinicIdOrId || !idOrClinicId) return null;

    // Detect if arguments were passed as (id, clinicId) vs (clinicId, id)
    let clinicId = clinicIdOrId;
    let id = idOrClinicId;
    if (clinicIdOrId.startsWith('ck_') && !idOrClinicId.startsWith('ck_')) {
      id = clinicIdOrId;
      clinicId = idOrClinicId;
    }

    if (!supabase) {
      return ((db.data as any).clinic_knowledge_base || []).find((k: ClinicKnowledgeItem) => (k.id === id && k.clinic_id === clinicId) || (k.id === clinicId && k.clinic_id === id)) || null;
    }

    const { data, error } = await supabase.from('clinic_knowledge_base').select('*').eq('clinic_id', clinicId).eq('id', id).single();
    if (error && error.code !== 'PGRST116') {
      console.error('[KnowledgeService.getClinicKnowledgeById] Supabase error:', error);
      throw new Error('Failed to retrieve clinic knowledge by ID.');
    }
    return data as ClinicKnowledgeItem | null;
  }

  static async createClinicKnowledge(clinicId: string, item: Omit<ClinicKnowledgeItem, 'id' | 'clinic_id' | 'created_at' | 'updated_at'>): Promise<ClinicKnowledgeItem> {
    if (!clinicId) throw new Error('clinicId is required to create clinic knowledge');

    const newItem: ClinicKnowledgeItem = {
      ...item,
      clinic_id: clinicId,
      id: `ck_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: item.status || 'DRAFT',
      version: item.version ?? 1,
    };

    if (!supabase) {
      if (!(db.data as any).clinic_knowledge_base) (db.data as any).clinic_knowledge_base = [];
      (db.data as any).clinic_knowledge_base.unshift(newItem);
      db.flush();
      return newItem as ClinicKnowledgeItem;
    }

    // Core guaranteed columns in standard schema
    const corePayload: Record<string, any> = {
      id: newItem.id,
      clinic_id: newItem.clinic_id,
      title: newItem.title,
      content: newItem.content,
      category: newItem.category,
      status: newItem.status,
      version: String(newItem.version || '1'),
      created_at: newItem.created_at,
      updated_at: newItem.updated_at,
    };

    // Full payload including optional audit metadata
    const fullPayload: Record<string, any> = {
      ...corePayload,
      ...(newItem.created_by ? { created_by: newItem.created_by } : {}),
      ...(newItem.updated_by ? { updated_by: newItem.updated_by } : {}),
      ...(newItem.published_at ? { published_at: newItem.published_at } : {}),
      ...(newItem.published_by ? { published_by: newItem.published_by } : {}),
    };

    let resultData: any = null;
    const { data, error } = await supabase.from('clinic_knowledge_base').insert(fullPayload).select().single();
    if (error) {
      // PGRST204: "Could not find column ... in the schema cache"
      // If optional audit columns don't exist in Supabase yet, retry with core schema payload
      if (error.code === 'PGRST204' || (error.message && error.message.includes('schema cache'))) {
        console.warn('[KnowledgeService.createClinicKnowledge] Supabase schema missing optional audit column, retrying with core schema payload:', error.message);
        const retryResult = await supabase.from('clinic_knowledge_base').insert(corePayload).select().single();
        if (retryResult.error) {
          console.error('[KnowledgeService.createClinicKnowledge] Supabase retry error:', retryResult.error);
          throw new Error(`Failed to create clinic knowledge in database: ${retryResult.error.message || retryResult.error.code}`);
        }
        resultData = retryResult.data;
      } else {
        console.error('[KnowledgeService.createClinicKnowledge] Supabase error:', error);
        throw new Error(`Failed to create clinic knowledge in database: ${error.message || error.code}`);
      }
    } else {
      resultData = data;
    }

    return { ...newItem, ...resultData } as ClinicKnowledgeItem;
  }

  static async updateClinicKnowledge(clinicId: string, id: string, updates: Partial<ClinicKnowledgeItem>): Promise<ClinicKnowledgeItem> {
    if (!clinicId) throw new Error('clinicId is required to update clinic knowledge');

    if (!supabase) {
      const idx = ((db.data as any).clinic_knowledge_base || []).findIndex((k: ClinicKnowledgeItem) => k.id === id && k.clinic_id === clinicId);
      if (idx === -1) throw new Error('Clinic knowledge not found');
      (db.data as any).clinic_knowledge_base[idx] = {
        ...(db.data as any).clinic_knowledge_base[idx],
        ...updates,
        updated_at: new Date().toISOString()
      };
      db.flush();
      return (db.data as any).clinic_knowledge_base[idx];
    }

    // Ensure clinic_id and id aren't accidentally modified
    const cleanUpdates: Record<string, any> = { ...updates, updated_at: new Date().toISOString() };
    delete cleanUpdates.clinic_id;
    delete cleanUpdates.id;

    let { data, error } = await supabase.from('clinic_knowledge_base').update(cleanUpdates).eq('clinic_id', clinicId).eq('id', id).select().single();
    if (error) {
      if (error.code === 'PGRST204' || (error.message && error.message.includes('schema cache'))) {
        console.warn('[KnowledgeService.updateClinicKnowledge] Supabase schema missing optional audit column, retrying with core fields:', error.message);
        const coreUpdates = { ...cleanUpdates };
        delete coreUpdates.created_by;
        delete coreUpdates.updated_by;
        delete coreUpdates.published_at;
        delete coreUpdates.published_by;
        const retryResult = await supabase.from('clinic_knowledge_base').update(coreUpdates).eq('clinic_id', clinicId).eq('id', id).select().single();
        if (retryResult.error) {
          console.error('[KnowledgeService.updateClinicKnowledge] Supabase retry error:', retryResult.error);
          throw new Error(`Failed to update clinic knowledge in database: ${retryResult.error.message || retryResult.error.code}`);
        }
        data = retryResult.data;
      } else {
        console.error('[KnowledgeService.updateClinicKnowledge] Supabase error:', error);
        throw new Error(`Failed to update clinic knowledge in database: ${error.message || error.code}`);
      }
    }
    return data as ClinicKnowledgeItem;
  }

  static async deleteClinicKnowledge(clinicId: string, id: string): Promise<boolean> {
    if (!clinicId) throw new Error('clinicId is required to delete clinic knowledge');

    if (!supabase) {
      const initial = ((db.data as any).clinic_knowledge_base || []).length;
      (db.data as any).clinic_knowledge_base = ((db.data as any).clinic_knowledge_base || []).filter((k: ClinicKnowledgeItem) => !(k.id === id && k.clinic_id === clinicId));
      db.flush();
      return ((db.data as any).clinic_knowledge_base || []).length < initial;
    }

    const { error } = await supabase.from('clinic_knowledge_base').delete().eq('clinic_id', clinicId).eq('id', id);
    if (error) {
      console.error('[KnowledgeService.deleteClinicKnowledge] Supabase error:', error);
      throw new Error('Failed to delete clinic knowledge from database.');
    }
    return true;
  }

  static async publishClinicKnowledge(clinicId: string, actorUserId: string | undefined): Promise<ClinicKnowledgeItem[]> {
    if (!clinicId) throw new Error('clinicId is required to publish clinic knowledge');

    if (!supabase) {
      let items = ((db.data as any).clinic_knowledge_base || []).filter((k: ClinicKnowledgeItem) => k.clinic_id === clinicId && k.status === 'VALIDATED');
      for (const item of items) {
        item.status = 'PUBLISHED';
        item.published_at = new Date().toISOString();
        if (actorUserId) item.published_by = actorUserId;
      }
      db.flush();
      return items;
    }

    const now = new Date().toISOString();
    const fullPayload: Record<string, any> = {
      status: 'PUBLISHED',
      published_at: now,
      ...(actorUserId ? { published_by: actorUserId } : {})
    };

    let { data, error } = await supabase
      .from('clinic_knowledge_base')
      .update(fullPayload)
      .eq('clinic_id', clinicId)
      .eq('status', 'VALIDATED')
      .select();

    if (error) {
      if (error.code === 'PGRST204' || (error.message && error.message.includes('schema cache'))) {
        console.warn('[KnowledgeService.publishClinicKnowledge] Supabase schema missing optional audit column, retrying with status update only:', error.message);
        const retryResult = await supabase
          .from('clinic_knowledge_base')
          .update({ status: 'PUBLISHED', updated_at: now })
          .eq('clinic_id', clinicId)
          .eq('status', 'VALIDATED')
          .select();
        if (retryResult.error) {
          console.error('[KnowledgeService.publishClinicKnowledge] Supabase retry error:', retryResult.error);
          throw new Error(`Failed to publish clinic knowledge in database: ${retryResult.error.message || retryResult.error.code}`);
        }
        data = retryResult.data;
      } else {
        console.error('[KnowledgeService.publishClinicKnowledge] Supabase error:', error);
        throw new Error(`Failed to publish clinic knowledge in database: ${error.message || error.code}`);
      }
    }
    return data || [];
  }

  // --- Clinic Knowledge Releases ---

  static async listKnowledgeReleases(clinicId: string): Promise<ClinicKnowledgeRelease[]> {
    if (!clinicId) throw new Error('clinicId is required to list knowledge releases');

    if (!supabase) {
      return ((db.data as any).clinic_knowledge_releases || [])
        .filter((r: ClinicKnowledgeRelease) => r.clinic_id === clinicId)
        .sort((a: ClinicKnowledgeRelease, b: ClinicKnowledgeRelease) => b.version - a.version);
    }

    const { data, error } = await supabase.from('clinic_knowledge_releases').select('*').eq('clinic_id', clinicId).order('version', { ascending: false });
    if (error) {
      console.error('[KnowledgeService.listKnowledgeReleases] Supabase error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw new Error(`Failed to retrieve knowledge releases from database: [${error.code}] ${error.message}`);
    }
    return data as ClinicKnowledgeRelease[];
  }

  static async getKnowledgeRelease(clinicId: string, id: string): Promise<ClinicKnowledgeRelease | null> {
    if (!clinicId) throw new Error('clinicId is required to get a knowledge release');

    if (!supabase) {
      return ((db.data as any).clinic_knowledge_releases || []).find((r: ClinicKnowledgeRelease) => r.id === id && r.clinic_id === clinicId) || null;
    }

    const { data, error } = await supabase.from('clinic_knowledge_releases').select('*').eq('clinic_id', clinicId).eq('id', id).maybeSingle();
    if (error && error.code !== 'PGRST116') {
      console.error('[KnowledgeService.getKnowledgeRelease] Supabase error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw new Error(`Failed to retrieve knowledge release from database: [${error.code}] ${error.message}`);
    }
    return data as ClinicKnowledgeRelease | null;
  }

  static async getLatestKnowledgeRelease(clinicId: string, status?: 'COMPILED' | 'PUBLISHED' | 'PUBLISH_FAILED'): Promise<ClinicKnowledgeRelease | null> {
    if (!clinicId) throw new Error('clinicId is required');

    if (!supabase) {
      let releases = ((db.data as any).clinic_knowledge_releases || [])
        .filter((r: ClinicKnowledgeRelease) => r.clinic_id === clinicId);
      if (status) {
        releases = releases.filter((r: ClinicKnowledgeRelease) => r.status === status);
      }
      releases.sort((a: ClinicKnowledgeRelease, b: ClinicKnowledgeRelease) => b.version - a.version);
      return releases.length > 0 ? releases[0] : null;
    }

    let query = supabase
      .from('clinic_knowledge_releases')
      .select('*')
      .eq('clinic_id', clinicId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('[KnowledgeService.getLatestKnowledgeRelease] Supabase error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw new Error(`Failed to retrieve latest knowledge release from database: [${error.code}] ${error.message}`);
    }
    return data as ClinicKnowledgeRelease | null;
  }

  static async createKnowledgeRelease(clinicId: string, release: Omit<ClinicKnowledgeRelease, 'clinic_id'>): Promise<ClinicKnowledgeRelease> {
    if (!clinicId) throw new Error('clinicId is required');

    const id = (release as any).id || crypto.randomUUID();

    const newRelease: ClinicKnowledgeRelease = {
      ...release,
      id,
      clinic_id: clinicId
    };

    if (!supabase) {
      if (!(db.data as any).clinic_knowledge_releases) (db.data as any).clinic_knowledge_releases = [];
      (db.data as any).clinic_knowledge_releases.push(newRelease);
      db.flush();
      return newRelease as ClinicKnowledgeRelease;
    }

    const { data, error } = await supabase.from('clinic_knowledge_releases').insert(newRelease).select().single();
    if (error) {
      console.error('[KnowledgeService.createKnowledgeRelease] Supabase error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw new Error(`Failed to create knowledge release in database: [${error.code}] ${error.message}`);
    }
    return data as ClinicKnowledgeRelease;
  }

  static async updateKnowledgeReleaseStatus(clinicId: string, id: string, status: 'COMPILED' | 'PUBLISHED' | 'PUBLISH_FAILED', publishedBy?: string): Promise<ClinicKnowledgeRelease> {
    if (!clinicId) throw new Error('clinicId is required');

    const updates: Partial<ClinicKnowledgeRelease> = { status };
    if (status === 'PUBLISHED') {
      updates.published_at = new Date().toISOString();
      if (publishedBy) updates.published_by = publishedBy;
    }

    if (!supabase) {
      const idx = ((db.data as any).clinic_knowledge_releases || []).findIndex((r: ClinicKnowledgeRelease) => r.id === id && r.clinic_id === clinicId);
      if (idx === -1) throw new Error('Knowledge release not found');
      (db.data as any).clinic_knowledge_releases[idx] = {
        ...(db.data as any).clinic_knowledge_releases[idx],
        ...updates
      };
      db.flush();
      return (db.data as any).clinic_knowledge_releases[idx];
    }

    const { data, error } = await supabase.from('clinic_knowledge_releases').update(updates).eq('clinic_id', clinicId).eq('id', id).select().single();
    if (error) {
      console.error('[KnowledgeService.updateKnowledgeReleaseStatus] Supabase error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw new Error(`Failed to update knowledge release status in database: [${error.code}] ${error.message}`);
    }
    return data as ClinicKnowledgeRelease;
  }
}
