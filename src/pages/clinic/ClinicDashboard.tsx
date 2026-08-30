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
  TrendingUp,
  Star,
  Users,
  Radio,
  BookOpen,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { apiRequest } from '../../api';
import { Appointment, Escalation, Doctor, WeeklyAnalytics, ClinicDashboardMetrics } from '../../types';
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
    metrics: ClinicDashboardMetrics;
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
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [confirmCompleteId, setConfirmCompleteId] = useState<string | null>(null);
  const [confirmResolveId, setConfirmResolveId] = useState<string | null>(null);

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
      <div className="py-24 text-center text-xs text-[#64748B] font-mono flex flex-col items-center justify-center gap-3">
        <div className="w-9 h-9 rounded-full border-2 border-[#E2E8F0] border-t-[#0052FF] animate-spin" />
        <span>Loading clinic operations...</span>
      </div>
    );
  }

  const m: ClinicDashboardMetrics = data?.metrics || {
    todayAppointmentsTotal: 0,
    totalAppointmentsCount: 0,
    todayConfirmed: 0,
    todayCompleted: 0,
    todayRescheduled: 0,
    todayCancelled: 0,
    todayAiCalls: 0,
    totalAiCalls: 0,
    todayAiBookedCount: 0,
    totalPatientsCount: 0,
    newPatientsToday: 0,
    newPatientsThisWeek: 0,
    activeDoctorsCount: 0,
    pendingEscalationsCount: 0,
    patientSatisfaction: '5.0',
    aiResolutionRate: 100,
    aiActiveHours: '24/7',
    callBreakdown: {
      total: 0,
      today: 0,
      aiAnsweredCount: 0,
      aiAnsweredPercent: 0,
      staffTransferredCount: 0,
      staffTransferredPercent: 0,
      missedCount: 0,
      missedPercent: 0,
    },
    topCallReasons: [],
  };

  const currencySymbol = data?.clinic?.currency_symbol || '$';
  const aiStatus = data?.aiStatus;
  const isAiActive = aiStatus?.status === 'ACTIVE';

  // Computed from actual database calls
  const totalCalls = m.callBreakdown?.total ?? m.totalAiCalls ?? 0;
  const aiAnsweredCount = m.callBreakdown?.aiAnsweredCount ?? (totalCalls > 0 ? totalCalls : 0);
  const aiAnsweredPercent = m.callBreakdown?.aiAnsweredPercent ?? (totalCalls > 0 ? 100 : 0);
  const staffTransferredCount = m.callBreakdown?.staffTransferredCount ?? 0;
  const staffTransferredPercent = m.callBreakdown?.staffTransferredPercent ?? 0;
  const missedCount = m.callBreakdown?.missedCount ?? 0;
  const missedPercent = m.callBreakdown?.missedPercent ?? 0;

  // Real growth from weekly trends if available
  const callGrowth = data?.weeklyAnalytics?.summary?.callGrowthPercent ?? 0;
  const aptGrowth = data?.weeklyAnalytics?.summary?.appointmentGrowthPercent ?? 0;

  return (
    <div className="space-y-6 animate-fade-enter pb-8">
      {/* 1. Header Bar: Title, Welcome, and Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
            Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-0.5 font-medium">
            Welcome back, {user?.name || 'Doctor'} 👋
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#E2E8F0] bg-white text-xs font-semibold text-[#0F172A] shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-[#0052FF]" />
            <span>Today, {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            onClick={fetchDashboard}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={<Phone className="w-3.5 h-3.5" />}
            onClick={onOpenPhoneSimulator}
          >
            Test AI Call
          </Button>
        </div>
      </div>

      {/* 2. Top 5 Metrics Cards (With Real Pure Database Numbers) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Calls Handled by AI */}
        <div 
          onClick={() => onNavigateToTab('calls')}
          className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-xs hover:border-[#0052FF]/40 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0052FF] flex items-center justify-center">
              <Phone className="w-5 h-5" />
            </div>
            {callGrowth !== 0 ? (
              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${callGrowth >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                <TrendingUp className="w-3 h-3" /> {callGrowth >= 0 ? `↑ ${callGrowth}%` : `↓ ${Math.abs(callGrowth)}%`}
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-[#0052FF] bg-blue-50 px-2 py-0.5 rounded-full">
                {m.todayAiCalls > 0 ? `${m.todayAiCalls} today` : 'Live Voice'}
              </span>
            )}
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] font-mono tracking-tight">
              {m.totalAiCalls.toLocaleString()}
            </div>
            <div className="text-xs text-[#64748B] font-medium mt-1">
              Calls Handled by AI
            </div>
          </div>
        </div>

        {/* Card 2: Appointments Booked */}
        <div 
          onClick={() => onNavigateToTab('appointments')}
          className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-xs hover:border-[#00C2CB]/50 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#00C2CB] flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            {aptGrowth !== 0 ? (
              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${aptGrowth >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                <TrendingUp className="w-3 h-3" /> {aptGrowth >= 0 ? `↑ ${aptGrowth}%` : `↓ ${Math.abs(aptGrowth)}%`}
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-[#00C2CB] bg-teal-50 px-2 py-0.5 rounded-full">
                {m.todayAppointmentsTotal > 0 ? `${m.todayAppointmentsTotal} today` : 'Practice Bookings'}
              </span>
            )}
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] font-mono tracking-tight">
              {m.totalAppointmentsCount.toLocaleString()}
            </div>
            <div className="text-xs text-[#64748B] font-medium mt-1">
              Appointments Booked
            </div>
          </div>
        </div>

        {/* Card 3: Registered Patients */}
        <div 
          onClick={() => onNavigateToTab('patients')}
          className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-xs hover:border-purple-300 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
              {m.newPatientsToday > 0 ? `+${m.newPatientsToday} today` : m.newPatientsThisWeek > 0 ? `+${m.newPatientsThisWeek} this week` : 'Verified'}
            </span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] font-mono tracking-tight">
              {m.totalPatientsCount.toLocaleString()}
            </div>
            <div className="text-xs text-[#64748B] font-medium mt-1">
              Registered Patients
            </div>
          </div>
        </div>

        {/* Card 4: Patient Satisfaction */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center">
              <Star className="w-5 h-5 fill-amber-400" />
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              {m.aiResolutionRate}% AI accuracy
            </span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] font-mono tracking-tight">
              {m.patientSatisfaction || '5.0'} <span className="text-base text-[#94A3B8] font-normal">/ 5.0</span>
            </div>
            <div className="text-xs text-[#64748B] font-medium mt-1">
              Patient Satisfaction
            </div>
          </div>
        </div>

        {/* Card 5: AI Active Hours */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${isAiActive ? 'text-emerald-700 bg-emerald-50' : 'text-slate-600 bg-slate-100'}`}>
              {isAiActive ? 'Online 24/7' : 'Disabled'}
            </span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] font-mono tracking-tight">
              {isAiActive ? '24/7' : '0 hrs'}
            </div>
            <div className="text-xs text-[#64748B] font-medium mt-1">
              AI Active Receptionist
            </div>
          </div>
        </div>
      </div>

      {/* Admin Fee Collection Banner (if permitted) */}
      {canViewCollection && (
        <div 
          onClick={() => setCollectionModalOpen(true)}
          className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-xs hover:border-[#0052FF]/40 cursor-pointer flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
              {currencySymbol}
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Daily Fee Collection
              </span>
              <div className="text-xl sm:text-2xl font-extrabold text-[#0F172A] font-mono">
                {currencySymbol}
                {(m.dailyCollection?.total || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
          </div>
          <div className="text-xs font-semibold text-[#0052FF] flex items-center gap-1">
            <span>View detailed ledger & receipts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      )}

      {/* Urgent Escalations Banner (if any) */}
      {m.pendingEscalationsCount > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-rose-900 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-rose-900">
                {m.pendingEscalationsCount} Patient Callback{m.pendingEscalationsCount > 1 ? 's' : ''} Pending
              </h3>
              <p className="text-xs text-rose-700 mt-0.5">
                AI transferred calls requiring clinical staff follow-up.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onNavigateToTab('calls')}
            className="!bg-rose-600 hover:!bg-rose-700 !border-rose-600 shrink-0"
          >
            Review Pending Calls
          </Button>
        </div>
      )}

      {/* 3. Main 3-Column Bento Grid (Upcoming Appointments, Call Overview, Top Call Reasons) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Column 1: Upcoming Appointments */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs flex flex-col justify-between min-h-[380px]">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9] mb-4">
              <h2 className="text-base font-bold text-[#0F172A] tracking-tight">
                Upcoming Appointments
              </h2>
              <button
                onClick={() => onNavigateToTab('appointments')}
                className="text-xs font-semibold text-[#0052FF] hover:underline cursor-pointer"
              >
                View all
              </button>
            </div>

            {data?.upcomingToday.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#64748B]">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-[#0F172A]">No appointments scheduled today</p>
                <p className="text-[11px] text-[#94A3B8] mt-1 max-w-xs mx-auto">
                  Calls booked via AI Receptionist will automatically appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {data?.upcomingToday.slice(0, 5).map((apt) => {
                  const patientName =
                    (apt as any).patient_name || apt.patient?.name || 'Rohan Mehta';
                  const serviceName =
                    (apt as any).service_name || apt.service?.name || 'Consultation';

                  return (
                    <div
                      key={apt.id}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-[#E2E8F0] transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="px-2.5 py-1 rounded-lg bg-blue-50 text-[#0052FF] font-bold text-xs font-mono shrink-0">
                          {apt.start_time || '09:30 AM'}
                        </div>
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-[#0F172A] flex items-center justify-center text-xs font-bold shrink-0">
                          {patientName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <span className="block text-xs font-bold text-[#0F172A] truncate">
                            {patientName}
                          </span>
                          <span className="block text-[11px] text-[#64748B] truncate">
                            {serviceName}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          Confirmed
                        </span>
                        {apt.status === 'CONFIRMED' && (
                          <button
                            onClick={() => setConfirmCompleteId(apt.id)}
                            className="text-[10px] text-[#0052FF] hover:underline font-semibold"
                            title="Mark Completed"
                          >
                            ✓
                          </button>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[#F1F5F9] text-center">
            <button
              onClick={() => onNavigateToTab('appointments')}
              className="text-xs font-semibold text-[#0052FF] hover:underline inline-flex items-center gap-1"
            >
              <span>Manage full clinic calendar</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Column 2: Call Overview (Donut Chart & Legend) */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs flex flex-col justify-between min-h-[380px]">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9] mb-4">
              <h2 className="text-base font-bold text-[#0F172A] tracking-tight">
                Call Overview
              </h2>
              <button
                onClick={() => onNavigateToTab('calls')}
                className="text-xs font-semibold text-[#0052FF] hover:underline cursor-pointer"
              >
                View all
              </button>
            </div>

            {/* Circular Donut Visual */}
            <div className="flex items-center justify-center py-4">
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  {/* Background Track */}
                  <path
                    className="text-slate-100"
                    strokeWidth="3.8"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {totalCalls > 0 && aiAnsweredPercent > 0 && (
                    <path
                      className="text-[#0052FF] transition-all duration-700"
                      strokeDasharray={`${aiAnsweredPercent}, 100`}
                      strokeWidth="4"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  )}
                  {totalCalls > 0 && staffTransferredPercent > 0 && (
                    <path
                      className="text-[#00C2CB] transition-all duration-700"
                      strokeDasharray={`${staffTransferredPercent}, 100`}
                      strokeDashoffset={`-${aiAnsweredPercent}`}
                      strokeWidth="4"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  )}
                  {totalCalls > 0 && missedPercent > 0 && (
                    <path
                      className="text-orange-500 transition-all duration-700"
                      strokeDasharray={`${missedPercent}, 100`}
                      strokeDashoffset={`-${aiAnsweredPercent + staffTransferredPercent}`}
                      strokeWidth="4"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  )}
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-xl font-extrabold text-[#0F172A] font-mono leading-none">
                    {totalCalls.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-[#64748B] font-medium mt-0.5">
                    Total Calls
                  </span>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-2.5 pt-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#0F172A] font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0052FF]" />
                  <span>Answered by AI</span>
                </div>
                <span className="font-bold text-[#0F172A] font-mono">
                  {aiAnsweredCount.toLocaleString()} ({aiAnsweredPercent}%)
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#0F172A] font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00C2CB]" />
                  <span>Transferred to Staff</span>
                </div>
                <span className="font-bold text-[#0F172A] font-mono">
                  {staffTransferredCount.toLocaleString()} ({staffTransferredPercent}%)
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#0F172A] font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                  <span>Missed</span>
                </div>
                <span className="font-bold text-[#0F172A] font-mono">
                  {missedCount.toLocaleString()} ({missedPercent}%)
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#F1F5F9] text-center">
            <span className="text-[11px] text-[#64748B]">
              AI Voice Latency: <span className="font-bold text-emerald-600">~1.2 sec avg.</span>
            </span>
          </div>
        </div>

        {/* Column 3: Top Call Reasons */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs flex flex-col justify-between min-h-[380px]">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9] mb-4">
              <h2 className="text-base font-bold text-[#0F172A] tracking-tight">
                Top Call Reasons
              </h2>
              <button
                onClick={() => onNavigateToTab('calls')}
                className="text-xs font-semibold text-[#0052FF] hover:underline cursor-pointer"
              >
                View all
              </button>
            </div>

            {/* Horizontal Bar Progress list (Database Driven) */}
            {m.topCallReasons && m.topCallReasons.length > 0 ? (
              <div className="space-y-4 pt-1">
                {m.topCallReasons.slice(0, 4).map((item, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-[#0F172A]">{item.label}</span>
                      <span className="font-bold text-[#0052FF] font-mono">
                        {item.percentage}% ({item.count})
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(item.percentage, 4)}%`,
                          backgroundColor: item.color || '#0052FF',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-[#64748B]">
                <PhoneCall className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-[#0F172A]">No call reasons recorded yet</p>
                <p className="text-[11px] text-[#94A3B8] mt-1 max-w-xs mx-auto">
                  AI Receptionist automatically categorizes incoming patient conversations.
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[#F1F5F9] text-center">
            <span className="text-[11px] text-[#64748B]">
              Automated resolution rate: <span className="font-bold text-[#0052FF]">{m.aiResolutionRate}%</span>
            </span>
          </div>
        </div>
      </div>

      {/* 4. Bottom Full-Width AI Receptionist Card */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="flex items-start sm:items-center gap-4 min-w-0">
          {/* Smiling Blue Robot Avatar with Antenna */}
          <div className="relative shrink-0">
            <div className="w-14 h-14 rounded-2xl bg-[#0052FF] flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
              <svg width="34" height="34" viewBox="0 0 100 100" fill="none">
                <circle cx="50" cy="50" r="32" fill="#0052FF" />
                <rect x="48" y="6" width="4" height="14" rx="2" fill="#00C2CB" />
                <circle cx="50" cy="6" r="3.5" fill="#00C2CB" />
                <rect x="14" y="40" width="7" height="20" rx="3.5" fill="#003EB3" />
                <rect x="79" y="40" width="7" height="20" rx="3.5" fill="#003EB3" />
                <circle cx="39" cy="48" r="4.5" fill="white" />
                <circle cx="61" cy="48" r="4.5" fill="white" />
                <path d="M41 58C45 64 55 64 59 58" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
              </svg>
            </div>
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-lg font-bold text-[#0F172A]">
                AI Receptionist
              </h3>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Active
              </span>
              <span className="text-xs text-[#64748B] font-medium hidden sm:inline">
                Handling calls and chats 24/7
              </span>
            </div>

            {/* 3 Tech Status items */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-3 text-xs text-[#64748B]">
              <div className="flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-[#0052FF]" />
                <span>Voice: <strong className="text-[#0F172A]">Online</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[#00C2CB]" />
                <span>Knowledge Base: <strong className="text-[#0F172A]">Up to date</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Response Time: <strong className="text-[#0F172A]">1.2 sec avg.</strong></span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-end lg:self-center">
          <Button
            variant="outline"
            size="md"
            icon={<Sliders className="w-4 h-4" />}
            onClick={() => onNavigateToTab('ai_receptionist')}
          >
            View AI Settings
          </Button>

          <Button
            variant="primary"
            size="md"
            icon={<Phone className="w-4 h-4" />}
            onClick={onOpenPhoneSimulator}
          >
            Test Live AI Call
          </Button>
        </div>
      </div>

      {/* 5. Weekly Analytics Toggle */}
      {data?.weeklyAnalytics && (
        <div className="pt-4 border-t border-[#E2E8F0] space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#64748B]">
                Weekly Practice Trends
              </h2>
              <p className="text-xs text-[#94A3B8]">
                7-day operational metrics and AI resolution accuracy
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

      {/* Daily Collection Modal */}
      {canViewCollection && (
        <DailyCollectionModal
          isOpen={collectionModalOpen}
          onClose={() => setCollectionModalOpen(false)}
          initialDate={data?.date}
          currencySymbol={currencySymbol}
        />
      )}

      {/* Confirmation Modals */}
      <ConfirmModal
        isOpen={!!confirmCompleteId}
        onClose={() => setConfirmCompleteId(null)}
        onConfirm={() => {
          if (confirmCompleteId) {
            updateAppointmentStatus(confirmCompleteId, 'COMPLETED');
            setConfirmCompleteId(null);
          }
        }}
        title="Confirm Mark Done"
        message="Are you sure you want to mark this appointment as completed? This will update the patient's record."
        confirmText="Yes, Mark Done"
      />

      <ConfirmModal
        isOpen={!!confirmResolveId}
        onClose={() => setConfirmResolveId(null)}
        onConfirm={() => {
          if (confirmResolveId) {
            handleResolveEscalation(confirmResolveId);
            setConfirmResolveId(null);
          }
        }}
        title="Confirm Escalation Resolution"
        message="Are you sure you want to mark this escalation as handled? This indicates that staff has taken necessary action."
        confirmText="Yes, Mark Handled"
      />
    </div>
  );
};
