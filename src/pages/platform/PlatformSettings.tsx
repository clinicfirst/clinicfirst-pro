import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  Bot,
  Database,
  Lock,
  Save,
  CheckCircle2,
  AlertCircle,
  Cpu,
  FileText,
  BookOpen,
  Sliders,
} from 'lucide-react';
import { Skeleton } from '../../components/common/Skeleton';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { PlatformAiProviderConfig } from '../../components/platform/PlatformAiProviderConfig';
import { PlatformAiInstructions } from '../../components/platform/PlatformAiInstructions';
import { PlatformKnowledgeBase } from '../../components/platform/PlatformKnowledgeBase';
import { PlatformAiConfig } from '../../types';
import { apiRequest } from '../../api';

interface PlatformSettingsState {
  system_name: string;
  version: string;
  tenant_isolation_mode: string;
  default_ai_voice: string;
  default_ai_provider: string;
  default_timezone: string;
  enforce_password_rotation_days: number;
  max_failed_logins: number;
  session_timeout_minutes: number;
  allow_self_service_onboarding: boolean;
}

export const PlatformSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'AI_ENGINE' | 'SECURITY_SYSTEM'>('AI_ENGINE');
  const [aiSubTab, setAiSubTab] = useState<'PROVIDER' | 'INSTRUCTIONS' | 'KNOWLEDGE_BASE'>('PROVIDER');

  const [settings, setSettings] = useState<PlatformSettingsState>({
    system_name: 'CLINICFIRST Platform Engine',
    version: '1.0.0',
    tenant_isolation_mode: 'STRICT_RLS',
    default_ai_voice: 'Zephyr',
    default_ai_provider: 'gemini_live',
    default_timezone: 'America/Los_Angeles',
    enforce_password_rotation_days: 90,
    max_failed_logins: 5,
    session_timeout_minutes: 480,
    allow_self_service_onboarding: false,
  });

  const [aiConfig, setAiConfig] = useState<PlatformAiConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [settingsRes, aiConfigRes] = await Promise.all([
          apiRequest<{ settings: PlatformSettingsState }>('/api/platform/settings'),
          apiRequest<{ config: PlatformAiConfig }>('/api/platform/ai-config'),
        ]);
        if (settingsRes?.settings) {
          setSettings(settingsRes.settings);
        }
        if (aiConfigRes?.config) {
          setAiConfig(aiConfigRes.config);
        }
      } catch (err: any) {
        console.error('Failed to load platform data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSaveSecuritySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setError(null);
    setSavedSuccess(false);

    try {
      const data = await apiRequest<{ settings: PlatformSettingsState }>('/api/platform/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      setSettings(data.settings);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-6 w-1/4 mb-1" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-[#0A0A0A] tracking-tight">Platform AI & System Settings</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage global AI infrastructure, model parameters, master instructions, knowledge base, and tenant isolation.
          </p>
        </div>

        {/* Primary Tabs */}
        <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('AI_ENGINE')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'AI_ENGINE'
                ? 'bg-[#0A2540] text-white shadow-sm'
                : 'text-gray-600 hover:text-[#0A0A0A]'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            AI Receptionist Platform
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('SECURITY_SYSTEM')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'SECURITY_SYSTEM'
                ? 'bg-[#0A2540] text-white shadow-sm'
                : 'text-gray-600 hover:text-[#0A0A0A]'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Security & System
          </button>
        </div>
      </div>

      {activeTab === 'AI_ENGINE' && (
        <div className="space-y-6">
          {/* AI Sub Navigation */}
          <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
            <button
              type="button"
              onClick={() => setAiSubTab('PROVIDER')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer border ${
                aiSubTab === 'PROVIDER'
                  ? 'bg-[#0A2540] text-white border-[#0A2540]'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              Provider & Model
            </button>
            <button
              type="button"
              onClick={() => setAiSubTab('INSTRUCTIONS')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer border ${
                aiSubTab === 'INSTRUCTIONS'
                  ? 'bg-[#0A2540] text-white border-[#0A2540]'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Master Instructions & Rules
            </button>
            <button
              type="button"
              onClick={() => setAiSubTab('KNOWLEDGE_BASE')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer border ${
                aiSubTab === 'KNOWLEDGE_BASE'
                  ? 'bg-[#0A2540] text-white border-[#0A2540]'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Platform Knowledge Base
            </button>
          </div>

          {/* Sub-tab Views */}
          {aiSubTab === 'PROVIDER' && aiConfig && (
            <PlatformAiProviderConfig
              config={aiConfig}
              onUpdate={(updated) => setAiConfig(updated)}
            />
          )}

          {aiSubTab === 'INSTRUCTIONS' && aiConfig && (
            <PlatformAiInstructions
              config={aiConfig}
              onUpdate={(updated) => setAiConfig(updated)}
            />
          )}

          {aiSubTab === 'KNOWLEDGE_BASE' && <PlatformKnowledgeBase />}
        </div>
      )}

      {activeTab === 'SECURITY_SYSTEM' && (
        <form onSubmit={handleSaveSecuritySettings} className="space-y-6">
          {savedSuccess && (
            <div className="p-3 bg-white border border-[#0A2540] rounded text-xs font-semibold text-[#0A2540] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#0A2540]" />
              Platform security configuration updated successfully.
            </div>
          )}

          {error && (
            <div className="p-3 bg-white border border-red-500 rounded text-xs font-semibold text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              {error}
            </div>
          )}

          {/* Tenant Isolation & Security */}
          <Card
            title="Tenant Isolation & Architectural Security"
            subtitle="Strict multi-tenant boundary enforcement via clinic_id filtering and server-side verification"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold uppercase tracking-wider text-gray-700 mb-1">
                  Tenant Isolation Mode
                </label>
                <select
                  value={settings.tenant_isolation_mode}
                  onChange={(e) => setSettings({ ...settings, tenant_isolation_mode: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-xs text-[#0A0A0A] focus:outline-none focus:border-[#0A2540]"
                >
                  <option value="STRICT_RLS">STRICT_RLS (Enforce single tenant clinic_id on all queries)</option>
                  <option value="ENFORCE_TOKEN_AUTH">ENFORCE_TOKEN_AUTH (Cryptographic session validation)</option>
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Guarantees zero cross-clinic data leakage between clinics.
                </p>
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider text-gray-700 mb-1">
                  Session Timeout (Minutes)
                </label>
                <Input
                  type="number"
                  value={settings.session_timeout_minutes}
                  onChange={(e) =>
                    setSettings({ ...settings, session_timeout_minutes: parseInt(e.target.value) || 60 })
                  }
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Max idle time before re-authenticating staff sessions.
                </p>
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider text-gray-700 mb-1">
                  Max Failed Login Attempts
                </label>
                <Input
                  type="number"
                  value={settings.max_failed_logins}
                  onChange={(e) =>
                    setSettings({ ...settings, max_failed_logins: parseInt(e.target.value) || 3 })
                  }
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Triggers account lockout and audit warning.
                </p>
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider text-gray-700 mb-1">
                  Force Password Rotation (Days)
                </label>
                <Input
                  type="number"
                  value={settings.enforce_password_rotation_days}
                  onChange={(e) =>
                    setSettings({ ...settings, enforce_password_rotation_days: parseInt(e.target.value) || 90 })
                  }
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Periodic password reset requirement for clinic users.
                </p>
              </div>
            </div>
          </Card>

          {/* System Diagnostics */}
          <Card title="System Diagnostics" subtitle="Core database and runtime information">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-gray-50 rounded border border-gray-200">
                <span className="text-gray-500 font-mono text-[10px] uppercase">Engine Status</span>
                <p className="font-bold text-[#0A2540] mt-0.5">ONLINE (Healthy)</p>
              </div>
              <div className="p-3 bg-gray-50 rounded border border-gray-200">
                <span className="text-gray-500 font-mono text-[10px] uppercase">Persistence DB</span>
                <p className="font-bold text-[#0A2540] mt-0.5">PostgreSQL / JSON Engine</p>
              </div>
              <div className="p-3 bg-gray-50 rounded border border-gray-200">
                <span className="text-gray-500 font-mono text-[10px] uppercase">Build Version</span>
                <p className="font-mono text-gray-800 mt-0.5">{settings.version}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded border border-gray-200">
                <span className="text-gray-500 font-mono text-[10px] uppercase">Tenant Mode</span>
                <p className="font-mono text-gray-800 mt-0.5">clinic_id isolation</p>
              </div>
            </div>
          </Card>

          <div className="flex justify-end">
            <Button
              variant="primary"
              size="md"
              type="submit"
              loading={savingSettings}
              icon={<Save className="w-4 h-4" />}
            >
              Save Platform Security Settings
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};

