import { showToast } from '../../components/common/Toast';
import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  PhoneCall,
  Bot,
  AlertCircle,
  CheckCircle2,
  Stethoscope,
  ArrowRight,
  Phone,
  RefreshCw,
  Sliders,
  ChevronDown,
  ChevronUp,
  User,
  DollarSign,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { apiRequest } from '../../api';
import { Appointment, Escalation, Doctor, WeeklyAnalytics } from '../../types';
import { ClinicWeeklyAnalytics } from '../../components/clinic/ClinicWeeklyAnalytics';
import { DailyCollectionModal } from '../../components/clinic/DailyCollectionModal';
import { useAuth } from '../../context/AuthContext';
import { can } from '../../lib/permissions';

interface ClinicDashboardProps {
  onNavigateToTab: (tab: any) => void;
  onOpenPhoneSimulator: () => void;
}

export const ClinicDashboard: React.FC<ClinicDashboardProps> = ({
  onNavigateToTab,
  onOpenPhoneSimulator,
}) => {
  const { user } = useAuth();
  const canViewCollection = can(user, 'view_daily_collection');

  const [data, setData] = useState<{
    clinic: any;
    date: string;
    metrics: {
      todayAppointmentsTotal: number;
      todayConfirmed: number;
      todayCompleted: number;
      todayRescheduled: number;
      todayCancelled: number;
      todayAiCalls: number;
      todayAiBookedCount: number;
      activeDoctorsCount: number;
      pendingEscalationsCount: number;
      dailyCollection?: {
        total: number;
        confirmedCompletedTotal: number;
        currency_symbol: string;
        currency: string;
        billedAppointmentsCount: number;
      };
    };
    upcomingToday: Appointment[];
    pendingEscalations: Escalation[];
    aiStatus: {
      name: string;
      status: string;
      provider: string;
      model?: string;
      phoneStatus?: string;
      isReady?: boolean;
      apiKeyConfigured?: boolean;
    };
    activeDoctors: Doctor[];
    weeklyAnalytics?: WeeklyAnalytics;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/api/clinic/dashboard');
      setData(res);
    } catch (err) {
      console.error('Failed to load clinic dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleResolveEscalation = async (escalationId: string) => {
    try {
      setResolvingId(escalationId);
      await apiRequest(`/api/clinic/escalations/${escalationId}/resolve`, {
        method: 'PUT',
      });
      fetchDashboard();
      showToast('Escalation marked as resolved', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to resolve escalation', 'error');
    } finally {
      setResolvingId(null);
    }
  };

  const updateAppointmentStatus = async (appointmentId: string, status: string) => {
    try {
      await apiRequest(`/api/clinic/appointments/${appointmentId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      fetchDashboard();
      showToast(`Appointment marked as ${status.toLowerCase()}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update appointment', 'error');
    }
  };

  if (!data && loading) {
    return (
      <div className="py-20 text-center text-xs text-[#64748B] font-mono flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[#E2E8F0] border-t-[#0F4C5C] animate-spin" />
        <span>Loading clinic operations...</span>
      </div>
    );
  }

  const m = data?.metrics || {
    todayAppointmentsTotal: 0,
    todayConfirmed: 0,
    todayCompleted: 0,
    todayRescheduled: 0,
    todayCancelled: 0,
    todayAiCalls: 0,
    todayAiBookedCount: 0,
    activeDoctorsCount: 0,
    pendingEscalationsCount: 0,
  };

  const currencySymbol = data?.clinic?.currency_symbol || '$';
  const aiStatus = data?.aiStatus;
  const isAiActive = aiStatus?.status === 'ACTIVE';

  return (
    <div className="space-y-6 animate-fade-enter">
      {/* 1. Header: Today's Clinic Operations */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-[#172B3A] tracking-tight">
              Today's Clinic Operations
            </h1>
            <span className="text-xs px-2.5 py-0.5 bg-slate-100 border border-slate-200 rounded-md font-mono font-semibold text-[#0F4C5C]">
              {data?.date || new Date().toISOString().split('T')[0]}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
            What is happening today and what needs your attention.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            onClick={fetchDashboard}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* 2. KPI Cards (With Daily Fee Collection for Clinic Admin / Platform Admin) */}
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 ${
          canViewCollection ? 'lg:grid-cols-3 xl:grid-cols-5' : 'lg:grid-cols-4'
        } gap-4`}
      >
        {/* Daily Collection of Fees (Admin Exclusive - Hidden from Staff) */}
        {canViewCollection && (
          <div
            id="daily-collection-card"
            onClick={() => setCollectionModalOpen(true)}
            className="p-5 bg-white border border-[#E2E8F0] rounded-xl cursor-pointer hover:shadow-md hover:border-[#0F4C5C]/50 transition-all duration-200 group relative overflow-hidden flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#64748B] group-hover:text-[#0F4C5C] transition-colors">
                  Daily Fee Collection
                </span>
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-[#0F4C5C] flex items-center justify-center group-hover:bg-[#0F4C5C] group-hover:text-white transition-all font-bold text-sm">
                  {currencySymbol}
                </div>
              </div>
              <div className="text-3xl font-extrabold text-[#172B3A] font-mono tracking-tight flex items-baseline gap-0.5">
                <span className="text-xl font-bold text-[#0F4C5C]">{currencySymbol}</span>
                {(m.dailyCollection?.total || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
            <div className="text-xs text-[#64748B] mt-3 pt-2 border-t border-slate-100 flex items-center justify-between font-medium">
              <span>
                {m.dailyCollection?.billedAppointmentsCount || 0} service
                {(m.dailyCollection?.billedAppointmentsCount || 0) === 1 ? '' : 's'} billed
              </span>
              <span className="text-[11px] text-[#0F4C5C] font-semibold flex items-center gap-0.5 group-hover:underline">
                View Details <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        )}

        {/* Appointments */}
        <div
          onClick={() => onNavigateToTab('appointments')}
          className="p-5 bg-white border border-[#E2E8F0] rounded-xl cursor-pointer hover:shadow-md hover:border-[#0F4C5C]/40 transition-all duration-200 group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#64748B] group-hover:text-[#0F4C5C] transition-colors">
                Today's Appointments
              </span>
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-[#0F4C5C] flex items-center justify-center group-hover:bg-[#0F4C5C] group-hover:text-white transition-all">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-[#172B3A] font-mono tracking-tight">
              {m.todayAppointmentsTotal}
            </div>
          </div>
          <div className="text-xs text-[#64748B] mt-3 pt-2 border-t border-slate-100 flex items-center gap-1.5 font-medium">
            {m.todayAppointmentsTotal === 0 ? (
              <span>No appointments scheduled</span>
            ) : (
              <>
                <span className="text-[#0F4C5C] font-semibold">{m.todayConfirmed} confirmed</span>
                <span className="text-[#CBD5E1]">•</span>
                <span className="text-slate-700 font-semibold">{m.todayCompleted} completed</span>
              </>
            )}
          </div>
        </div>

        {/* AI Calls */}
        <div
          onClick={() => onNavigateToTab('calls')}
          className="p-5 bg-white border border-[#E2E8F0] rounded-xl cursor-pointer hover:shadow-md hover:border-[#0F4C5C]/40 transition-all duration-200 group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#64748B] group-hover:text-[#0F4C5C] transition-colors">
                AI Handled Calls
              </span>
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-[#0F4C5C] flex items-center justify-center group-hover:bg-[#0F4C5C] group-hover:text-white transition-all">
                <PhoneCall className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-[#172B3A] font-mono tracking-tight">
              {m.todayAiCalls}
            </div>
          </div>
          <div className="text-xs text-[#64748B] mt-3 pt-2 border-t border-slate-100 font-medium">
            {m.todayAiCalls === 0 ? (
              <span>Ready for inbound calls</span>
            ) : (
              <span className="text-[#0F4C5C] font-semibold">
                {m.todayAiBookedCount} booked automatically
              </span>
            )}
          </div>
        </div>

        {/* Doctors Available */}
        <div
          onClick={() => onNavigateToTab('doctors')}
          className="p-5 bg-white border border-[#E2E8F0] rounded-xl cursor-pointer hover:shadow-md hover:border-[#0F4C5C]/40 transition-all duration-200 group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#64748B] group-hover:text-[#0F4C5C] transition-colors">
                Doctors Available
              </span>
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-[#0F4C5C] flex items-center justify-center group-hover:bg-[#0F4C5C] group-hover:text-white transition-all">
                <Stethoscope className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-[#172B3A] font-mono tracking-tight">
              {m.activeDoctorsCount}
            </div>
          </div>
          <div className="text-xs text-[#64748B] mt-3 pt-2 border-t border-slate-100 font-medium">
            {m.activeDoctorsCount === 0
              ? 'No active doctors on duty'
              : 'Active doctors on duty today'}
          </div>
        </div>

        {/* Pending Actions */}
        <div
          onClick={() => onNavigateToTab('calls')}
          className={`p-5 bg-white border rounded-xl cursor-pointer hover:shadow-md transition-all duration-200 group flex flex-col justify-between ${
            m.pendingEscalationsCount > 0
              ? 'border-rose-300 ring-1 ring-rose-300/40 bg-rose-50/10'
              : 'border-[#E2E8F0]'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#64748B] group-hover:text-[#0F4C5C] transition-colors">
                Pending Actions
              </span>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                  m.pendingEscalationsCount > 0
                    ? 'bg-rose-100 text-rose-700 group-hover:bg-rose-600 group-hover:text-white'
                    : 'bg-slate-100 text-[#0F4C5C] group-hover:bg-[#0F4C5C] group-hover:text-white'
                }`}
              >
                {m.pendingEscalationsCount > 0 ? (
                  <AlertCircle className="w-4 h-4" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
              </div>
            </div>
            <div className="text-3xl font-extrabold text-[#172B3A] font-mono tracking-tight">
              {m.pendingEscalationsCount}
            </div>
          </div>
          <div
            className={`text-xs mt-3 pt-2 border-t border-slate-100 font-semibold ${
              m.pendingEscalationsCount > 0 ? 'text-rose-600' : 'text-slate-600'
            }`}
          >
            {m.pendingEscalationsCount > 0
              ? 'Staff callback required'
              : 'All patient calls resolved'}
          </div>
        </div>
      </div>

      {/* 3. AI Receptionist Card */}
      <div className="p-5 bg-white border border-[#E2E8F0] rounded-xl flex flex-col md:flex-row md:items-center md:justify-between gap-5 shadow-xs hover:border-[#0F4C5C]/30 transition-all">
        <div className="flex items-start sm:items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-[#0F4C5C] text-white flex items-center justify-center shrink-0 shadow-xs relative">
            <Bot className="w-6 h-6" />
            {isAiActive && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#0F4C5C] border-2 border-white rounded-full" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-bold text-[#172B3A]">
                {aiStatus?.name || 'Ava'}
              </span>
              <span className="text-xs text-[#64748B] font-medium">AI Receptionist</span>

              {isAiActive ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0F4C5C]/10 text-[#0F4C5C] border border-[#0F4C5C]/20">
                  <span className="w-2 h-2 rounded-full bg-[#0F4C5C]" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  Not Ready
                </span>
              )}
            </div>

            <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
              Answers patient calls, checks availability, books appointments and escalates when human help is needed.
            </p>

            {/* AI Technical Status Details */}
            <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-slate-100 text-[11px] text-[#64748B] font-mono">
              <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                Provider: <span className="font-semibold text-[#172B3A]">{aiStatus?.provider || 'Gemini'}</span>
              </span>
              <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                Model: <span className="font-semibold text-[#172B3A]">{aiStatus?.model || 'Gemini 2.5 Flash'}</span>
              </span>
              <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                Phone: <span className="font-semibold text-[#172B3A]">{aiStatus?.phoneStatus || 'Connected'}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
          <Button
            variant="primary"
            size="sm"
            icon={<Phone className="w-3.5 h-3.5" />}
            onClick={onOpenPhoneSimulator}
          >
            Test Call
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Sliders className="w-3.5 h-3.5 text-[#64748B]" />}
            onClick={() => onNavigateToTab('ai_receptionist')}
          >
            Configure
          </Button>
        </div>
      </div>

      {/* 4. Side-by-Side: Today's Appointments & Pending Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Today's Appointments */}
        <Card
          title="Today's Appointments"
          subtitle="Patient queue and appointment status tracking"
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigateToTab('appointments')}
              icon={<ArrowRight className="w-3.5 h-3.5 text-[#0F4C5C]" />}
            >
              View Full Schedule
            </Button>
          }
        >
          {data?.upcomingToday.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#64748B]">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-[#172B3A]">No appointments scheduled today</p>
              <p className="text-[11px] text-[#94A3B8] mt-1 max-w-xs mx-auto">
                Inbound patient calls confirmed by the AI Receptionist will automatically appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#F1F5F9]">
              {data?.upcomingToday.map((apt) => {
                const patientName =
                  (apt as any).patient_name ||
                  apt.patient?.name ||
                  'Patient';
                const patientPhone =
                  (apt as any).patient_phone ||
                  apt.patient?.phone ||
                  '';
                const doctorName =
                  (apt as any).doctor_name ||
                  apt.doctor?.name ||
                  'Doctor';
                const serviceName =
                  (apt as any).service_name ||
                  apt.service?.name ||
                  'Consultation';

                return (
                  <div
                    key={apt.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 hover:bg-slate-50/80 px-2 rounded-lg transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Time Slot Box */}
                      <div className="text-center font-mono px-2.5 py-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs shrink-0 group-hover:border-[#0F4C5C]/30 transition-colors">
                        <div className="font-bold text-[#0F4C5C] text-xs">{apt.start_time}</div>
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-xs text-[#172B3A] truncate">
                            {patientName}
                          </span>
                          {patientPhone && (
                            <span className="text-[10px] font-mono text-[#64748B] bg-slate-100 px-1.5 py-0.2 rounded">
                              {patientPhone}
                            </span>
                          )}
                          <Badge status={apt.status} />
                          {apt.created_via === 'ai_receptionist' && (
                            <Badge status="AI_RECEPTIONIST" label="AI Booked" />
                          )}
                        </div>

                        <div className="text-[11px] text-[#64748B] flex flex-wrap items-center gap-1">
                          <span className="font-medium text-[#172B3A]">{doctorName}</span>
                          <span className="text-[#CBD5E1]">•</span>
                          <span>{serviceName}</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Complete Action */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {apt.status === 'CONFIRMED' && (
                        <button
                          onClick={() => updateAppointmentStatus(apt.id, 'COMPLETED')}
                          className="px-2.5 py-1 text-[11px] bg-white border border-[#0F4C5C] hover:bg-[#0F4C5C] hover:text-white text-[#0F4C5C] font-semibold rounded-md transition-all cursor-pointer shadow-xs active:scale-95"
                        >
                          Mark Done
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Right Column: Pending Actions & Urgent Escalations */}
        <Card
          title="Pending Actions"
          subtitle="Patients requiring staff callback or assistance"
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigateToTab('calls')}
              icon={<ArrowRight className="w-3.5 h-3.5 text-[#0F4C5C]" />}
            >
              View All Calls
            </Button>
          }
        >
          {data?.pendingEscalations.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#64748B]">
              <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-[#172B3A]">No pending actions</p>
              <p className="text-[11px] text-[#94A3B8] mt-1 max-w-xs mx-auto">
                All patient calls resolved. No staff callbacks required.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data?.pendingEscalations.map((esc) => (
                <div
                  key={esc.id}
                  className="p-3.5 bg-white border border-rose-200 rounded-xl text-xs space-y-2 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span className="font-bold text-rose-700 font-mono text-[11px]">
                        STAFF CALLBACK REQUIRED
                      </span>
                    </div>
                    <span className="text-[10px] text-[#64748B] font-mono">
                      {new Date(esc.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="text-[#172B3A] font-semibold text-xs">{esc.reason}</div>

                  {esc.context_summary && (
                    <p className="text-[11px] text-[#64748B] bg-slate-50 p-2 rounded border border-slate-200 leading-relaxed">
                      {esc.context_summary}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-[11px] font-mono text-[#172B3A]">
                      Caller: <span className="font-bold">{esc.caller_phone || 'Direct Patient'}</span>
                    </span>

                    <Button
                      variant="primary"
                      size="sm"
                      loading={resolvingId === esc.id}
                      onClick={() => handleResolveEscalation(esc.id)}
                    >
                      Mark Handled
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* 5. Practice Analytics (Clean, Below the Fold with Toggle) */}
      {data?.weeklyAnalytics && (
        <div className="pt-4 border-t border-[#E2E8F0] space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#64748B]">
                Weekly Practice Analytics
              </h2>
              <p className="text-xs text-[#94A3B8]">
                7-day operational trends and AI resolution performance
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={showAnalytics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              onClick={() => setShowAnalytics(!showAnalytics)}
            >
              {showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
            </Button>
          </div>

          {showAnalytics && (
            <ClinicWeeklyAnalytics
              analytics={data.weeklyAnalytics}
              onNavigateToTab={onNavigateToTab}
            />
          )}
        </div>
      )}

      {/* 6. Daily Fee Collection Modal (Admin Exclusive) */}
      {canViewCollection && (
        <DailyCollectionModal
          isOpen={collectionModalOpen}
          onClose={() => setCollectionModalOpen(false)}
          initialDate={data?.date}
          currencySymbol={currencySymbol}
        />
      )}
    </div>
  );
};
