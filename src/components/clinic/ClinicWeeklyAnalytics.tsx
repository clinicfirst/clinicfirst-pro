import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  PhoneCall,
  Calendar,
  Sparkles,
  Bot,
  Clock,
  CheckCircle2,
  AlertCircle,
  Activity,
  Filter,
  BarChart3,
  Layers,
  Zap,
} from 'lucide-react';
import { WeeklyAnalytics } from '../../types';

interface ClinicWeeklyAnalyticsProps {
  analytics?: WeeklyAnalytics;
  onNavigateToTab?: (tab: string) => void;
}

export const ClinicWeeklyAnalytics: React.FC<ClinicWeeklyAnalyticsProps> = ({
  analytics,
  onNavigateToTab,
}) => {
  const [activeMetricView, setActiveMetricView] = useState<'combined' | 'appointments' | 'calls'>(
    'combined'
  );
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');

  if (!analytics || !analytics.trends || analytics.trends.length === 0) {
    return null;
  }

  const { trends, summary, callOutcomeDistribution, appointmentByDoctor } = analytics;

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0]?.payload;
      return (
        <div className="bg-white/95 backdrop-blur-md border border-[#E2E8F0] p-3 rounded-xl shadow-xl text-xs space-y-2 min-w-[200px]">
          <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-1.5 font-bold text-[#172B3A]">
            <span>{dataPoint.displayDate} ({dataPoint.day})</span>
            <span className="font-mono text-[10px] text-[#64748B]">{dataPoint.date}</span>
          </div>

          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-3 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: entry.color || entry.stroke || entry.fill }}
                  />
                  <span className="text-[#64748B]">{entry.name}:</span>
                </div>
                <span className="font-mono font-bold text-[#172B3A]">{entry.value}</span>
              </div>
            ))}
          </div>

          {dataPoint.avgCallDurationSeconds && (
            <div className="pt-1.5 border-t border-[#F1F5F9] flex items-center justify-between text-[10px] text-[#0F4C5C]">
              <span>Avg Call Duration:</span>
              <span className="font-mono font-semibold">{dataPoint.avgCallDurationSeconds}s</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 shadow-xs space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#F1F5F9]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0F4C5C]/10 text-[#0F4C5C] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#172B3A] tracking-tight">
                Weekly Practice Analytics & AI Reception Volume
              </h2>
              <p className="text-xs text-[#64748B]">
                7-day rolling performance: patient appointments, incoming AI triage, and conversion rates
              </p>
            </div>
          </div>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Metric Selector */}
          <div className="flex items-center p-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setActiveMetricView('combined')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeMetricView === 'combined'
                  ? 'bg-white text-[#0F4C5C] shadow-xs border border-[#E2E8F0]'
                  : 'text-[#64748B] hover:text-[#172B3A]'
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveMetricView('appointments')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeMetricView === 'appointments'
                  ? 'bg-white text-[#0F4C5C] shadow-xs border border-[#E2E8F0]'
                  : 'text-[#64748B] hover:text-[#172B3A]'
              }`}
            >
              Appointments
            </button>
            <button
              type="button"
              onClick={() => setActiveMetricView('calls')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeMetricView === 'calls'
                  ? 'bg-white text-[#0F4C5C] shadow-xs border border-[#E2E8F0]'
                  : 'text-[#64748B] hover:text-[#172B3A]'
              }`}
            >
              AI Calls
            </button>
          </div>

          {/* Chart Shape Toggle */}
          <div className="hidden md:flex items-center p-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setChartType('area')}
              title="Area Trend"
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                chartType === 'area'
                  ? 'bg-white text-[#0F4C5C] shadow-xs border border-[#E2E8F0]'
                  : 'text-[#64748B] hover:text-[#172B3A]'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setChartType('bar')}
              title="Bar Chart"
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                chartType === 'bar'
                  ? 'bg-white text-[#0F4C5C] shadow-xs border border-[#E2E8F0]'
                  : 'text-[#64748B] hover:text-[#172B3A]'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 4 Weekly Executive Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Weekly Appointments */}
        <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#64748B]">
            <span>Weekly Appointments</span>
            <Calendar className="w-3.5 h-3.5 text-[#0F4C5C]" />
          </div>
          <div className="text-xl font-extrabold text-[#172B3A] font-mono">
            {summary.totalAppointments}
          </div>
          <div className="text-[10px] text-slate-700 font-semibold flex items-center gap-1">
            <span>+{summary.appointmentGrowthPercent}% vs last week</span>
          </div>
        </div>

        {/* AI Inbound Calls */}
        <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#64748B]">
            <span>AI Phone Calls</span>
            <PhoneCall className="w-3.5 h-3.5 text-[#0F4C5C]" />
          </div>
          <div className="text-xl font-extrabold text-[#172B3A] font-mono">
            {summary.totalCalls}
          </div>
          <div className="text-[10px] text-slate-700 font-semibold flex items-center gap-1">
            <span>+{summary.callGrowthPercent}% call volume</span>
          </div>
        </div>

        {/* Autonomous Resolution Rate */}
        <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#64748B]">
            <span>AI Resolution Rate</span>
            <Bot className="w-3.5 h-3.5 text-[#0F4C5C]" />
          </div>
          <div className="text-xl font-extrabold text-[#0F4C5C] font-mono">
            {summary.aiAutonomousResolutionRate}%
          </div>
          <div className="text-[10px] text-[#64748B] font-medium">
            Autonomous call completion
          </div>
        </div>

        {/* Avg Duration & Peak Hour */}
        <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#64748B]">
            <span>Avg Handling Time</span>
            <Clock className="w-3.5 h-3.5 text-slate-600" />
          </div>
          <div className="text-xl font-extrabold text-[#172B3A] font-mono">
            {summary.avgCallHandlingSeconds}s
          </div>
          <div className="text-[10px] text-[#64748B] font-medium truncate">
            Peak: {summary.peakCallHour}
          </div>
        </div>
      </div>

      {/* Main Interactive Recharts Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Columns: Weekly Trend Line / Area / Bar Chart */}
        <div className="lg:col-span-8 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#475569]">
              {activeMetricView === 'combined' && 'Appointment Volume vs AI Phone Calls'}
              {activeMetricView === 'appointments' && 'Appointment Source: AI Receptionist vs Front Desk'}
              {activeMetricView === 'calls' && 'Daily AI Phone Calls & Appointment Bookings'}
            </h3>
            <span className="text-[11px] font-mono text-[#64748B]">7-Day Window</span>
          </div>

          <div className="h-[280px] sm:h-[320px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'area' ? (
                <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAppointments" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0F4C5C" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#0F4C5C" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#334155" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#334155" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorAiApts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#64748B" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#64748B" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis
                    dataKey="displayDate"
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}
                  />

                  {activeMetricView === 'combined' && (
                    <>
                      <Area
                        type="monotone"
                        dataKey="totalAppointments"
                        name="Total Appointments"
                        stroke="#0F4C5C"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorAppointments)"
                      />
                      <Area
                        type="monotone"
                        dataKey="totalCalls"
                        name="AI Inbound Calls"
                        stroke="#334155"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorCalls)"
                      />
                      <Line
                        type="monotone"
                        dataKey="aiCallsBooked"
                        name="Appointments Booked via AI"
                        stroke="#E11D48"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </>
                  )}

                  {activeMetricView === 'appointments' && (
                    <>
                      <Area
                        type="monotone"
                        dataKey="aiBookedAppointments"
                        name="AI Receptionist Bookings"
                        stroke="#0F4C5C"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorAppointments)"
                      />
                      <Area
                        type="monotone"
                        dataKey="staffBookedAppointments"
                        name="Front Desk / Staff Bookings"
                        stroke="#64748B"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorAiApts)"
                      />
                      <Line
                        type="monotone"
                        dataKey="confirmedAppointments"
                        name="Confirmed Patient Appointments"
                        stroke="#0F4C5C"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </>
                  )}

                  {activeMetricView === 'calls' && (
                    <>
                      <Area
                        type="monotone"
                        dataKey="totalCalls"
                        name="Total AI Calls"
                        stroke="#334155"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorCalls)"
                      />
                      <Area
                        type="monotone"
                        dataKey="aiCallsResolved"
                        name="Autonomous AI Resolutions"
                        stroke="#0F4C5C"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorAppointments)"
                      />
                      <Line
                        type="monotone"
                        dataKey="escalatedCalls"
                        name="Human Staff Escalations"
                        stroke="#E11D48"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </>
                  )}
                </AreaChart>
              ) : (
                <BarChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis
                    dataKey="displayDate"
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}
                  />

                  {activeMetricView === 'combined' && (
                    <>
                      <Bar dataKey="totalAppointments" name="Total Appointments" fill="#0F4C5C" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="totalCalls" name="AI Inbound Calls" fill="#334155" radius={[4, 4, 0, 0]} />
                    </>
                  )}

                  {activeMetricView === 'appointments' && (
                    <>
                      <Bar dataKey="aiBookedAppointments" name="AI Booked" fill="#0F4C5C" radius={[4, 4, 0, 0]} stackId="a" />
                      <Bar dataKey="staffBookedAppointments" name="Staff Booked" fill="#94A3B8" radius={[4, 4, 0, 0]} stackId="a" />
                    </>
                  )}

                  {activeMetricView === 'calls' && (
                    <>
                      <Bar dataKey="aiCallsResolved" name="Resolved by AI" fill="#0F4C5C" radius={[4, 4, 0, 0]} stackId="c" />
                      <Bar dataKey="escalatedCalls" name="Escalated" fill="#E11D48" radius={[4, 4, 0, 0]} stackId="c" />
                    </>
                  )}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right 4 Columns: AI Call Outcomes Breakdown Donut & Doctor Caseload */}
        <div className="lg:col-span-4 space-y-4">
          {/* Call Outcome Distribution */}
          <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#475569]">
                AI Call Outcome Breakdown
              </h4>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white border border-[#E2E8F0] text-[#0F4C5C]">
                {summary.totalCalls} Calls
              </span>
            </div>

            {/* Donut Chart or Zero State */}
            {summary.totalCalls > 0 && callOutcomeDistribution.length > 0 ? (
              <>
                <div className="h-[140px] w-full flex items-center justify-center relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={callOutcomeDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={42}
                        outerRadius={62}
                        paddingAngle={3}
                        dataKey="count"
                      >
                        {callOutcomeDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any, name: any, item: any) => [
                          `${value} calls (${item.payload.percentage}%)`,
                          item.payload.label,
                        ]}
                        contentStyle={{
                          backgroundColor: '#FFFFFF',
                          borderColor: '#E2E8F0',
                          borderRadius: '8px',
                          fontSize: '11px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xs font-extrabold text-[#0F4C5C] font-mono">
                      {summary.aiBookingConversionRate}%
                    </span>
                    <span className="text-[9px] text-[#64748B] font-semibold">Booked</span>
                  </div>
                </div>

                {/* Mini Legend List */}
                <div className="space-y-1.5 pt-1">
                  {callOutcomeDistribution.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-[#475569] truncate">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 font-mono">
                        <span className="font-bold text-[#172B3A]">{item.count}</span>
                        <span className="text-[10px] text-[#64748B]">({item.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-6 px-3 text-center space-y-2">
                <div className="w-9 h-9 rounded-full bg-[#E2E8F0]/60 text-[#64748B] flex items-center justify-center mx-auto">
                  <PhoneCall className="w-4 h-4" />
                </div>
                <div className="text-xs font-medium text-[#64748B]">
                  No AI calls recorded yet
                </div>
                <p className="text-[10px] text-[#94A3B8]">
                  Incoming phone calls handled by Ava will appear here in real time.
                </p>
              </div>
            )}
          </div>

          {/* Doctor Caseload Snapshot */}
          {appointmentByDoctor && appointmentByDoctor.length > 0 && (
            <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#475569]">
                  Physician Caseload This Week
                </h4>
                {onNavigateToTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateToTab('doctors')}
                    className="text-[10px] font-bold text-[#0F4C5C] hover:underline cursor-pointer"
                  >
                    View Doctors →
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {appointmentByDoctor.map((doc, idx) => {
                  const maxApts = Math.max(...appointmentByDoctor.map((d) => d.appointments), 1);
                  const pct = Math.round((doc.appointments / maxApts) * 100);
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-[#172B3A] truncate">{doc.doctorName}</span>
                        <span className="font-mono text-xs font-bold text-[#0F4C5C]">
                          {doc.appointments} apts
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#0F4C5C] rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
