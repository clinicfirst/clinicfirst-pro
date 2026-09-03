import { supabase } from '../supabaseDiff';
import { db } from '../db';
import { AiAgent } from '../../src/types';

export class AiAgentService {
  /**
   * Helper to normalize database record into strict AiAgent interface
   */
  private static formatAgent(row: any): AiAgent {
    if (!row) return row;

    let voiceConfig = row.voice_config;
    if (typeof voiceConfig === 'string') {
      try {
        voiceConfig = JSON.parse(voiceConfig);
      } catch {
        voiceConfig = {};
      }
    }

    let languages = row.languages;
    if (typeof languages === 'string') {
      try {
        languages = JSON.parse(languages);
      } catch {
        languages = ['English'];
      }
    } else if (!Array.isArray(languages)) {
      languages = ['English'];
    }

    let escalationContact = row.escalation_contact;
    if (typeof escalationContact === 'string') {
      try {
        escalationContact = JSON.parse(escalationContact);
      } catch {
        escalationContact = {};
      }
    }

    const isEnabled = row.enabled !== undefined ? Boolean(row.enabled) : row.status === 'ACTIVE';
    const status = row.status || (isEnabled ? 'ACTIVE' : 'INACTIVE');

    return {
      id: row.id,
      clinic_id: row.clinic_id,
      name: row.name || 'AI Receptionist',
      greeting: row.greeting || '',
      voice_provider: row.voice_provider || 'gemini_live',
      voice_config: voiceConfig || {},
      languages: languages,
      status: status,
      escalation_contact: escalationContact || {},
      instructions_note: row.instructions_note || undefined,
      provider_agent_id: row.provider_agent_id || undefined,
      enabled: isEnabled,
      primary_language: row.primary_language || 'English',
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Fetch authoritative AI Agent for a clinic
   */
  static async getAgentByClinic(clinicId: string): Promise<AiAgent | null> {
    if (!clinicId) return null;

    if (supabase) {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('clinic_id', clinicId)
        .maybeSingle();

      if (error) {
        console.error('[AiAgentService.getAgentByClinic] Supabase query error:', error);
        throw new Error(`Database error fetching AI agent: ${error.message}`);
      }

      return data ? this.formatAgent(data) : null;
    }

    // Offline fallback
    const agent = db.getAiAgent(clinicId);
    return agent || null;
  }

  /**
   * Fetch AI Agent by ID within tenant boundary
   */
  static async getAgentById(clinicId: string, id: string): Promise<AiAgent | null> {
    if (!clinicId || !id) return null;

    if (supabase) {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('id', id)
        .eq('clinic_id', clinicId)
        .maybeSingle();

      if (error) {
        console.error('[AiAgentService.getAgentById] Supabase query error:', error);
        throw new Error(`Database error fetching AI agent: ${error.message}`);
      }

      return data ? this.formatAgent(data) : null;
    }

    const agent = db.data.ai_agents.find((a) => a.id === id && a.clinic_id === clinicId);
    return agent || null;
  }

  /**
   * Resolve AI Agent by provider_agent_id across tenants (authoritative resolution for webhooks)
   */
  static async getAgentByProviderAgentId(providerAgentId: string): Promise<AiAgent | null> {
    if (!providerAgentId) return null;

    if (supabase) {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('provider_agent_id', providerAgentId)
        .maybeSingle();

      if (error) {
        console.error('[AiAgentService.getAgentByProviderAgentId] Supabase query error:', error);
        throw new Error(`Database error resolving AI agent by provider ID: ${error.message}`);
      }

      return data ? this.formatAgent(data) : null;
    }

    const agent = db.data.ai_agents.find((a) => a.provider_agent_id === providerAgentId);
    return agent || null;
  }

  /**
   * Create or Initialize an AI Agent for a clinic
   */
  static async createAgent(clinicId: string, data: Partial<AiAgent>): Promise<AiAgent> {
    if (!clinicId) throw new Error('clinic_id is required');

    const now = new Date().toISOString();
    const id = data.id || `agent_${clinicId}`;
    const status = data.status || 'ACTIVE';
    const isEnabled = data.enabled !== undefined ? data.enabled : status === 'ACTIVE';

    const newAgent: AiAgent = {
      id,
      clinic_id: clinicId,
      name: data.name?.trim() || 'AI Receptionist',
      greeting: data.greeting || '',
      voice_provider: data.voice_provider || 'gemini_live',
      voice_config: data.voice_config || { voice_name: 'Zephyr', temperature: 0.2 },
      languages: data.languages || ['English'],
      status,
      escalation_contact: data.escalation_contact || {},
      instructions_note: data.instructions_note,
      provider_agent_id: data.provider_agent_id,
      enabled: isEnabled,
      primary_language: data.primary_language || 'English',
      created_at: now,
      updated_at: now,
    };

    if (supabase) {
      const { data: created, error } = await supabase
        .from('ai_agents')
        .upsert({
          id: newAgent.id,
          clinic_id: newAgent.clinic_id,
          name: newAgent.name,
          greeting: newAgent.greeting,
          voice_provider: newAgent.voice_provider,
          voice_config: newAgent.voice_config,
          languages: newAgent.languages,
          status: newAgent.status,
          escalation_contact: newAgent.escalation_contact,
          instructions_note: newAgent.instructions_note || null,
          provider_agent_id: newAgent.provider_agent_id || null,
          enabled: newAgent.enabled,
          primary_language: newAgent.primary_language,
          created_at: newAgent.created_at,
          updated_at: newAgent.updated_at,
        })
        .select()
        .single();

      if (error) {
        console.error('[AiAgentService.createAgent] Supabase insert error:', error);
        throw new Error(`Database error creating AI agent: ${error.message}`);
      }

      return this.formatAgent(created);
    }

    db.saveAiAgent(newAgent);
    return newAgent;
  }

  /**
   * Update AI Agent configuration for a clinic (strict tenant boundary)
   */
  static async updateAgent(clinicId: string, updates: Partial<AiAgent>): Promise<AiAgent> {
    if (!clinicId) throw new Error('clinic_id is required');

    const existing = await this.getAgentByClinic(clinicId);
    if (!existing) {
      // If agent doesn't exist yet, create it
      return this.createAgent(clinicId, updates);
    }

    const now = new Date().toISOString();
    const updatedStatus = updates.status !== undefined ? updates.status : existing.status;
    const updatedEnabled =
      updates.enabled !== undefined
        ? updates.enabled
        : updates.status !== undefined
        ? updates.status === 'ACTIVE'
        : existing.enabled;

    const merged: AiAgent = {
      ...existing,
      ...updates,
      clinic_id: clinicId, // Immutable tenant boundary
      status: updatedStatus,
      enabled: updatedEnabled,
      updated_at: now,
    };

    if (supabase) {
      const payload: any = {
        name: merged.name,
        greeting: merged.greeting,
        voice_provider: merged.voice_provider,
        voice_config: merged.voice_config,
        languages: merged.languages,
        status: merged.status,
        escalation_contact: merged.escalation_contact,
        instructions_note: merged.instructions_note || null,
        provider_agent_id: merged.provider_agent_id || null,
        enabled: merged.enabled,
        primary_language: merged.primary_language,
        updated_at: now,
      };

      const { data, error } = await supabase
        .from('ai_agents')
        .update(payload)
        .eq('clinic_id', clinicId)
        .select()
        .single();

      if (error) {
        console.error('[AiAgentService.updateAgent] Supabase update error:', error);
        throw new Error(`Database error updating AI agent: ${error.message}`);
      }

      return this.formatAgent(data);
    }

    db.saveAiAgent(merged);
    return merged;
  }

  /**
   * Enable AI agent for clinic
   */
  static async enableAgent(clinicId: string): Promise<AiAgent> {
    return this.updateAgent(clinicId, { status: 'ACTIVE', enabled: true });
  }

  /**
   * Disable AI agent for clinic
   */
  static async disableAgent(clinicId: string): Promise<AiAgent> {
    return this.updateAgent(clinicId, { status: 'INACTIVE', enabled: false });
  }

  /**
   * Get provider agent ID for clinic
   */
  static async getProviderAgentId(clinicId: string): Promise<string | null> {
    const agent = await this.getAgentByClinic(clinicId);
    return agent?.provider_agent_id || null;
  }

  /**
   * Resolve authoritative agent for clinic (with fallback defaults for display if uninitialized)
   */
  static async resolveAgentForClinic(clinicId: string, clinicName?: string): Promise<AiAgent> {
    const existing = await this.getAgentByClinic(clinicId);
    if (existing) return existing;

    const fallbackName = clinicName || 'Clinic';
    return {
      id: `agent_${clinicId}`,
      clinic_id: clinicId,
      name: `${fallbackName} AI Receptionist`,
      greeting: `Thank you for calling ${fallbackName}. How can I assist you with your appointment today?`,
      voice_provider: 'gemini_live',
      voice_config: { voice_name: 'Zephyr', temperature: 0.2 },
      languages: ['English'],
      status: 'ACTIVE',
      escalation_contact: {},
      enabled: true,
      primary_language: 'English',
    };
  }
}
