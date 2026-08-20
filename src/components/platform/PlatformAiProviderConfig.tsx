import React, { useState } from 'react';
import { Bot, Key, CheckCircle2, AlertCircle, RefreshCw, Trash2, Cpu, Volume2, ShieldCheck, Zap } from 'lucide-react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { PlatformAiConfig } from '../../types';
import { apiRequest } from '../../api';

interface PlatformAiProviderConfigProps {
  config: PlatformAiConfig;
  onUpdate: (updated: PlatformAiConfig) => void;
}

export const PlatformAiProviderConfig: React.FC<PlatformAiProviderConfigProps> = ({ config, onUpdate }) => {
  const [editingKey, setEditingKey] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Local state for basic fields
  const [provider, setProvider] = useState(config.provider || 'gemini');
  const [model, setModel] = useState(config.model || 'gemini-3.6-flash');
  const [voiceProvider, setVoiceProvider] = useState(config.voice_provider || 'gemini_live');
  const [voiceName, setVoiceName] = useState(config.voice_name || 'Zephyr');
  const [temperature, setTemperature] = useState(config.temperature ?? 0.2);
  const [status, setStatus] = useState(config.status || 'ACTIVE');

  const handleSaveConfig = async (overrideParams?: Partial<PlatformAiConfig> & { new_api_key?: string; remove_api_key?: boolean }) => {
    setSaving(true);
    setErrorMessage(null);
    setSaveSuccess(false);

    try {
      const payload = {
        provider,
        model,
        voice_provider: voiceProvider,
        voice_name: voiceName,
        temperature,
        status,
        ...(newKey.trim() ? { new_api_key: newKey.trim() } : {}),
        ...overrideParams,
      };

      const res = await apiRequest<{ config: PlatformAiConfig }>('/api/platform/ai-config', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      onUpdate(res.config);
      setNewKey('');
      setEditingKey(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update AI configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    setErrorMessage(null);

    try {
      const res = await apiRequest<{
        success: boolean;
        message: string;
        latencyMs?: number;
      }>('/api/platform/ai-config/test-connection', {
        method: 'POST',
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'AI Provider connection failed. Please verify API credentials.',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleRemoveKey = async () => {
    if (!confirm('Are you sure you want to remove the custom API key? The system will fallback to the platform default.')) {
      return;
    }
    await handleSaveConfig({ remove_api_key: true });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Status & Health */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#0A2540] flex items-center justify-center text-white">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[#0A0A0A]">AI Receptionist Engine Status</h2>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                  status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-gray-100 text-gray-700 border border-gray-200'
                }`}
              >
                {status}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Governs all active clinic AI phone receptionists, tool executions, and voice models.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const nextStatus = status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
              setStatus(nextStatus);
              handleSaveConfig({ status: nextStatus });
            }}
            className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors cursor-pointer ${
              status === 'ACTIVE'
                ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                : 'border-[#0A2540] bg-[#0A2540] text-white hover:bg-[#071b30]'
            }`}
          >
            {status === 'ACTIVE' ? 'Deactivate AI Engine' : 'Activate AI Engine'}
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Platform AI settings successfully updated.</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-md text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Grid: Provider / Key & Model Parameters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Card: AI Provider & API Key Security */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-[#0A2540]" />
              <h3 className="text-sm font-bold text-[#0A0A0A]">AI Provider & Credentials</h3>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-gray-500 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Server-Side Vault
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Active AI Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as any)}
              className="w-full text-xs rounded border border-gray-300 bg-white px-3 py-2 text-[#0A0A0A] focus:outline-none focus:border-[#0A2540]"
            >
              <option value="gemini">Google Gemini (Multi-modal & Function Calling)</option>
              <option value="sarvam">Sarvam AI (Regional Languages Voice Engine)</option>
            </select>
            <p className="text-[11px] text-gray-500 mt-1">
              Selected provider executes conversational reasoning and real-time clinic database tool calls.
            </p>
          </div>

          {/* API Key Security Section */}
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-gray-600" />
                Master API Key Status
              </span>
              <span
                className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded ${
                  config.api_key_configured
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {config.api_key_configured ? 'Configured' : 'Not Configured'}
              </span>
            </div>

            <div className="font-mono text-xs text-gray-600 bg-white border border-gray-200 px-2.5 py-1.5 rounded">
              {config.api_key_masked}
            </div>

            {!editingKey ? (
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingKey(true)}
                  className="text-xs"
                >
                  {config.api_key_configured ? 'Replace Key' : 'Configure Key'}
                </Button>
                {config.api_key_configured && (
                  <button
                    type="button"
                    onClick={handleRemoveKey}
                    className="p-1.5 text-gray-400 hover:text-rose-600 transition-colors"
                    title="Remove custom key"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <Input
                  type="password"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="Enter new Gemini API key (AIzaSy...)"
                  className="text-xs font-mono"
                />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleSaveConfig()}
                    loading={saving}
                    disabled={!newKey.trim()}
                    className="text-xs bg-[#0A2540] text-white hover:bg-[#071b30]"
                  >
                    Save Key
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingKey(false);
                      setNewKey('');
                    }}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Test Connection Button & Result */}
          <div className="pt-2">
            <div className="flex items-center justify-between">
              <Button
                size="sm"
                variant="outline"
                onClick={handleTestConnection}
                loading={testingConnection}
                className="text-xs flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 text-[#0A2540]" />
                Test AI Connection
              </Button>
              {testResult && (
                <span className="text-[11px] font-mono text-gray-500">
                  {testResult.latencyMs ? `${testResult.latencyMs}ms latency` : ''}
                </span>
              )}
            </div>

            {testResult && (
              <div
                className={`mt-2.5 p-3 rounded text-xs border flex items-start gap-2 ${
                  testResult.success
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-semibold">{testResult.success ? 'Connected Successfully' : 'Connection Failed'}</div>
                  <div className="text-[11px] mt-0.5">{testResult.message}</div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Right Card: Model Selection & Voice Parameters */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-[#0A2540]" />
              <h3 className="text-sm font-bold text-[#0A0A0A]">Model & Voice Parameters</h3>
            </div>
            <span className="text-[11px] text-gray-400 font-mono">Platform Standard</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Reasoning Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full text-xs rounded border border-gray-300 bg-white px-3 py-2 text-[#0A0A0A] focus:outline-none focus:border-[#0A2540]"
            >
              <option value="gemini-3.6-flash">gemini-3.6-flash (Recommended: Low latency & Tool calling)</option>
              <option value="gemini-3.6-pro">gemini-3.6-pro (High reasoning precision)</option>
              <option value="gemini-1.5-flash">gemini-1.5-flash (Standard fallback)</option>
            </select>
            <p className="text-[11px] text-gray-500 mt-1">
              New inbound calls immediately utilize this configured model without downtime.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Voice Persona</label>
            <select
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              className="w-full text-xs rounded border border-gray-300 bg-white px-3 py-2 text-[#0A0A0A] focus:outline-none focus:border-[#0A2540]"
            >
              <option value="Zephyr">Zephyr (Warm, empathetic medical tone - Default)</option>
              <option value="Aoede">Aoede (Clear, professional cadence)</option>
              <option value="Puck">Puck (Friendly, conversational)</option>
              <option value="Charon">Charon (Calm, authoritative)</option>
              <option value="Kore">Kore (Gentle, supportive)</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-700">Temperature: {temperature}</label>
              <span className="text-[11px] text-gray-400 font-mono">Low = Deterministic & Strict</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="0.8"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-[#0A2540] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-gray-400 font-mono mt-1">
              <span>0.0 (Strict / Clinical)</span>
              <span>0.4 (Conversational)</span>
              <span>0.8 (Creative)</span>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100 flex justify-end">
            <Button
              onClick={() => handleSaveConfig()}
              loading={saving}
              className="text-xs bg-[#0A2540] text-white hover:bg-[#071b30]"
            >
              Save Model Configuration
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
