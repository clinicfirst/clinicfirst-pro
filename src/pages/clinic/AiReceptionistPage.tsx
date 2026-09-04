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
  validateGreetingContent,
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
  const [greetingStyle, setGreetingStyle] = useState<string>('warm');
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
    provider_agent_id: '',
  });

  const [instructionsValidation, setInstructionsValidation] = useState<{ isValid: boolean; error?: string }>({
    isValid: true,
  });
  const [greetingValidation, setGreetingValidation] = useState<{ isValid: boolean; error?: string }>({
    isValid: true,
  });

  const fetchAgent = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ agent: AiAgent; callsTodayCount: number }>('/api/clinic/ai-agent');
      if (res.agent) {
        setAgent(res.agent);

        const clinicName = clinic?.name || 'our clinic';
        const agentName = res.agent.name || 'Ava';
        const initialGreeting = res.agent.greeting || generateSafeGreeting(clinicName, 'warm', agentName);

        // Detect matching style if possible
        let matchedStyle = 'custom';
        for (const [key] of Object.entries(GREETING_STYLES)) {
          if (generateSafeGreeting(clinicName, key, agentName) === initialGreeting) {
            matchedStyle = key;
            break;
          }
        }
        setGreetingStyle(matchedStyle);
        setGreetingValidation(validateGreetingContent(initialGreeting));

        setForm({
          name: agentName,
          greeting: initialGreeting,
          voice_provider: res.agent.voice_provider || 'gemini_live',
          status: res.agent.status || 'ACTIVE',
          languages: res.agent.languages?.join(', ') || 'English',
          escalation_phone: res.agent.escalation_contact?.phone || clinic?.phone || '',
          escalation_email: res.agent.escalation_contact?.email || clinic?.email || '',
          escalation_name: res.agent.escalation_contact?.name || 'Clinic Triage Staff',
          instructions_note: res.agent.instructions_note || '',
          provider_agent_id: res.agent.provider_agent_id || '',
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

  const handleNameChange = (newName: string) => {
    const clinicName = clinic?.name || 'our clinic';
    const oldName = form.name;

    setForm((prev) => {
      let updatedGreeting = prev.greeting;

      // If user is on a standard preset style, auto-generate with the new name
      if (greetingStyle !== 'custom' && GREETING_STYLES[greetingStyle]) {
        updatedGreeting = generateSafeGreeting(clinicName, greetingStyle, newName);
      } else if (oldName.trim() && updatedGreeting.includes(oldName.trim())) {
        // If customized but includes previous name, update it seamlessly
        updatedGreeting = updatedGreeting.split(oldName.trim()).join(newName.trim() || 'your AI receptionist');
      }

      setGreetingValidation(validateGreetingContent(updatedGreeting));
      return {
        ...prev,
        name: newName,
        greeting: updatedGreeting,
      };
    });
  };

  const handleStyleChange = (styleKey: string) => {
    setGreetingStyle(styleKey);
    const clinicName = clinic?.name || 'our clinic';
    const newGreeting = generateSafeGreeting(clinicName, styleKey, form.name);
    setForm((prev) => ({ ...prev, greeting: newGreeting }));
    setGreetingValidation(validateGreetingContent(newGreeting));
  };

  const handleGreetingChange = (val: string) => {
    const clinicName = clinic?.name || 'our clinic';
    setForm((prev) => ({ ...prev, greeting: val }));

    const valResult = validateGreetingContent(val);
    setGreetingValidation(valResult);

    // Detect if text matches any preset
    let matched = 'custom';
    for (const [key] of Object.entries(GREETING_STYLES)) {
      if (generateSafeGreeting(clinicName, key, form.name).toLowerCase() === val.trim().toLowerCase()) {
        matched = key;
        break;
      }
    }
    setGreetingStyle(matched);
  };

  const handleInsertPlaceholder = (type: 'name' | 'clinic') => {
    const textToInsert = type === 'name'
      ? (form.name.trim() || 'your AI receptionist')
      : (clinic?.name || 'our clinic');

    const current = form.greeting.trim();
    const updated = current ? `${current} ${textToInsert}` : textToInsert;
    handleGreetingChange(updated);
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

    // Validate greeting
    const greetingVal = validateGreetingContent(form.greeting);
    if (!greetingVal.isValid) {
      showToast(greetingVal.error || 'Please resolve greeting errors before saving.', 'error');
      return;
    }

    if (!form.name.trim()) {
      showToast('AI Receptionist name is required.', 'error');
      return;
    }

    if (!form.greeting.trim()) {
      showToast('AI greeting text cannot be empty.', 'error');
      return;
    }

    setSaving(true);
    setSavedSuccess(false);

    try {
      const payload = {
        name: form.name.trim(),
        greeting: form.greeting.trim(),
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
        provider_agent_id: form.provider_agent_id.trim() || undefined,
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
                disabled={!instructionsValidation.isValid || !greetingValidation.isValid || !form.name.trim() || !form.greeting.trim()}
                loading={saving}
                icon={savedSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              >
                {savedSuccess ? 'Changes Saved' : 'Save Configuration'}
              </Button>
            )
          }
        >
          <div className="space-y-5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="AI Receptionist Name *"
                required
                disabled={!canConfigure}
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
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

              <Input
                label="Sarvam Provider Agent ID"
                disabled={!canConfigure}
                value={form.provider_agent_id}
                onChange={(e) => setForm({ ...form, provider_agent_id: e.target.value })}
                placeholder="sarvam_agent_456"
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
                    Opening greeting spoken when a patient call connects. Changes to AI Receptionist Name update this automatically.
                  </p>
                </div>
                {greetingStyle === 'custom' ? (
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded">
                    Custom Greeting
                  </span>
                ) : (
                  <Badge status="ACTIVE" label={`Template: ${GREETING_STYLES[greetingStyle]?.label || 'Resolved'}`} />
                )}
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

              {/* Directly Editable Spoken Greeting Textarea */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="ai-greeting-editor" className="block text-[11px] font-semibold uppercase tracking-wider text-gray-700">
                    Active Spoken Greeting (Editable)
                  </label>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {form.greeting.length} characters
                  </span>
                </div>

                <textarea
                  id="ai-greeting-editor"
                  rows={3}
                  disabled={!canConfigure}
                  value={form.greeting}
                  onChange={(e) => handleGreetingChange(e.target.value)}
                  placeholder={`Hello, thank you for calling ${clinic?.name || 'our clinic'}! I'm ${form.name || 'your AI receptionist'}...`}
                  className={`w-full p-3 border rounded-lg text-xs leading-relaxed transition-colors font-sans focus:outline-none ${
                    !greetingValidation.isValid
                      ? 'border-red-500 bg-red-50/20 focus:border-red-600'
                      : 'border-gray-200 bg-white focus:border-[#0A2540] focus:ring-1 focus:ring-[#0A2540]'
                  }`}
                />

                {!greetingValidation.isValid && greetingValidation.error && (
                  <div className="text-[11px] text-red-600 flex items-start gap-1 bg-red-50 border border-red-200 p-2 rounded">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                    <span>{greetingValidation.error}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                    <span className="font-medium text-gray-600">Quick insert:</span>
                    <button
                      type="button"
                      disabled={!canConfigure}
                      onClick={() => handleInsertPlaceholder('name')}
                      className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[10px] font-medium border border-gray-200 transition-colors"
                      title="Insert receptionist name into greeting"
                    >
                      + Receptionist Name ({form.name || 'Ava'})
                    </button>
                    <button
                      type="button"
                      disabled={!canConfigure}
                      onClick={() => handleInsertPlaceholder('clinic')}
                      className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[10px] font-medium border border-gray-200 transition-colors"
                      title="Insert clinic name into greeting"
                    >
                      + Clinic Name ({clinic?.name || 'Clinic'})
                    </button>
                  </div>

                  {greetingStyle === 'custom' && (
                    <button
                      type="button"
                      disabled={!canConfigure}
                      onClick={() => handleStyleChange('warm')}
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-medium underline transition-colors"
                    >
                      Reset to Warm & Friendly preset
                    </button>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-gray-500 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span>
                  The clinic name and receptionist name are automatically merged. You can customize the greeting above, or click any tone preset to generate a fresh greeting using your current receptionist name.
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

