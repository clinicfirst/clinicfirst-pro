import { showToast } from '../../components/common/Toast';
import React, { useState, useEffect } from 'react';
import {
  Bot,
  Phone,
  Save,
  Check,
  PhoneCall,
  Sparkles,
  Shield,
  Clock,
  Layers,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input, Select } from '../../components/common/Input';
import { AiPhoneSimulator } from '../../components/ai/AiPhoneSimulator';
import { KnowledgeCompilerPanel } from '../../components/clinic/KnowledgeCompilerPanel';
import { ClinicAiKnowledgeView } from '../../components/clinic/ClinicAiKnowledgeView';
import { SarvamVoiceWidget } from '../../components/ai/SarvamVoiceWidget';
import { apiRequest } from '../../api';
import { AiAgent } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { can } from '../../lib/permissions';
import {
  GREETING_STYLES,
  generateSafeGreeting,
  validateReceptionistPreferences,
} from '../../lib/aiValidator';

interface AiReceptionistPageProps {
  onOpenSimulator: () => void;
}

export const AiReceptionistPage: React.FC<AiReceptionistPageProps> = ({ onOpenSimulator }) => {
  const { user, clinic } = useAuth();
  const [agent, setAgent] = useState<AiAgent | null>(null);
  const [callsToday, setCallsToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Form State
  const [greetingStyle, setGreetingStyle] = useState<string>('professional');
  const [form, setForm] = useState({
    name: 'Ava',
    greeting: '',
    voice_provider: 'gemini_live',
    status: 'ACTIVE',
    languages: 'English',
    escalation_phone: '',
    escalation_email: '',
    escalation_name: '',
    instructions_note: '',
  });

  const [instructionsValidation, setInstructionsValidation] = useState<{ isValid: boolean; error?: string }>({
    isValid: true,
  });

  const fetchAgent = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ agent: AiAgent; callsTodayCount: number }>('/api/clinic/ai-agent');
      if (res.agent) {
        setAgent(res.agent);

        const clinicName = clinic?.name || 'our clinic';
        const initialGreeting = res.agent.greeting || generateSafeGreeting(clinicName, 'professional');

        // Detect matching style if possible
        let matchedStyle = 'professional';
        for (const [key, val] of Object.entries(GREETING_STYLES)) {
          if (generateSafeGreeting(clinicName, key) === initialGreeting) {
            matchedStyle = key;
            break;
          }
        }
        setGreetingStyle(matchedStyle);

        setForm({
          name: res.agent.name || 'Ava',
          greeting: initialGreeting,
          voice_provider: res.agent.voice_provider || 'gemini_live',
          status: res.agent.status || 'ACTIVE',
          languages: res.agent.languages?.join(', ') || 'English',
          escalation_phone: res.agent.escalation_contact?.phone || clinic?.phone || '',
          escalation_email: res.agent.escalation_contact?.email || clinic?.email || '',
          escalation_name: res.agent.escalation_contact?.name || 'Clinic Triage Staff',
          instructions_note: res.agent.instructions_note || '',
        });

        if (res.agent.instructions_note) {
          setInstructionsValidation(validateReceptionistPreferences(res.agent.instructions_note));
        }
      }
      setCallsToday(res.callsTodayCount || 0);
    } catch (err) {
      console.error('Failed to load AI agent configuration:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgent();
  }, [clinic?.id]);

  const handleStyleChange = (styleKey: string) => {
    setGreetingStyle(styleKey);
    const clinicName = clinic?.name || 'our clinic';
    const newGreeting = generateSafeGreeting(clinicName, styleKey);
    setForm((prev) => ({ ...prev, greeting: newGreeting }));
  };

  const handleInstructionsChange = (val: string) => {
    setForm((prev) => ({ ...prev, instructions_note: val }));
    setInstructionsValidation(validateReceptionistPreferences(val));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate instructions
    const val = validateReceptionistPreferences(form.instructions_note);
    if (!val.isValid) {
      showToast(val.error || 'Please resolve validation errors before saving.', 'error');
      return;
    }

    setSaving(true);
    setSavedSuccess(false);

    try {
      const payload = {
        name: form.name,
        greeting: form.greeting,
        greeting_style: greetingStyle,
        voice_provider: form.voice_provider,
        status: form.status,
        languages: form.languages.split(',').map((l) => l.trim()),
        escalation_contact: {
          phone: form.escalation_phone,
          email: form.escalation_email,
          name: form.escalation_name,
        },
        instructions_note: form.instructions_note,
      };

      const res = await apiRequest<{ agent: AiAgent }>('/api/clinic/ai-agent', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      setAgent(res.agent);
      setSavedSuccess(true);
      showToast('AI Receptionist preferences saved successfully.', 'success');
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      showToast(err.message || 'Failed to save configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  const canConfigure = can(user, 'configure_ai_receptionist');

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#0A0A0A] tracking-tight">AI Receptionist Core</h1>
            <Badge status={form.status} />
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Voice provider routing, clinical tool bindings, greeting script, and human triage escalation.
          </p>
        </div>
      </div>

      <div className="mb-8">
        <KnowledgeCompilerPanel />
      </div>

      <div className="mb-8">
        <ClinicAiKnowledgeView />
      </div>

      {user?.role === 'PLATFORM_ADMIN' && (
        <div className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">Platform Status & Diagnostics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white border border-gray-200 rounded-lg">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">
                Engine & Architecture
              </span>
              <div className="text-sm font-bold text-[#0A0A0A] flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-[#0A2540]" />
                <span>Platform Standard Model</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Model parameters and providers are governed by the Platform Admin.
              </p>
            </div>

            <div className="p-4 bg-white border border-gray-200 rounded-lg">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">
                Live Tool Registry
              </span>
              <div className="text-sm font-bold text-[#0A0A0A] flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#0A2540]" />
                <span>6 Real-Time DB Tools Bound</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Doctor availability, appointments, patient lookup, triage escalation.
              </p>
            </div>

            <div className="p-4 bg-white border border-gray-200 rounded-lg">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">
                Calls Processed Today
              </span>
              <div className="text-2xl font-bold font-mono text-[#0A0A0A]">{callsToday}</div>
              <p className="text-[11px] text-gray-500 mt-0.5">Live phone turns tracked</p>
            </div>
          </div>
        </div>
      )}

      {/* Sarvam AI Voice Test Section */}
      <div className="mb-8 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-[#0A0A0A]">Test AI Receptionist</h2>
          <p className="text-sm text-gray-500">
            Talk to your AI receptionist using your browser microphone.
          </p>
        </div>
        <div className="border border-gray-100 rounded-lg bg-gray-50 p-4">
          <SarvamVoiceWidget />
        </div>
      </div>

      {/* Configuration Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <Card
          title="Receptionist Identity & Behavior"
          subtitle="Configure how your AI receptionist greets patients and handles instructions"
          action={
            canConfigure && (
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={!instructionsValidation.isValid}
                loading={saving}
                icon={savedSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              >
                {savedSuccess ? 'Changes Saved' : 'Save Configuration'}
              </Button>
            )
          }
        >
          <div className="space-y-5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="AI Receptionist Name *"
                required
                disabled={!canConfigure}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ava"
              />

              <Select
                label="Operational Status *"
                disabled={!canConfigure}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                options={[
                  { value: 'ACTIVE', label: 'Active (Answering Calls)' },
                  { value: 'INACTIVE', label: 'Inactive (Disabled)' },
                ]}
              />
            </div>

            {/* AI Greeting */}
            <div className="p-4 border border-gray-200 rounded-lg bg-white space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#0A0A0A]">
                    AI Greeting
                  </label>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Select the tone and style for the opening greeting spoken when a patient call connects.
                  </p>
                </div>
                <Badge status="ACTIVE" label="Template Resolved" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
                {Object.entries(GREETING_STYLES).map(([key, style]) => (
                  <button
                    key={key}
                    type="button"
                    disabled={!canConfigure}
                    onClick={() => handleStyleChange(key)}
                    className={`px-3 py-2 text-left rounded-md border text-xs font-medium transition-colors ${
                      greetingStyle === key
                        ? 'border-[#0A2540] bg-[#0A2540] text-white'
                        : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="font-semibold">{style.label}</div>
                  </button>
                ))}
              </div>

              <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-800 leading-relaxed font-sans">
                <span className="font-semibold text-gray-600 block text-[10px] uppercase tracking-wider mb-1">
                  Active Greeting Output
                </span>
                "{form.greeting || generateSafeGreeting(clinic?.name || 'our clinic', greetingStyle)}"
              </div>

              <p className="text-[11px] text-gray-500 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span>
                  The clinic name is automatically resolved from your verified clinic profile. Greeting templates cannot contain hardcoded doctor or service facts.
                </span>
              </p>
            </div>

            {/* Receptionist Preferences & Instructions */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Receptionist Preferences & Instructions
                </label>
                <span className="text-[10px] text-gray-500 font-mono">Behavioral Only</span>
              </div>
              <textarea
                rows={4}
                disabled={!canConfigure}
                value={form.instructions_note}
                onChange={(e) => handleInstructionsChange(e.target.value)}
                className={`w-full p-3 border rounded text-xs focus:outline-none leading-relaxed transition-colors ${
                  !instructionsValidation.isValid
                    ? 'border-red-500 bg-red-50/20 focus:border-red-600'
                    : 'border-gray-300 focus:border-[#0A2540]'
                }`}
                placeholder="e.g. Please speak politely, keep responses concise, ask one question at a time, and maintain a professional tone."
              />
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Tell your AI receptionist how you want it to communicate and behave. Clinic information such as doctors, services, timings, prices and availability is automatically taken from your clinic records.
              </p>

              {!instructionsValidation.isValid && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-xs flex items-start gap-2 mt-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Factual Content Detected</div>
                    <p className="text-[11px] mt-0.5 text-red-600">
                      {instructionsValidation.error}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Platform Governance & Safety Notice */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#0A2540]" />
                  <span className="text-xs font-bold text-[#0A0A0A]">Platform Safety Rules & Knowledge Base</span>
                </div>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[#0A2540] text-white">
                  Platform Protected
                </span>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Your AI receptionist operates under platform-enforced medical safety boundaries (no medical diagnosis, no prescribing, mandatory verification before booking confirmation, and automatic human escalation for emergencies). Platform-wide knowledge base policies and your clinic's real-time database are automatically combined for accurate patient assistance.
              </p>
            </div>

            {/* Emergency Escalation Triage Contacts */}
            <div className="pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#0A2540] mb-3 pb-1 border-b border-gray-200 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                <span>Human Staff Escalation & Emergency Triage Routing</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Triage Desk / Staff Name"
                  disabled={!canConfigure}
                  value={form.escalation_name}
                  onChange={(e) => setForm({ ...form, escalation_name: e.target.value })}
                  placeholder="On-Duty Nurse"
                />

                <Input
                  label="Emergency Escalation Phone *"
                  required
                  disabled={!canConfigure}
                  value={form.escalation_phone}
                  onChange={(e) => setForm({ ...form, escalation_phone: e.target.value })}
                  placeholder="+1-555-010-9911"
                />

                <Input
                  label="Escalation Email"
                  type="email"
                  disabled={!canConfigure}
                  value={form.escalation_email}
                  onChange={(e) => setForm({ ...form, escalation_email: e.target.value })}
                  placeholder="triage@clinic.com"
                />
              </div>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
};

