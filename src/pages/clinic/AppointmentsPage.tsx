import { showToast } from '../../components/common/Toast';
import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Search,
  Filter,
  User,
  Stethoscope,
  Bot,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { Input, Select } from '../../components/common/Input';
import { apiRequest } from '../../api';
import { Appointment, Doctor, Service, Patient } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { can } from '../../lib/permissions';

// ISO Week (Monday to Sunday)
const getCurrentWeekDates = () => {
  const now = new Date();
  const currentDay = now.getDay(); // 0 is Sun, 1 is Mon...
  const distanceToMon = (currentDay + 6) % 7; // distance from Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() - distanceToMon);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  };
};

const getTodayDate = () => new Date().toISOString().split('T')[0];

export const AppointmentsPage: React.FC = () => {
  const { user } = useAuth();
  const canManage = can(user, 'manage_appointments');

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters (Default: current week, Booked & Rescheduled, not Completed)
  const initialWeek = getCurrentWeekDates();
  const [startDate, setStartDate] = useState<string>(initialWeek.start);
  const [endDate, setEndDate] = useState<string>(initialWeek.end);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('booked_or_rescheduled');

  // Modals
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [confirmCompleteId, setConfirmCompleteId] = useState<string | null>(null);
  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);

  // Booking Form State
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientPhone, setNewPatientPhone] = useState('');
  const [bookPatientId, setBookPatientId] = useState('');
  const [bookDoctorId, setBookDoctorId] = useState('');
  const [bookServiceId, setBookServiceId] = useState('');
  const [bookDate, setBookDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookStartTime, setBookStartTime] = useState('');
  const [bookNotes, setBookNotes] = useState('');
  const [availableSlots, setAvailableSlots] = useState<
    Array<{ time: string; doctorId: string; doctorName: string }>
  >([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookSlotInfo, setBookSlotInfo] = useState<{
    available: boolean;
    on_leave?: boolean;
    leave_reason?: string;
    reason?: string;
  } | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Reschedule Form State
  const [rescheduleDate, setRescheduleDate] = useState(new Date().toISOString().split('T')[0]);
  const [rescheduleStartTime, setRescheduleStartTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState<
    Array<{ time: string; doctorId: string; doctorName: string }>
  >([]);
  const [rescheduleSlotInfo, setRescheduleSlotInfo] = useState<{
    available: boolean;
    on_leave?: boolean;
    leave_reason?: string;
    reason?: string;
  } | null>(null);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // Cancellation Form State
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        ...(selectedDoctorId !== 'all' ? { doctor_id: selectedDoctorId } : {}),
        ...(selectedStatus !== 'all' ? { status: selectedStatus } : {}),
      });

      const [aptsRes, docsRes, srvsRes, patsRes] = await Promise.all([
        apiRequest<{ appointments: Appointment[] }>(
          `/api/clinic/appointments?${queryParams.toString()}`
        ),
        apiRequest<{ doctors: Doctor[] }>('/api/clinic/doctors'),
        apiRequest<{ services: Service[] }>('/api/clinic/services'),
        apiRequest<{ patients: Patient[] }>('/api/clinic/patients'),
      ]);

      setAppointments(aptsRes.appointments);
      setDoctors(docsRes.doctors);
      setServices(srvsRes.services);
      setPatients(patsRes.patients);

      // Removed auto-set defaults to prevent invalid empty state when first item is inactive
      if (patsRes.patients.length > 0 && !bookPatientId) {
        setBookPatientId(patsRes.patients[0].id);
      }
    } catch (err) {
      console.error('Failed to load appointments data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, selectedDoctorId, selectedStatus]);

  // Query Available Slots when booking fields change
  useEffect(() => {
    if (!bookDate) return;
    const fetchSlots = async () => {
      try {
        setLoadingSlots(true);
        const queryParams = new URLSearchParams({
          date: bookDate,
          ...(bookDoctorId ? { doctorId: bookDoctorId } : {}),
          ...(bookServiceId ? { serviceId: bookServiceId } : {}),
        });
        const res = await apiRequest<{
          available: boolean;
          on_leave?: boolean;
          leave_reason?: string;
          reason?: string;
          slots: Array<{ time: string; doctorId: string; doctorName: string }>;
        }>(`/api/clinic/available-slots?${queryParams.toString()}`);
        setAvailableSlots(res.slots || []);
        setBookSlotInfo(res);
        if (res.slots && res.slots.length > 0) {
          setBookStartTime(res.slots[0].time);
        } else {
          setBookStartTime('');
        }
      } catch (err) {
        console.warn('Failed to calculate slots:', err);
      } finally {
        setLoadingSlots(false);
      }
    };
    fetchSlots();
  }, [bookDate, bookDoctorId, bookServiceId]);

  // Query Available Slots for Reschedule
  useEffect(() => {
    if (!activeAppointment || !rescheduleDate) return;
    const fetchSlots = async () => {
      try {
        setRescheduleLoading(true);
        const queryParams = new URLSearchParams({
          date: rescheduleDate,
          doctorId: activeAppointment.doctor_id,
          serviceId: activeAppointment.service_id,
        });
        const res = await apiRequest<{
          available: boolean;
          on_leave?: boolean;
          leave_reason?: string;
          reason?: string;
          slots: Array<{ time: string; doctorId: string; doctorName: string }>;
        }>(`/api/clinic/available-slots?${queryParams.toString()}`);
        setRescheduleSlots(res.slots || []);
        setRescheduleSlotInfo(res);
        if (res.slots && res.slots.length > 0) {
          setRescheduleStartTime(res.slots[0].time);
        } else {
          setRescheduleStartTime('');
        }
      } catch (err) {
        console.warn('Failed to calculate reschedule slots:', err);
      } finally {
        setRescheduleLoading(false);
      }
    };
    fetchSlots();
  }, [activeAppointment, rescheduleDate]);

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError(null);

    if (isNewPatient) {
      if (!newPatientName || !newPatientPhone) {
        setBookingError('Please enter the patient name and phone number.');
        return;
      }
    } else {
      if (!bookPatientId) {
        setBookingError('Please select a patient.');
        return;
      }
    }

    if (!bookDoctorId || !bookServiceId || !bookDate || !bookStartTime) {
      setBookingError('Please select doctor, service, date, and a valid slot time.');
      return;
    }

    setBookingLoading(true);
    try {
      let finalPatientId = bookPatientId;
      
      if (isNewPatient) {
        const newPatientRes = await apiRequest<{ patient: Patient }>('/api/clinic/patients', {
          method: 'POST',
          body: JSON.stringify({
            name: newPatientName,
            phone: newPatientPhone,
          }),
        });
        finalPatientId = newPatientRes.patient.id;
      }

      await apiRequest('/api/clinic/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: finalPatientId,
          doctor_id: bookDoctorId,
          service_id: bookServiceId,
          date: bookDate,
          start_time: bookStartTime,
          notes: bookNotes,
        }),
      });

      setBookModalOpen(false);
      setBookNotes('');
      if (isNewPatient) {
        setIsNewPatient(false);
        setNewPatientName('');
        setNewPatientPhone('');
      }
      fetchData();
    } catch (err: any) {
      setBookingError(err.message || 'Failed to book appointment');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleRescheduleAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAppointment) return;
    setRescheduleError(null);

    if (!rescheduleDate || !rescheduleStartTime) {
      setRescheduleError('Please select a valid date and available time slot.');
      return;
    }

    setRescheduleLoading(true);
    try {
      await apiRequest(`/api/clinic/appointments/${activeAppointment.id}/reschedule`, {
        method: 'POST',
        body: JSON.stringify({
          newDate: rescheduleDate,
          newStartTime: rescheduleStartTime,
          reason: rescheduleReason,
        }),
      });

      setRescheduleModalOpen(false);
      setActiveAppointment(null);
      setRescheduleReason('');
      fetchData();
    } catch (err: any) {
      setRescheduleError(err.message || 'Failed to reschedule appointment');
    } finally {
      setRescheduleLoading(false);
    }
  };

  const handleCancelAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAppointment) return;

    setCancelLoading(true);
    try {
      await apiRequest(`/api/clinic/appointments/${activeAppointment.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'CANCELLED',
          notes: `Cancelled by staff: ${cancelReason || 'Patient request'}`,
        }),
      });

      setCancelModalOpen(false);
      setActiveAppointment(null);
      setCancelReason('');
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Failed to cancel appointment', 'error');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleStatusChange = async (appointmentId: string, status: string) => {
    try {
      await apiRequest(`/api/clinic/appointments/${appointmentId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update appointment status', 'error');
    }
  };

  // Date Range Navigation Helpers
  const currentWeek = getCurrentWeekDates();
  const isCurrentWeekSelected = startDate === currentWeek.start && endDate === currentWeek.end;
  const todayStr = getTodayDate();
  const isTodaySelected = startDate === todayStr && endDate === todayStr;

  const shiftRange = (direction: number) => {
    const s = new Date(startDate);
    const e = new Date(endDate);
    const diffTime = Math.abs(e.getTime() - s.getTime());
    const diffDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);

    s.setDate(s.getDate() + direction * diffDays);
    e.setDate(e.getDate() + direction * diffDays);

    setStartDate(s.toISOString().split('T')[0]);
    setEndDate(e.toISOString().split('T')[0]);
  };

  const setCurrentWeek = () => {
    const cw = getCurrentWeekDates();
    setStartDate(cw.start);
    setEndDate(cw.end);
  };

  const setToday = () => {
    const t = getTodayDate();
    setStartDate(t);
    setEndDate(t);
  };

  // Safe client filtering & chronological sorting
  const displayedAppointments = appointments
    .filter((apt) => {
      if (selectedStatus === 'booked_or_rescheduled') {
        return (
          apt.status === 'CONFIRMED' ||
          apt.status === 'RESCHEDULED' ||
          apt.status === 'REQUESTED'
        );
      }
      if (selectedStatus !== 'all') {
        return apt.status === selectedStatus;
      }
      return true;
    })
    .filter((apt) => {
      if (selectedDoctorId !== 'all') {
        return apt.doctor_id === selectedDoctorId;
      }
      return true;
    })
    .filter((apt) => {
      if (startDate && apt.date < startDate) return false;
      if (endDate && apt.date > endDate) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return a.start_time.localeCompare(b.start_time);
    });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-[#0A0A0A] tracking-tight">Appointments Management</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Schedule, reschedule, cancel, and track consults across all clinic doctors.
          </p>
        </div>

        {canManage && (
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setBookModalOpen(true)}
          >
            Book New Appointment
          </Button>
        )}
      </div>

      {/* Date Navigation & Filters Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4 bg-white p-3.5 sm:p-4 border border-gray-200 rounded-lg">
        {/* Date Range Navigator */}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => shiftRange(-1)} title="Previous Period">
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                const val = e.target.value;
                setStartDate(val);
                if (val > endDate) setEndDate(val);
              }}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-mono font-semibold border border-gray-300 rounded focus:border-[#0A2540] focus:ring-1 focus:ring-[#0A2540] bg-white text-[#0A0A0A]"
              title="Start Date"
            />
            <span className="text-gray-400 text-xs font-medium px-0.5">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                const val = e.target.value;
                setEndDate(val);
                if (val < startDate) setStartDate(val);
              }}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-mono font-semibold border border-gray-300 rounded focus:border-[#0A2540] focus:ring-1 focus:ring-[#0A2540] bg-white text-[#0A0A0A]"
              title="End Date"
            />
          </div>

          <Button
            variant={isCurrentWeekSelected ? "primary" : "outline"}
            size="sm"
            onClick={setCurrentWeek}
          >
            This Week
          </Button>

          <Button
            variant={isTodaySelected ? "primary" : "outline"}
            size="sm"
            onClick={setToday}
          >
            Today
          </Button>

          <Button variant="secondary" size="sm" onClick={() => shiftRange(1)} title="Next Period">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Doctor & Status Filters */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="w-full sm:w-44">
            <select
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:border-[#0A2540] bg-white text-[#0A0A0A]"
            >
              <option value="all">All Doctors</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-48">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:border-[#0A2540] bg-white text-[#0A0A0A] font-medium"
            >
              <option value="booked_or_rescheduled">Booked & Rescheduled</option>
              <option value="all">All Statuses</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="RESCHEDULED">Rescheduled</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="NO_SHOW">No Show</option>
            </select>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={fetchData}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Appointments List / Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {displayedAppointments.length === 0 ? (
          <div className="py-16 text-center text-xs text-gray-400">
            <CalendarIcon className="w-8 h-8 mx-auto text-gray-300 mb-2" />
            {selectedStatus === 'booked_or_rescheduled'
              ? `No booked or rescheduled appointments found for ${
                  startDate === endDate ? startDate : `${startDate} to ${endDate}`
                }.`
              : `No appointments found for ${
                  startDate === endDate ? startDate : `${startDate} to ${endDate}`
                }.`}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/75 border-b border-gray-200 text-gray-700 uppercase font-semibold text-[11px] tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Date & Time Slot</th>
                  <th className="px-6 py-3.5">Patient</th>
                  <th className="px-6 py-3.5">Doctor & Service</th>
                  <th className="px-6 py-3.5">Channel</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-normal">
                {displayedAppointments.map((apt) => (
                  <tr key={apt.id} className="group hover:bg-[#F8FAFC] transition-colors duration-200">
                    {/* Date & Time Slot */}
                    <td className="px-6 py-4 font-mono">
                      <div className="text-[11px] font-semibold text-gray-700 mb-0.5">
                        {new Date(apt.date + 'T00:00:00').toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                      <div className="font-bold text-[#0A0A0A]">{apt.start_time}</div>
                      <div className="text-[10px] text-gray-400">to {apt.end_time}</div>
                    </td>

                    {/* Patient */}
                    <td className="px-6 py-4">
                      <div className="font-semibold text-[#0A0A0A]">{apt.patient?.name || 'Unknown Patient'}</div>
                      <div className="text-gray-500 font-mono text-[11px]">{apt.patient?.phone || ''}</div>
                    </td>

                    {/* Doctor & Service */}
                    <td className="px-6 py-4">
                      <div className="font-medium text-[#0A0A0A]">{apt.doctor?.name || 'Unknown Doctor'}</div>
                      <div className="text-gray-500 text-[11px]">{apt.service?.name || 'Unknown Service'}</div>
                    </td>

                    {/* Created Channel */}
                    <td className="px-6 py-4">
                      {apt.created_via === 'ai_receptionist' ? (
                        <Badge status="AI_RECEPTIONIST" label="AI Inbound" />
                      ) : (
                        <Badge status="STAFF" label="Staff Entry" />
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <Badge status={apt.status} />
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right space-x-1.5 whitespace-nowrap opacity-80 group-hover:opacity-100 transition-opacity duration-200">
                      {(apt.status === 'CONFIRMED' || apt.status === 'RESCHEDULED') && canManage && (
                        <>
                          <button
                            onClick={() => setConfirmCompleteId(apt.id)}
                            className="px-2 py-1 text-xs bg-white border border-[#0A2540] group hover:bg-[#F8FAFC] transition-colors duration-200 text-[#0A2540] font-semibold rounded cursor-pointer"
                          >
                            Complete
                          </button>

                          <button
                            onClick={() => {
                              setActiveAppointment(apt);
                              setRescheduleDate(apt.date);
                              setRescheduleModalOpen(true);
                            }}
                            className="px-2 py-1 text-xs bg-white border border-gray-300 hover:bg-gray-100 text-[#0A0A0A] rounded cursor-pointer"
                          >
                            Reschedule
                          </button>

                          <button
                            onClick={() => {
                              setActiveAppointment(apt);
                              setCancelModalOpen(true);
                            }}
                            className="px-2 py-1 text-xs bg-white border border-gray-300 hover:bg-gray-100 text-gray-600 rounded cursor-pointer"
                          >
                            Cancel
                          </button>
                        </>
                      )}

                      {(apt.status === 'CONFIRMED' || apt.status === 'RESCHEDULED') && !canManage && (
                        <span className="text-[11px] text-gray-400 font-mono">
                          {apt.status === 'CONFIRMED' ? 'Confirmed' : 'Rescheduled'}
                        </span>
                      )}

                      {apt.status !== 'CONFIRMED' && apt.status !== 'RESCHEDULED' && (
                        <span className="text-[11px] text-gray-400 font-mono italic">
                          {apt.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* BOOK APPOINTMENT MODAL */}
      <Modal
        isOpen={bookModalOpen}
        onClose={() => setBookModalOpen(false)}
        title="Book Clinic Appointment"
        subtitle="Authoritative server-side availability engine with double-booking prevention"
        maxWidth="lg"
      >
        <form onSubmit={handleBookAppointment} className="space-y-4 text-xs">
          {bookingError && (
            <div className="p-3 bg-gray-50 border border-black rounded font-semibold text-black">
              {bookingError}
            </div>
          )}

          {/* Patient Selection/Creation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                Patient *
              </label>
              <button
                type="button"
                onClick={() => setIsNewPatient(!isNewPatient)}
                className="text-xs text-[#0A2540] font-medium hover:underline"
              >
                {isNewPatient ? 'Select Existing' : '+ Add New Patient'}
              </button>
            </div>
            
            {isNewPatient ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Patient Name *"
                  required={isNewPatient}
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#0A2540] text-xs"
                />
                <input
                  type="text"
                  placeholder="Phone Number *"
                  required={isNewPatient}
                  value={newPatientPhone}
                  onChange={(e) => setNewPatientPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#0A2540] text-xs"
                />
              </div>
            ) : (
              <select
                value={bookPatientId}
                onChange={(e) => setBookPatientId(e.target.value)}
                required={!isNewPatient}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#0A2540] text-xs bg-white"
              >
                <option value="" disabled>Select a patient...</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.phone})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Select Doctor & Service */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                Doctor *
              </label>
              <select
                value={bookDoctorId}
                onChange={(e) => setBookDoctorId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#0A2540] text-xs bg-white"
              >
                <option value="" disabled>Select Doctor...</option>
                {doctors
                  .filter((d) => d.status === 'ACTIVE')
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.specialization})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                Service / Consultation *
              </label>
              <select
                value={bookServiceId}
                onChange={(e) => setBookServiceId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#0A2540] text-xs bg-white"
              >
                <option value="" disabled>Select Service...</option>
                {services
                  .filter((s) => s.status === 'ACTIVE')
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.duration_minutes} min • ${s.fee})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
              Appointment Date *
            </label>
            <input
              type="date"
              required
              value={bookDate}
              onChange={(e) => setBookDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#0A2540] font-mono text-xs"
            />
          </div>

          {/* Available Slots Grid */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5 flex items-center justify-between">
              <span>Calculated Available Slots *</span>
              {loadingSlots && (
                <span className="text-[10px] text-gray-500 flex items-center gap-1 font-normal font-mono">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Checking schedules...
                </span>
              )}
            </label>

            {bookSlotInfo?.on_leave ? (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded text-red-900 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-red-950">Physician is on Scheduled Leave</div>
                  <p className="text-[11px] text-red-800 mt-0.5">
                    {bookSlotInfo.reason ||
                      `Doctor is on scheduled leave (${bookSlotInfo.leave_reason}). Availability is blocked and no bookings can be made on this date.`}
                  </p>
                </div>
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded text-center text-gray-500">
                {bookSlotInfo?.reason || `No slots available on ${bookDate} for this doctor (Clinic closed, off-duty, or fully booked).`}
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-40 overflow-y-auto p-1">
                {availableSlots.map((slot, i) => {
                  const isSelected = bookStartTime === slot.time;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setBookStartTime(slot.time)}
                      className={`px-2 py-1.5 rounded font-mono text-xs font-semibold transition-colors cursor-pointer border ${
                        isSelected
                          ? 'bg-[#0A2540] text-white border-[#0A2540]'
                          : 'bg-white text-[#0A0A0A] border-gray-300 hover:border-[#0A2540]'
                      }`}
                    >
                      {slot.time}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes */}
          <Input
            label="Consultation Notes (Optional)"
            value={bookNotes}
            onChange={(e) => setBookNotes(e.target.value)}
            placeholder="Reason for visit or symptoms..."
          />

          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
            <Button variant="secondary" size="md" onClick={() => setBookModalOpen(false)} type="button">
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              type="submit"
              loading={bookingLoading}
              disabled={!bookStartTime || availableSlots.length === 0}
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              Confirm Appointment
            </Button>
          </div>
        </form>
      </Modal>

      {/* RESCHEDULE MODAL */}
      {activeAppointment && (
        <Modal
          isOpen={rescheduleModalOpen}
          onClose={() => setRescheduleModalOpen(false)}
          title="Reschedule Appointment"
          subtitle={`Moving appointment for ${activeAppointment.patient?.name || 'Unknown Patient'} with ${activeAppointment.doctor?.name || 'Unknown Doctor'}`}
          maxWidth="md"
        >
          <form onSubmit={handleRescheduleAppointment} className="space-y-4 text-xs">
            {rescheduleError && (
              <div className="p-3 bg-gray-50 border border-black rounded font-semibold text-black">
                {rescheduleError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                Select New Date *
              </label>
              <input
                type="date"
                required
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:border-[#0A2540] font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5 flex items-center justify-between">
                <span>Available Slots on {rescheduleDate} *</span>
                {rescheduleLoading && (
                  <span className="text-[10px] text-gray-500 flex items-center gap-1 font-normal font-mono">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Checking schedules...
                  </span>
                )}
              </label>

              {rescheduleSlotInfo?.on_leave ? (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded text-red-900 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-red-950">Physician is on Scheduled Leave</div>
                    <p className="text-[11px] text-red-800 mt-0.5">
                      {rescheduleSlotInfo.reason ||
                        `Doctor is on scheduled leave (${rescheduleSlotInfo.leave_reason}). Availability is blocked and appointment cannot be moved to this date.`}
                    </p>
                  </div>
                </div>
              ) : rescheduleSlots.length === 0 ? (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded text-center text-gray-500">
                  {rescheduleSlotInfo?.reason || 'No slots available on this date.'}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto p-1">
                  {rescheduleSlots.map((slot, i) => {
                    const isSelected = rescheduleStartTime === slot.time;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setRescheduleStartTime(slot.time)}
                        className={`px-2 py-1.5 rounded font-mono text-xs font-semibold transition-colors cursor-pointer border ${
                          isSelected
                            ? 'bg-[#0A2540] text-white border-[#0A2540]'
                            : 'bg-white text-[#0A0A0A] border-gray-300 hover:border-[#0A2540]'
                        }`}
                      >
                        {slot.time}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <Input
              label="Reason for Reschedule"
              value={rescheduleReason}
              onChange={(e) => setRescheduleReason(e.target.value)}
              placeholder="e.g. Patient requested morning slot"
            />

            <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
              <Button variant="secondary" size="md" onClick={() => setRescheduleModalOpen(false)} type="button">
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                type="submit"
                loading={rescheduleLoading}
                disabled={!rescheduleStartTime || rescheduleSlots.length === 0}
              >
                Apply Reschedule
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* CANCEL MODAL */}
      {activeAppointment && (
        <Modal
          isOpen={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
          title="Cancel Appointment"
          subtitle={`Are you sure you want to cancel ${activeAppointment.patient?.name || 'Unknown Patient'}'s appointment on ${activeAppointment.date} at ${activeAppointment.start_time}?`}
          maxWidth="md"
        >
          <form onSubmit={handleCancelAppointment} className="space-y-4 text-xs">
            <Input
              label="Cancellation Reason"
              required
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Patient called to cancel due to travel"
            />

            <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
              <Button variant="secondary" size="md" onClick={() => setCancelModalOpen(false)} type="button">
                Back
              </Button>
              <Button
                variant="primary"
                size="md"
                type="submit"
                loading={cancelLoading}
                icon={<XCircle className="w-4 h-4" />}
              >
                Confirm Cancellation
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirmation Modals */}
      <ConfirmModal
        isOpen={!!confirmCompleteId}
        onClose={() => setConfirmCompleteId(null)}
        onConfirm={() => {
          if (confirmCompleteId) {
            handleStatusChange(confirmCompleteId, 'COMPLETED');
            setConfirmCompleteId(null);
          }
        }}
        title="Confirm Mark Done"
        message="Are you sure you want to mark this appointment as completed? This will update the patient's record."
        confirmText="Yes, Mark Done"
      />
    </div>
  );
};
