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
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input, Select } from '../../components/common/Input';
import { AiPhoneSimulator } from '../../components/ai/AiPhoneSimulator';
import { KnowledgeCompilerPanel } from '../../components/clinic/KnowledgeCompilerPanel';
import { SarvamVoiceWidget } from '../../components/ai/SarvamVoiceWidget';
import { apiRequest } from '../../api';
import { AiAgent } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { can } from '../../lib/permissions';

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

  const fetchAgent = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ agent: AiAgent; callsTodayCount: number }>('/api/clinic/ai-agent');
      if (res.agent) {
        setAgent(res.agent);
        setForm({
          name: res.agent.name || 'Ava',
          greeting: res.agent.greeting || '',
          voice_provider: res.agent.voice_provider || 'gemini_live',
          status: res.agent.status || 'ACTIVE',
          languages: res.agent.languages?.join(', ') || 'English',
          escalation_phone: res.agent.escalation_contact?.phone || clinic?.phone || '',
          escalation_email: res.agent.escalation_contact?.email || clinic?.email || '',
          escalation_name: res.agent.escalation_contact?.name || 'Clinic Triage Staff',
          instructions_note: res.agent.instructions_note || '',
        });
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
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      const payload = {
        name: form.name,
        greeting: form.greeting,
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

      const res = await apiRequest('/api/clinic/ai-agent', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      setAgent(res.agent);
      setSavedSuccess(true);
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

      {/* Voice Architecture Status & Tool Guarantees */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-1">
            Engine & Architecture
          </span>
          <div className="text-sm font-bold text-[#0A0A0A] flex items-center gap-1.5">
            <Bot className="w-4 h-4 text-[#0A2540]" />
            <span>
              Platform Standard Model
            </span>
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

      {/* Sarvam AI Voice Test Section */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#0A2540]">
          AI Receptionist — Voice Test
        </h2>
        <SarvamVoiceWidget />
      </div>

      {/* Configuration Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <Card
          title="Receptionist Identity & Voice Configuration"
          subtitle="Define how the AI answers incoming patient phone calls"
          action={
            canConfigure && (
              <Button
                variant="primary"
                size="sm"
                type="submit"
                loading={saving}
                icon={savedSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              >
                {savedSuccess ? 'Changes Saved' : 'Save Configuration'}
              </Button>
            )
          }
        >
          <div className="space-y-4 text-xs">
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

            {/* Greeting Script */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                Standard Call Greeting Script *
              </label>
              <textarea
                rows={3}
                required
                disabled={!canConfigure}
                value={form.greeting}
                onChange={(e) => setForm({ ...form, greeting: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded focus:border-[#0A2540] text-xs focus:outline-none leading-relaxed"
                placeholder="Thank you for calling our clinic. How can I assist you with your appointment today?"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                The AI Receptionist speaks this exact sentence immediately when the call connects.
              </p>
            </div>

            {/* Clinic-Specific Instructions */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                Clinic Directives & Knowledge Notes
              </label>
              <textarea
                rows={3}
                disabled={!canConfigure}
                value={form.instructions_note}
                onChange={(e) => setForm({ ...form, instructions_note: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded focus:border-[#0A2540] text-xs focus:outline-none leading-relaxed"
                placeholder="e.g. Clinic parking is available in the rear lot. Fasting is required for lipid profile labs."
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Special notes injected into your AI receptionist. Doctors, services, fees, and schedules are automatically queried from your clinic database.
              </p>
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
