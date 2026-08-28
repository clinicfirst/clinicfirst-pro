import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Calendar,
  User,
  Stethoscope,
  Clock,
  Search,
  Filter,
  Download,
  Printer,
  RefreshCw,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Phone,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { apiRequest } from '../../api';
import { DailyCollectionSummary, DailyCollectionItem } from '../../types';
import { showToast } from '../common/Toast';

interface DailyCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
  currencySymbol?: string;
}

export const DailyCollectionModal: React.FC<DailyCollectionModalProps> = ({
  isOpen,
  onClose,
  initialDate,
  currencySymbol = '$',
}) => {
  const [data, setData] = useState<DailyCollectionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(
    initialDate || new Date().toISOString().split('T')[0]
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('ALL');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [activeViewTab, setActiveViewTab] = useState<'itemized' | 'breakdown'>('itemized');

  const fetchCollection = async (date: string) => {
    try {
      setLoading(true);
      const res = await apiRequest(`/api/clinic/daily-collection?date=${encodeURIComponent(date)}`);
      setData(res);
    } catch (err: any) {
      console.error('Failed to load daily collection:', err);
      showToast(err.message || 'Failed to fetch collection details', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const dateToFetch = initialDate || selectedDate || new Date().toISOString().split('T')[0];
      setSelectedDate(dateToFetch);
      fetchCollection(dateToFetch);
    }
  }, [isOpen, initialDate]);

  if (!isOpen) return null;

  const symbol = data?.currency_symbol || currencySymbol;
  const items = data?.items || [];

  // Filter items
  const filteredItems = items.filter((item) => {
    // Search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchPatient = (item.patient_name || '').toLowerCase().includes(q) || (item.patient_phone || '').toLowerCase().includes(q);
      const matchDoctor = (item.doctor_name || '').toLowerCase().includes(q);
      const matchService = (item.service_name || '').toLowerCase().includes(q);
      if (!matchPatient && !matchDoctor && !matchService) return false;
    }

    // Doctor filter
    if (selectedDoctorId !== 'ALL' && item.doctor_id !== selectedDoctorId) {
      return false;
    }

    // Service filter
    if (selectedServiceId !== 'ALL' && item.service_id !== selectedServiceId) {
      return false;
    }

    // Status filter
    if (selectedStatus !== 'ALL' && item.status !== selectedStatus) {
      return false;
    }

    return true;
  });

  const filteredTotal = filteredItems.reduce(
    (sum, item) => (item.status === 'COMPLETED' ? sum + item.fee : sum),
    0
  );

  const handleExportCSV = () => {
    if (!filteredItems.length) {
      showToast('No records to export', 'info');
      return;
    }

    const headers = [
      'Appointment Date',
      'Start Time',
      'End Time',
      'Patient Name',
      'Patient Phone',
      'Doctor Name',
      'Doctor Specialization',
      'Service Availed',
      'Duration (Mins)',
      'Status',
      'Booked Via',
      `Fee (${symbol})`,
    ];

    const csvRows = [
      headers.join(','),
      ...filteredItems.map((item) =>
        [
          `"${item.date}"`,
          `"${item.start_time}"`,
          `"${item.end_time}"`,
          `"${item.patient_name.replace(/"/g, '""')}"`,
          `"${item.patient_phone}"`,
          `"${item.doctor_name.replace(/"/g, '""')}"`,
          `"${item.doctor_specialization.replace(/"/g, '""')}"`,
          `"${item.service_name.replace(/"/g, '""')}"`,
          item.service_duration,
          `"${item.status}"`,
          `"${item.created_via}"`,
          item.fee,
        ].join(',')
      ),
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `daily_fee_collection_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Collection report exported as CSV', 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Daily Fee Collection Breakdown"
      subtitle="Authoritative clinic financial records for scheduled, confirmed and completed services."
      maxWidth="3xl"
      position="top"
    >
      <div className="space-y-5 print:p-0">
        {/* 1. Date & Action Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 border border-[#CBD5E1] rounded-lg bg-white">
              <Calendar className="w-4 h-4 text-[#172B3A] shrink-0" />
              <label htmlFor="collection-date" className="text-xs font-bold text-[#172B3A] uppercase tracking-wider">
                Date:
              </label>
              <input
                id="collection-date"
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  const newDate = e.target.value;
                  setSelectedDate(newDate);
                  fetchCollection(newDate);
                }}
                className="text-xs font-mono font-medium bg-transparent border-none p-0 text-[#172B3A] focus:ring-0 focus:outline-none cursor-pointer"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
              onClick={() => fetchCollection(selectedDate)}
              disabled={loading}
              className="text-[#64748B] hover:text-[#172B3A] hover:bg-slate-100"
            >
              Refresh
            </Button>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto print:hidden">
            <div className="inline-flex rounded-lg border border-[#CBD5E1] p-0.5 bg-slate-50">
              <button
                type="button"
                onClick={() => setActiveViewTab('itemized')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  activeViewTab === 'itemized'
                    ? 'bg-white text-[#172B3A] shadow-xs border border-[#E2E8F0]'
                    : 'text-[#64748B] hover:text-[#172B3A]'
                }`}
              >
                Itemized List
              </button>
              <button
                type="button"
                onClick={() => setActiveViewTab('breakdown')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  activeViewTab === 'breakdown'
                    ? 'bg-white text-[#172B3A] shadow-xs border border-[#E2E8F0]'
                    : 'text-[#64748B] hover:text-[#172B3A]'
                }`}
              >
                By Doctor & Service
              </button>
            </div>

            <div className="flex items-center gap-2 border-l border-[#E2E8F0] pl-3">
              <Button
                variant="outline"
                size="sm"
                icon={<Download className="w-3.5 h-3.5" />}
                onClick={handleExportCSV}
                disabled={loading || items.length === 0}
              >
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={<Printer className="w-3.5 h-3.5" />}
                onClick={handlePrint}
                disabled={loading || items.length === 0}
              >
                Print
              </Button>
            </div>
          </div>
        </div>

        {/* 2. Primary KPI Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Total Day Collection */}
          <div className="p-4 bg-white border border-[#E2E8F0] rounded-xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#172B3A] bg-[#E2E8F0] px-2 py-1 rounded-sm">
                Total Daily Collection
              </span>
              <div className="w-6 h-6 rounded-md bg-slate-100 text-[#172B3A] flex items-center justify-center font-bold text-xs">
                {symbol}
              </div>
            </div>
            <div className="text-3xl font-extrabold text-[#172B3A] font-mono tracking-tight bg-[#E2E8F0] inline-block px-2 py-0.5 mt-2 rounded-sm">
              {symbol}
              {(data?.total_collection || 0).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-[11px] text-[#172B3A] mt-2 flex items-center gap-1 font-medium bg-[#E2E8F0] inline-flex px-1.5 py-0.5 rounded-sm">
              <span className="font-bold">{data?.total_appointments_count || 0} total</span>
              <span>•</span>
              <span>Active appointments today</span>
            </div>
          </div>

          {/* Confirmed & Realized */}
          <div className="p-4 bg-white border border-[#E2E8F0] rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#172B3A] bg-[#E2E8F0] px-2 py-1 rounded-sm">
                Confirmed & Realized
              </span>
              <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs border border-emerald-100">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-[#172B3A] font-mono tracking-tight bg-[#E2E8F0] inline-block px-2 py-0.5 mt-2 rounded-sm">
              {symbol}
              {(data?.confirmed_completed_total || 0).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-[11px] text-[#172B3A] mt-2 font-medium bg-[#E2E8F0] inline-block px-1.5 py-0.5 rounded-sm">
              {(data?.confirmed_count || 0) + (data?.completed_count || 0)} confirmed/completed patients
            </div>
          </div>

          {/* Average Fee Per Patient */}
          <div className="p-4 bg-white border border-[#E2E8F0] rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#172B3A] bg-[#E2E8F0] px-2 py-1 rounded-sm">
                Average Ticket Fee
              </span>
              <div className="w-6 h-6 rounded-md bg-slate-100 text-[#0A2540] flex items-center justify-center font-bold text-xs">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-[#172B3A] font-mono tracking-tight mt-2 px-2 py-0.5">
              {symbol}
              {data && data.total_appointments_count > 0 && data.total_collection > 0
                ? (data.total_collection / (data.total_appointments_count - data.cancelled_count || 1)).toLocaleString(
                    'en-US',
                    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                  )
                : '0.00'}
            </div>
            <div className="text-[11px] text-[#64748B] mt-2 font-medium px-2 py-0.5">
              Across {data?.by_doctor?.length || 0} active doctors on duty
            </div>
          </div>
        </div>

        {/* 3. Filter Controls (Itemized View) */}
        {activeViewTab === 'itemized' && (
          <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3 text-xs w-full">
            <div className="flex items-center gap-2 flex-1 w-full relative">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search patient, doctor, or service..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-[#CBD5E1] rounded-lg pl-9 pr-3 py-2 text-xs font-medium text-[#172B3A] placeholder-[#94A3B8] focus:outline-none focus:border-[#172B3A]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              {/* Doctor filter */}
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="bg-white border border-[#CBD5E1] rounded-lg px-3 py-2 text-xs font-medium text-[#172B3A] focus:outline-none focus:border-[#172B3A] min-w-[130px]"
              >
                <option value="ALL">All Doctors</option>
                {data?.by_doctor?.map((d) => (
                  <option key={d.doctor_id} value={d.doctor_id}>
                    {d.doctor_name}
                  </option>
                ))}
              </select>

              {/* Service filter */}
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="bg-white border border-[#CBD5E1] rounded-lg px-3 py-2 text-xs font-medium text-[#172B3A] focus:outline-none focus:border-[#172B3A] min-w-[130px]"
              >
                <option value="ALL">All Services</option>
                {data?.by_service?.map((s) => (
                  <option key={s.service_id} value={s.service_id}>
                    {s.service_name}
                  </option>
                ))}
              </select>

              {/* Status filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-white border border-[#CBD5E1] rounded-lg px-3 py-2 text-xs font-medium text-[#172B3A] focus:outline-none focus:border-[#172B3A] min-w-[130px]"
              >
                <option value="ALL">All Statuses</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="COMPLETED">Completed</option>
                <option value="RESCHEDULED">Rescheduled</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>
        )}

        {/* 4. Main Body: Itemized Table or Doctor/Service Breakdown */}
        {loading ? (
          <div className="py-16 text-center text-xs text-[#64748B] font-mono flex flex-col items-center justify-center gap-3">
            <div className="w-7 h-7 rounded-full border-2 border-[#E2E8F0] border-t-[#0A2540] animate-spin" />
            <span>Fetching authoritative daily fee records...</span>
          </div>
        ) : activeViewTab === 'itemized' ? (
          <div className="border border-[#E2E8F0] rounded-xl overflow-hidden bg-white shadow-xs">
            {filteredItems.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-[#64748B] flex items-center justify-center mx-auto mb-2 font-bold text-lg">
                  {symbol}
                </div>
                <h4 className="text-sm font-bold text-[#172B3A]">No fee collection records found</h4>
                <p className="text-xs text-[#64748B] mt-1 max-w-sm mx-auto">
                  {searchTerm || selectedDoctorId !== 'ALL' || selectedServiceId !== 'ALL' || selectedStatus !== 'ALL'
                    ? 'No appointments matched your current search and filter criteria.'
                    : `No appointments or fee collections have been logged for ${selectedDate}.`}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-[#E2E8F0] text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                      <th className="py-3 px-4 font-semibold">Patient Details</th>
                      <th className="py-3 px-4 font-semibold">Doctor & Specialization</th>
                      <th className="py-3 px-4 font-semibold">Service Availed</th>
                      <th className="py-3 px-4 font-semibold">Slot & Channel</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Fee Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {filteredItems.map((item) => {
                      const isCancelled = item.status === 'CANCELLED';
                      return (
                        <tr
                          key={item.appointment_id}
                          className={`hover:bg-slate-50/60 transition-colors ${
                            isCancelled ? 'opacity-60 bg-rose-50/20' : ''
                          }`}
                        >
                          {/* Patient */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-[#172B3A] flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-[#0A2540] shrink-0" />
                              <span className="truncate">{item.patient_name}</span>
                            </div>
                            <div className="text-[11px] text-[#64748B] flex items-center gap-1 mt-0.5 font-mono">
                              <Phone className="w-3 h-3 text-[#94A3B8]" />
                              {item.patient_phone || 'No phone'}
                            </div>
                          </td>

                          {/* Doctor */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-[#172B3A] flex items-center gap-1.5">
                              <Stethoscope className="w-3.5 h-3.5 text-[#0A2540] shrink-0" />
                              <span className="truncate">{item.doctor_name}</span>
                            </div>
                            <div className="text-[11px] text-[#64748B] truncate mt-0.5">
                              {item.doctor_specialization}
                            </div>
                          </td>

                          {/* Service */}
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-[#172B3A]">{item.service_name}</div>
                            <div className="text-[11px] text-[#64748B] flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3 text-[#94A3B8]" />
                              <span>{item.service_duration} mins standard consultation</span>
                            </div>
                          </td>

                          {/* Slot & Channel */}
                          <td className="py-3.5 px-4 font-mono text-[11px]">
                            <div className="font-semibold text-[#172B3A]">
                              {item.start_time} - {item.end_time}
                            </div>
                            <div className="mt-1">
                              {item.created_via === 'ai_receptionist' ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[10px] font-medium text-emerald-800">
                                  <Sparkles className="w-2.5 h-2.5" /> AI Receptionist
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-medium text-slate-700">
                                  Front Desk
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            <Badge status={item.status} />
                          </td>

                          {/* Fee */}
                          <td className="py-3.5 px-4 text-right font-mono">
                            <div
                              className={`text-sm font-bold ${
                                isCancelled ? 'text-rose-600 line-through' : 'text-[#0A2540]'
                              }`}
                            >
                              {symbol}
                              {item.fee.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-[#64748B] mt-0.5">
                              {isCancelled ? 'Cancelled (Not billed)' : 'Standard Fee'}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Table Footer with Sum */}
                  <tfoot>
                    <tr className="bg-slate-50 font-bold border-t-2 border-[#E2E8F0] text-[#172B3A]">
                      <td colSpan={5} className="py-3.5 px-4 text-right uppercase tracking-wider text-[11px] text-[#64748B]">
                        Filtered Realized Collection Total ({filteredItems.filter((i) => i.status === 'COMPLETED').length} completed services):
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-base text-[#0A2540]">
                        {symbol}
                        {filteredTotal.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* By Doctor & Service Summary View */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* By Doctor */}
            <div className="p-4 bg-white border border-[#E2E8F0] rounded-xl shadow-xs">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#E2E8F0]">
                <Stethoscope className="w-4 h-4 text-[#0A2540]" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#172B3A]">
                  Collection by Doctor
                </h4>
              </div>
              {data?.by_doctor && data.by_doctor.length > 0 ? (
                <div className="divide-y divide-[#E2E8F0] text-xs">
                  {data.by_doctor.map((d) => (
                    <div key={d.doctor_id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-[#172B3A]">{d.doctor_name}</div>
                        <div className="text-[11px] text-[#64748B]">{d.specialization}</div>
                        <div className="text-[11px] text-[#0A2540] font-semibold mt-0.5">
                          {d.count} patient{d.count === 1 ? '' : 's'} scheduled
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-sm font-bold text-[#0A2540]">
                          {symbol}
                          {d.total_fees.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-[#64748B]">
                          {data.total_collection > 0
                            ? `${Math.round((d.total_fees / data.total_collection) * 100)}% of total`
                            : '0%'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#64748B] py-4 text-center">No doctor collection recorded.</p>
              )}
            </div>

            {/* By Service */}
            <div className="p-4 bg-white border border-[#E2E8F0] rounded-xl shadow-xs">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#E2E8F0]">
                <Layers className="w-4 h-4 text-[#0A2540]" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#172B3A]">
                  Collection by Clinical Service
                </h4>
              </div>
              {data?.by_service && data.by_service.length > 0 ? (
                <div className="divide-y divide-[#E2E8F0] text-xs">
                  {data.by_service.map((s) => (
                    <div key={s.service_id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-[#172B3A]">{s.service_name}</div>
                        <div className="text-[11px] text-[#64748B]">
                          Unit price: {symbol}
                          {s.fee.toFixed(2)}
                        </div>
                        <div className="text-[11px] text-[#0A2540] font-semibold mt-0.5">
                          {s.count} consultation{s.count === 1 ? '' : 's'}
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-sm font-bold text-[#0A2540]">
                          {symbol}
                          {s.total_fees.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-[#64748B]">
                          {data.total_collection > 0
                            ? `${Math.round((s.total_fees / data.total_collection) * 100)}% of total`
                            : '0%'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#64748B] py-4 text-center">No service collection recorded.</p>
              )}
            </div>
          </div>
        )}

        {/* 5. Footer */}
        <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Strict Tenant Isolated Ledger (CLINIC_ADMIN exclusive)</span>
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
