import { showToast } from '../../components/common/Toast';
import React, { useState, useEffect } from 'react';
import {
  Clock,
  Plus,
  Trash2,
  Calendar,
  Check,
  Save,
  AlertCircle,
  ShieldAlert,
  Info,
  CalendarCheck,
  ChevronRight,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { apiRequest } from '../../api';
import { Doctor, DoctorSchedule, DoctorLeave } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { can } from '../../lib/permissions';

const DAYS = [
  { index: 1, name: 'Monday' },
  { index: 2, name: 'Tuesday' },
  { index: 3, name: 'Wednesday' },
  { index: 4, name: 'Thursday' },
  { index: 5, name: 'Friday' },
  { index: 6, name: 'Saturday' },
  { index: 0, name: 'Sunday' },
];

// Helper to get formatted ISO date "YYYY-MM-DD"
function toISODateString(d: Date): string {
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const SchedulesPage: React.FC = () => {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [leaves, setLeaves] = useState<DoctorLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Inspector Selected Day (default to today)
  const [inspectedDate, setInspectedDate] = useState<string>(toISODateString(new Date()));
  const [inspectedSlots, setInspectedSlots] = useState<
    Array<{ time: string; endTime: string; doctorId: string; doctorName: string }>
  >([]);
  const [loadingInspectorSlots, setLoadingInspectorSlots] = useState(false);
  const [inspectorInfo, setInspectorInfo] = useState<{
    available: boolean;
    on_leave?: boolean;
    leave_reason?: string;
    reason?: string;
  } | null>(null);

  // Leave Modal
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    start_date: toISODateString(new Date()),
    end_date: toISODateString(new Date()),
    reason: 'Medical Conference / Scheduled Leave',
  });
  const [leaveSaving, setLeaveSaving] = useState(false);

  // Local Day Schedule Edits
  const [dayConfigs, setDayConfigs] = useState<{
    [day: number]: {
      enabled: boolean;
      start_time: string;
      end_time: string;
      break_start: string;
      break_end: string;
      buffer_minutes: number;
    };
  }>({});

  const todayStr = toISODateString(new Date());

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ doctors: Doctor[] }>('/api/clinic/doctors');
      setDoctors(res.doctors);
      if (res.doctors.length > 0 && !selectedDoctorId) {
        setSelectedDoctorId(res.doctors[0].id);
      }
    } catch (err) {
      console.error('Failed to load doctors:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedulesAndLeaves = async (docId: string) => {
    if (!docId) return;
    try {
      const res = await apiRequest<{ schedules: DoctorSchedule[]; leaves: DoctorLeave[] }>(
        `/api/clinic/schedules?doctor_id=${docId}`
      );
      setSchedules(res.schedules);
      setLeaves(res.leaves);

      // Populate dayConfigs
      const map: any = {};
      const hasAnySchedule = res.schedules.length > 0;
      
      DAYS.forEach((d) => {
        const found = res.schedules.find((s) => s.day_of_week === d.index);
        if (found) {
          map[d.index] = {
            enabled: true,
            start_time: found.start_time,
            end_time: found.end_time,
            break_start: found.break_start || '13:00',
            break_end: found.break_end || '14:00',
            buffer_minutes: found.buffer_minutes || 5,
          };
        } else {
          map[d.index] = {
            enabled: hasAnySchedule ? false : (d.index >= 1 && d.index <= 5), // default mon-fri enabled only if no schedules exist at all
            start_time: '09:00',
            end_time: '17:00',
            break_start: '13:00',
            break_end: '14:00',
            buffer_minutes: 5,
          };
        }
      });
      setDayConfigs(map);
    } catch (err) {
      console.error('Failed to load schedules for doctor:', err);
    }
  };

  const fetchInspectedDateSlots = async (docId: string, date: string) => {
    if (!docId || !date) return;
    try {
      setLoadingInspectorSlots(true);
      const res = await apiRequest<{
        available: boolean;
        on_leave?: boolean;
        leave_reason?: string;
        reason?: string;
        slots: Array<{ time: string; endTime: string; doctorId: string; doctorName: string }>;
      }>(`/api/clinic/available-slots?doctorId=${docId}&date=${date}`);
      setInspectedSlots(res.slots || []);
      setInspectorInfo(res);
    } catch (err) {
      console.warn('Failed to load inspected date slots:', err);
      setInspectedSlots([]);
    } finally {
      setLoadingInspectorSlots(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  useEffect(() => {
    if (selectedDoctorId) {
      fetchSchedulesAndLeaves(selectedDoctorId);
      fetchInspectedDateSlots(selectedDoctorId, inspectedDate);
    }
  }, [selectedDoctorId]);

  useEffect(() => {
    if (selectedDoctorId && inspectedDate) {
      fetchInspectedDateSlots(selectedDoctorId, inspectedDate);
    }
  }, [inspectedDate]);

  const handleSaveSchedules = async () => {
    if (!selectedDoctorId) return;
    setSavingSchedule(true);
    setSaveSuccess(false);

    try {
      for (const day of DAYS) {
        const conf = dayConfigs[day.index];
        if (conf && conf.enabled) {
          await apiRequest('/api/clinic/schedules', {
            method: 'POST',
            body: JSON.stringify({
              doctor_id: selectedDoctorId,
              day_of_week: day.index,
              start_time: conf.start_time,
              end_time: conf.end_time,
              break_start: conf.break_start,
              break_end: conf.break_end,
              buffer_minutes: conf.buffer_minutes,
            }),
          });
        } else {
          // If the day is disabled, we must explicitly delete it to prevent fallback logic
          await apiRequest(`/api/clinic/schedules?doctor_id=${selectedDoctorId}&day_of_week=${day.index}`, {
            method: 'DELETE',
          }).catch(e => { /* Ignore 404s if it didn't exist */ });
        }
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      fetchSchedulesAndLeaves(selectedDoctorId);
      fetchInspectedDateSlots(selectedDoctorId, inspectedDate);
    } catch (err: any) {
      showToast(err.message || 'Failed to save schedules', 'error');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId) return;
    setLeaveSaving(true);

    try {
      await apiRequest('/api/clinic/leaves', {
        method: 'POST',
        body: JSON.stringify({
          doctor_id: selectedDoctorId,
          ...leaveForm,
        }),
      });

      setLeaveModalOpen(false);
      fetchSchedulesAndLeaves(selectedDoctorId);
      fetchInspectedDateSlots(selectedDoctorId, inspectedDate);
    } catch (err: any) {
      showToast(err.message || 'Failed to record leave', 'error');
    } finally {
      setLeaveSaving(false);
    }
  };

  const handleDeleteLeave = async (leaveId: string) => {
    try {
      await apiRequest(`/api/clinic/leaves/${leaveId}`, {
        method: 'DELETE',
      });
      fetchSchedulesAndLeaves(selectedDoctorId);
      fetchInspectedDateSlots(selectedDoctorId, inspectedDate);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete leave', 'error');
    }
  };

  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId);
  const canManage = can(user, 'manage_schedules');

  // Check if doctor is currently on leave today or has active/upcoming leaves
  const activeLeaveToday = leaves.find(
    (l) => todayStr >= l.start_date && todayStr <= l.end_date
  );

  const upcomingLeaves = leaves.filter((l) => l.end_date >= todayStr);

  // Compute dates for the current week (Monday to Sunday)
  const currentWeekDays = (() => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 is Sun, 1 is Mon...
    const distanceToMon = (currentDay + 6) % 7; // distance from Monday
    const monday = new Date(now);
    monday.setDate(now.getDate() - distanceToMon);

    return DAYS.map((d) => {
      const dayOffset = d.index === 0 ? 6 : d.index - 1; // 0=Sun is 6 days after Mon
      const date = new Date(monday);
      date.setDate(monday.getDate() + dayOffset);
      const dateStr = toISODateString(date);
      const matchingLeave = leaves.find((l) => dateStr >= l.start_date && dateStr <= l.end_date);
      return {
        dayIndex: d.index,
        dayName: d.name,
        dateStr,
        dateFormatted: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        matchingLeave,
      };
    });
  })();

  // 14-Day Calendar Generator for Real-Time Inspector
  const next14Days = (() => {
    const daysArr: Array<{
      dateStr: string;
      dayOfWeek: number;
      dayName: string;
      displayLabel: string;
      isToday: boolean;
      matchingLeave?: DoctorLeave;
      isWorkingDay: boolean;
    }> = [];

    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const dateStr = toISODateString(d);
      const dayOfWeek = d.getDay();
      const dayName = DAYS.find((item) => item.index === dayOfWeek)?.name || 'Day';
      const matchingLeave = leaves.find((l) => dateStr >= l.start_date && dateStr <= l.end_date);
      const isWorkingDay = schedules.some((s) => s.day_of_week === dayOfWeek);

      let displayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      if (i === 0) displayLabel = `Today (${displayLabel})`;
      else if (i === 1) displayLabel = `Tomorrow (${displayLabel})`;

      daysArr.push({
        dateStr,
        dayOfWeek,
        dayName,
        displayLabel,
        isToday: i === 0,
        matchingLeave,
        isWorkingDay,
      });
    }
    return daysArr;
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-[#0A0A0A] tracking-tight">Physician Working Schedules & Leaves</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure weekly duty shifts, lunch breaks, and scheduled leaves. Leave dates automatically override and block booking availability.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-gray-700 whitespace-nowrap">Select Doctor:</label>
          <div className="w-64">
            <select
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded focus:border-[#0A2540] bg-white text-[#0A0A0A]"
            >
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.specialization})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ACTIVE LEAVE STATUS BANNER (If physician currently has active leave) */}
      {activeLeaveToday && (
        <div className="p-4 bg-red-50/90 border-2 border-red-300 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-red-900 shadow-sm">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-red-950 uppercase tracking-wider text-[11px] bg-red-200 px-2 py-0.5 rounded">
                  Currently On Scheduled Leave
                </span>
                <span className="font-mono font-bold text-red-900">
                  {activeLeaveToday.start_date} → {activeLeaveToday.end_date}
                </span>
              </div>
              <p className="mt-1 text-red-800 text-xs font-medium">
                Reason: <span className="font-semibold">{activeLeaveToday.reason}</span>. All appointment slots for {selectedDoctor?.name || 'this doctor'} are currently <span className="font-bold underline">blocked</span> across the AI Receptionist and online scheduling engine.
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={() => setInspectedDate(todayStr)}
              className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-900 font-semibold rounded border border-red-300 text-xs transition-colors cursor-pointer"
            >
              Inspect Today's Slots
            </button>
          </div>
        </div>
      )}

      {/* UPCOMING LEAVE NOTIFICATION BANNER (If physician has upcoming leaves) */}
      {!activeLeaveToday && upcomingLeaves.length > 0 && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3 text-xs text-amber-900">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-bold text-amber-950">
              Upcoming Leave Scheduled for {selectedDoctor?.name}:
            </div>
            <div className="text-amber-800 mt-0.5">
              {upcomingLeaves.map((l) => (
                <span key={l.id} className="mr-4 inline-block">
                  • <strong className="font-mono">{l.start_date} to {l.end_date}</strong>: {l.reason}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Weekly Shifts Configuration */}
        <div className="lg:col-span-8 space-y-4">
          <Card
            title="Weekly Shifts & Shift Templates"
            subtitle="Recurring weekly duty intervals. When a doctor takes leave, dates falling on these shifts are automatically blocked."
            action={
              canManage && (
                <Button
                  variant="primary"
                  size="sm"
                  loading={savingSchedule}
                  icon={saveSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                  onClick={handleSaveSchedules}
                >
                  {saveSuccess ? 'Saved Successfully' : 'Save Weekly Schedule'}
                </Button>
              )
            }
          >
            <div className="space-y-3 divide-y divide-gray-100">
              {DAYS.map((day) => {
                const conf = dayConfigs[day.index] || {
                  enabled: false,
                  start_time: '09:00',
                  end_time: '17:00',
                  break_start: '13:00',
                  break_end: '14:00',
                  buffer_minutes: 5,
                };

                const currentWeekInfo = currentWeekDays.find((d) => d.dayIndex === day.index);
                const hasLeaveThisWeek = currentWeekInfo?.matchingLeave;

                return (
                  <div
                    key={day.index}
                    className={`pt-3 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs p-2 rounded transition-colors ${
                      hasLeaveThisWeek ? 'bg-red-50/50 border border-red-200' : ''
                    }`}
                  >
                    <div className="w-48">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={conf.enabled}
                          disabled={!canManage}
                          onChange={(e) => {
                            setDayConfigs({
                              ...dayConfigs,
                              [day.index]: { ...conf, enabled: e.target.checked },
                            });
                          }}
                          className="rounded border-gray-300 text-[#0A2540] focus:ring-[#0A2540]"
                        />
                        <span className={`font-semibold ${conf.enabled ? 'text-[#0A0A0A]' : 'text-gray-400'}`}>
                          {day.name}
                        </span>
                        {currentWeekInfo && (
                          <span className="text-[10px] text-gray-400 font-mono">
                            ({currentWeekInfo.dateFormatted})
                          </span>
                        )}
                      </div>

                      {/* Leave Status Indicator for this weekday in current week */}
                      {hasLeaveThisWeek && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded w-fit">
                          <AlertCircle className="w-3 h-3 text-red-600 shrink-0" />
                          <span>BLOCKED BY LEAVE THIS WEEK ({hasLeaveThisWeek.reason})</span>
                        </div>
                      )}
                    </div>

                    {conf.enabled ? (
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Working Hours */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-500 font-semibold uppercase">Hours:</span>
                          <input
                            type="time"
                            value={conf.start_time}
                            disabled={!canManage}
                            onChange={(e) =>
                              setDayConfigs({
                                ...dayConfigs,
                                [day.index]: { ...conf, start_time: e.target.value },
                              })
                            }
                            className="px-1.5 py-1 text-xs border border-gray-300 rounded font-mono bg-white text-[#0A0A0A]"
                          />
                          <span className="text-gray-400">to</span>
                          <input
                            type="time"
                            value={conf.end_time}
                            disabled={!canManage}
                            onChange={(e) =>
                              setDayConfigs({
                                ...dayConfigs,
                                [day.index]: { ...conf, end_time: e.target.value },
                              })
                            }
                            className="px-1.5 py-1 text-xs border border-gray-300 rounded font-mono bg-white text-[#0A0A0A]"
                          />
                        </div>

                        {/* Lunch Break */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-500 font-semibold uppercase">Break:</span>
                          <input
                            type="time"
                            value={conf.break_start}
                            disabled={!canManage}
                            onChange={(e) =>
                              setDayConfigs({
                                ...dayConfigs,
                                [day.index]: { ...conf, break_start: e.target.value },
                              })
                            }
                            className="px-1.5 py-1 text-xs border border-gray-300 rounded font-mono bg-white text-[#0A0A0A]"
                          />
                          <span className="text-gray-400">-</span>
                          <input
                            type="time"
                            value={conf.break_end}
                            disabled={!canManage}
                            onChange={(e) =>
                              setDayConfigs({
                                ...dayConfigs,
                                [day.index]: { ...conf, break_end: e.target.value },
                              })
                            }
                            className="px-1.5 py-1 text-xs border border-gray-300 rounded font-mono bg-white text-[#0A0A0A]"
                          />
                        </div>

                        {/* Buffer */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-500 font-semibold uppercase">Buffer:</span>
                          <input
                            type="number"
                            min={0}
                            max={30}
                            value={conf.buffer_minutes}
                            disabled={!canManage}
                            onChange={(e) =>
                              setDayConfigs({
                                ...dayConfigs,
                                [day.index]: { ...conf, buffer_minutes: Number(e.target.value) },
                              })
                            }
                            className="w-12 px-1.5 py-1 text-xs border border-gray-300 rounded font-mono bg-white text-[#0A0A0A]"
                          />
                          <span className="text-[10px] text-gray-400">min</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Off Duty / Not Scheduled</span>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Doctor Leaves Management */}
        <div className="lg:col-span-4 space-y-4">
          <Card
            title="Scheduled Leaves"
            subtitle="Blocks booking slots automatically on selected dates"
            action={
              canManage && (
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => setLeaveModalOpen(true)}
                >
                  Add Leave
                </Button>
              )
            }
          >
            {leaves.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center border border-dashed border-gray-200 rounded">
                No active leaves logged for this doctor.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {leaves.map((leave) => {
                  const isCurrent = todayStr >= leave.start_date && todayStr <= leave.end_date;
                  const isPast = leave.end_date < todayStr;
                  const isUpcoming = leave.start_date > todayStr;

                  return (
                    <div
                      key={leave.id}
                      className={`p-3 border rounded text-xs space-y-1 transition-all ${
                        isCurrent
                          ? 'bg-red-50 border-red-300'
                          : isUpcoming
                          ? 'bg-amber-50/60 border-amber-200'
                          : 'bg-gray-50/50 border-gray-200 opacity-75'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-[#0A0A0A]">
                            {leave.start_date} → {leave.end_date}
                          </span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-red-600 text-white rounded uppercase">
                              Active Today
                            </span>
                          )}
                          {isUpcoming && (
                            <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-amber-200 text-amber-900 rounded uppercase">
                              Upcoming
                            </span>
                          )}
                          {isPast && (
                            <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-gray-200 text-gray-600 rounded uppercase">
                              Past
                            </span>
                          )}
                        </div>

                        {canManage && (
                          <button
                            onClick={() => handleDeleteLeave(leave.id)}
                            className="text-gray-400 hover:text-red-600 p-1 cursor-pointer"
                            title="Delete Leave"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="text-gray-700 text-[11px] font-medium">{leave.reason}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* LIVE 14-DAY AVAILABILITY & LEAVE INSPECTION PANEL */}
      <Card
        title="Live 14-Day Availability & Leave Inspection"
        subtitle="Authoritative real-time consultation slot calculation for the selected doctor. Click any date to verify availability or see leave blocking in action."
      >
        <div className="space-y-4">
          {/* Day Cards Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {next14Days.map((day) => {
              const isSelected = inspectedDate === day.dateStr;
              const isOnLeave = Boolean(day.matchingLeave);

              return (
                <button
                  key={day.dateStr}
                  onClick={() => setInspectedDate(day.dateStr)}
                  type="button"
                  className={`p-2.5 rounded border text-left flex flex-col justify-between min-h-[76px] transition-all cursor-pointer ${
                    isSelected
                      ? 'ring-2 ring-[#0A2540] border-[#0A2540] bg-[#0A2540]/5'
                      : isOnLeave
                      ? 'bg-red-50/70 border-red-200 hover:bg-red-100/50'
                      : !day.isWorkingDay
                      ? 'bg-gray-50 border-gray-200 opacity-60 hover:opacity-100'
                      : 'bg-white border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#0A0A0A]">{day.dayName.slice(0, 3)}</span>
                      {day.isToday && (
                        <span className="text-[9px] font-bold bg-[#0A2540] text-white px-1 rounded uppercase">
                          Today
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-gray-500 mt-0.5">{day.dateStr.slice(5)}</div>
                  </div>

                  <div className="mt-2">
                    {isOnLeave ? (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-red-700 bg-red-100 px-1 py-0.5 rounded w-full justify-center">
                        ON LEAVE
                      </span>
                    ) : !day.isWorkingDay ? (
                      <span className="inline-block text-[9px] font-semibold text-gray-400 bg-gray-100 px-1 py-0.5 rounded w-full text-center">
                        Off Duty
                      </span>
                    ) : (
                      <span className="inline-block text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1 py-0.5 rounded w-full text-center">
                        Available
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detailed Selected Date Breakdown */}
          <div className="p-4 bg-gray-50/80 border border-gray-200 rounded-lg text-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#0A2540]" />
                <span className="font-bold text-[#0A0A0A]">
                  Availability Breakdown for {selectedDoctor?.name} on {inspectedDate}:
                </span>
              </div>
              <div className="flex items-center gap-2">
                {loadingInspectorSlots && (
                  <span className="text-[11px] text-gray-500 flex items-center gap-1 font-mono">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Calculating...
                  </span>
                )}
                {inspectorInfo?.on_leave ? (
                  <span className="px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded text-[11px] flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                    Doctor On Leave (0 Slots)
                  </span>
                ) : inspectedSlots.length > 0 ? (
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[11px]">
                    {inspectedSlots.length} Bookable Slots Open
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-gray-200 text-gray-700 font-semibold rounded text-[11px]">
                    No Slots Open
                  </span>
                )}
              </div>
            </div>

            {inspectorInfo?.on_leave ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-900 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Doctor is on Leave on this Date</div>
                  <p className="text-[11px] text-red-800 mt-0.5">
                    {inspectorInfo.reason ||
                      `Dr. ${selectedDoctor?.name} is on scheduled leave (${inspectorInfo.leave_reason}). Availability is blocked and no patient bookings can be made.`}
                  </p>
                </div>
              </div>
            ) : inspectedSlots.length === 0 ? (
              <p className="text-gray-500 py-3 text-center italic">
                {inspectorInfo?.reason || 'No consultation slots available on this date (Clinic closed, doctor off-duty, or fully booked).'}
              </p>
            ) : (
              <div>
                <div className="text-[11px] font-semibold text-gray-600 mb-2">
                  Generated Consultation Intervals (Validated against clinic hours, shifts, breaks, buffers & double-booking):
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-36 overflow-y-auto">
                  {inspectedSlots.map((slot, i) => (
                    <div
                      key={i}
                      className="px-2 py-1 bg-white border border-gray-300 rounded text-center font-mono font-semibold text-[11px] text-[#0A0A0A] shadow-xs"
                    >
                      {slot.time}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* ADD LEAVE MODAL */}
      <Modal
        isOpen={leaveModalOpen}
        onClose={() => setLeaveModalOpen(false)}
        title="Schedule Doctor Leave"
        subtitle="Slots during this date range will be automatically blocked from the AI Receptionist and online calendar."
        maxWidth="md"
      >
        <form onSubmit={handleCreateLeave} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Start Date *"
              type="date"
              required
              value={leaveForm.start_date}
              onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
            />

            <Input
              label="End Date *"
              type="date"
              required
              value={leaveForm.end_date}
              onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
            />
          </div>

          <Input
            label="Reason / Note *"
            required
            value={leaveForm.reason}
            onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
            placeholder="e.g. Annual Medical Leave, Conference Attendance"
          />

          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
            <Button variant="secondary" size="md" onClick={() => setLeaveModalOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" size="md" type="submit" loading={leaveSaving}>
              Confirm Doctor Leave
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
