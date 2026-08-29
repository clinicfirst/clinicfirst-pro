import { showToast } from '../../components/common/Toast';
import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Search,
  Check,
  Stethoscope,
  Users,
  Bot,
  ExternalLink,
  Lock,
  Mail,
  Phone,
  MapPin,
  Globe,
  Coins,
  Save,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { Input } from '../../components/common/Input';
import { apiRequest } from '../../api';
import { Clinic, Doctor, User, Service, AiAgent } from '../../types';

export const SUPPORTED_CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'USD ($) - US Dollar' },
  { code: 'EUR', symbol: '€', label: 'EUR (€) - Euro' },
  { code: 'GBP', symbol: '£', label: 'GBP (£) - British Pound' },
  { code: 'INR', symbol: '₹', label: 'INR (₹) - Indian Rupee' },
  { code: 'AED', symbol: 'AED', label: 'AED (AED) - UAE Dirham' },
  { code: 'SAR', symbol: 'SAR', label: 'SAR (SAR) - Saudi Riyal' },
  { code: 'CAD', symbol: 'CA$', label: 'CAD (CA$) - Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', label: 'AUD (A$) - Australian Dollar' },
  { code: 'SGD', symbol: 'S$', label: 'SGD (S$) - Singapore Dollar' },
  { code: 'JPY', symbol: '¥', label: 'JPY (¥) - Japanese Yen' },
  { code: 'CHF', symbol: 'CHF', label: 'CHF (CHF) - Swiss Franc' },
  { code: 'NZD', symbol: 'NZ$', label: 'NZD (NZ$) - New Zealand Dollar' },
];

interface ClinicWithCounts extends Clinic {
  doctorsCount: number;
  staffCount: number;
  aiAgentStatus: string;
}

interface PlatformClinicsProps {
  createModalOpen?: boolean;
  onCloseCreateModal?: () => void;
  onOpenCreateModal?: () => void;
}

export const PlatformClinics: React.FC<PlatformClinicsProps> = ({
  createModalOpen: controlledModalOpen,
  onCloseCreateModal,
  onOpenCreateModal,
}) => {
  const [internalModalOpen, setInternalModalOpen] = useState(false);
  const isCreateOpen = controlledModalOpen !== undefined ? controlledModalOpen : internalModalOpen;
  const handleOpenCreate = onOpenCreateModal || (() => setInternalModalOpen(true));
  const handleCloseCreate = onCloseCreateModal || (() => setInternalModalOpen(false));

  const [clinics, setClinics] = useState<ClinicWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [confirmStatusClinic, setConfirmStatusClinic] = useState<ClinicWithCounts | null>(null);
  const [selectedClinic, setSelectedClinic] = useState<any | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Edit Currency in Detail Modal
  const [editCurrencyCode, setEditCurrencyCode] = useState('USD');
  const [editCurrencySymbol, setEditCurrencySymbol] = useState('$');
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [currencySuccessMsg, setCurrencySuccessMsg] = useState<string | null>(null);

  // Form State for Clinic + Admin Creation
  const [form, setForm] = useState({
    name: '',
    city: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    currency: 'USD',
    currency_symbol: '$',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchClinics = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ clinics: ClinicWithCounts[] }>('/api/platform/clinics');
      setClinics(res.clinics);
    } catch (err) {
      console.error('Failed to fetch clinics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClinics();
  }, []);

  const handleCurrencyChangeInForm = (code: string) => {
    const found = SUPPORTED_CURRENCIES.find((c) => c.code === code);
    setForm({
      ...form,
      currency: code,
      currency_symbol: found ? found.symbol : '$',
    });
  };

  const handleCreateClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);

    try {
      await apiRequest('/api/platform/clinics', {
        method: 'POST',
        body: JSON.stringify(form),
      });

      // Reset form & close
      setForm({
        name: '',
        city: '',
        address: '',
        phone: '',
        email: '',
        website: '',
        currency: 'USD',
        currency_symbol: '$',
        adminName: '',
        adminEmail: '',
        adminPassword: '',
      });
      handleCloseCreate();
      fetchClinics();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create clinic');
    } finally {
      setFormLoading(false);
    }
  };

  const openClinicDetail = async (clinicId: string) => {
    try {
      const data = await apiRequest<any>(`/api/platform/clinics/${clinicId}`);
      setSelectedClinic(data);
      setEditCurrencyCode(data.clinic.currency || 'USD');
      setEditCurrencySymbol(data.clinic.currency_symbol || '$');
      setCurrencySuccessMsg(null);
      setDetailModalOpen(true);
    } catch (err: any) {
      showToast(err.message || 'Failed to load clinic details', 'error');
    }
  };

  const handleSaveClinicCurrency = async () => {
    if (!selectedClinic) return;
    try {
      setSavingCurrency(true);
      setCurrencySuccessMsg(null);
      const updated = await apiRequest<any>(`/api/platform/clinics/${selectedClinic.clinic.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          currency: editCurrencyCode,
          currency_symbol: editCurrencySymbol,
        }),
      });
      setSelectedClinic({
        ...selectedClinic,
        clinic: {
          ...selectedClinic.clinic,
          currency: editCurrencyCode,
          currency_symbol: editCurrencySymbol,
        },
      });
      setCurrencySuccessMsg('Currency updated successfully. All clinic services and receptionist pricing will use this currency.');
      fetchClinics();
    } catch (err: any) {
      showToast(err.message || 'Failed to update clinic currency', 'error');
    } finally {
      setSavingCurrency(false);
    }
  };

  const toggleClinicStatus = async (clinic: ClinicWithCounts) => {
    const nextStatus = clinic.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await apiRequest(`/api/platform/clinics/${clinic.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      });
      fetchClinics();
    } catch (err: any) {
      showToast(err.message || 'Failed to update clinic status', 'error');
    }
  };

  const filtered = clinics.filter(
    (c) =>
      (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.city || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-[#0A0A0A] tracking-tight">Clinics Directory</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage provisioned clinic tenants, initial admin credentials, billing currencies, and AI Receptionist status.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          icon={<Plus className="w-4 h-4" />}
          onClick={handleOpenCreate}
        >
          Create New Clinic
        </Button>
      </div>

      {/* Search Filter */}
      <div className="flex items-center gap-4">
        <div className="w-full sm:w-80">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by clinic name, city, email..."
            icon={<Search className="w-4 h-4" />}
          />
        </div>
        <span className="text-xs font-mono text-gray-500">
          Showing {filtered.length} of {clinics.length} clinics
        </span>
      </div>

      {/* Clinics Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/75 border-b border-gray-200 text-gray-700 uppercase font-semibold text-[11px] tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Clinic Name & City</th>
                <th className="px-6 py-3.5">Contact Info</th>
                <th className="px-6 py-3.5">Currency</th>
                <th className="px-6 py-3.5">Capacity</th>
                <th className="px-6 py-3.5">AI Receptionist</th>
                <th className="px-6 py-3.5">Tenant Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-normal">
              {filtered.map((clinic) => (
                <tr key={clinic.id} className="group hover:bg-[#F8FAFC] transition-colors duration-200 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-[#0A0A0A] text-sm">{clinic.name}</div>
                    <div className="text-gray-500 text-xs mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-gray-400" />
                      {clinic.city}
                    </div>
                  </td>

                  <td className="px-6 py-4 text-gray-600 space-y-0.5">
                    <div className="font-mono text-xs text-[#0A0A0A]">{clinic.phone}</div>
                    <div className="text-[11px] text-gray-500">{clinic.email}</div>
                  </td>

                  {/* Configurable Currency Display */}
                  <td className="px-6 py-4">
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 border border-gray-200 rounded font-mono font-semibold text-[#0A2540] text-xs">
                      <span>{clinic.currency || 'USD'}</span>
                      <span className="text-gray-500">({clinic.currency_symbol || '$'})</span>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="inline-flex items-center gap-1 font-medium text-gray-700">
                        <Stethoscope className="w-3.5 h-3.5 text-[#0A2540]" />
                        {clinic.doctorsCount} Doctors
                      </span>
                      <span className="inline-flex items-center gap-1 font-medium text-gray-700">
                        <Users className="w-3.5 h-3.5 text-gray-500" />
                        {clinic.staffCount} Staff
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <Badge
                      status={clinic.aiAgentStatus === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'}
                      label={clinic.aiAgentStatus === 'ACTIVE' ? 'Ava (Live)' : 'Disabled'}
                    />
                  </td>

                  <td className="px-6 py-4">
                    <Badge status={clinic.status} />
                  </td>

                  <td className="px-6 py-4 text-right space-x-2 opacity-80 group-hover:opacity-100 transition-opacity duration-200">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openClinicDetail(clinic.id)}
                    >
                      View / Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmStatusClinic(clinic)}
                      className={clinic.status === 'ACTIVE' ? 'text-gray-600' : 'text-[#0A2540] font-semibold'}
                    >
                      {clinic.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE NEW CLINIC MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={handleCloseCreate}
        title="Provision New Clinic Tenant"
        subtitle="Creates a discrete tenant boundary, seeds operating hours, registers initial Clinic Admin, and provisions AI Receptionist."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateClinic} className="space-y-4">
          {formError && (
            <div className="p-3 bg-gray-50 border border-black rounded text-xs font-semibold text-black">
              {formError}
            </div>
          )}

          {/* Section 1: Clinic Profile */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#0A2540] mb-3 pb-1 border-b border-gray-200">
              1. Clinic Organization & Currency
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Input
                  label="Clinic Name *"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Metro Cardiology Clinic"
                />
              </div>

              <Input
                label="City *"
                required
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="e.g. Chicago, IL"
              />

              {/* Currency Configuration Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                  Operating Currency *
                </label>
                <select
                  value={form.currency}
                  onChange={(e) => handleCurrencyChangeInForm(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded bg-white text-[#0A0A0A] font-medium focus:ring-1 focus:ring-[#0A2540] focus:border-[#0A2540]"
                >
                  {SUPPORTED_CURRENCIES.map((curr) => (
                    <option key={curr.code} value={curr.code}>
                      {curr.label}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-gray-500 mt-1 block">
                  Only Platform Admin can change this currency.
                </span>
              </div>

              <Input
                label="Clinic Phone *"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1-555-010-4400"
              />

              <Input
                label="Clinic Email *"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="contact@metrocardio.com"
              />

              <Input
                label="Website"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://metrocardio.com"
              />

              <div className="sm:col-span-2">
                <Input
                  label="Physical Address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="100 Michigan Ave, Suite 400"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Initial Clinic Admin User */}
          <div className="pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#0A2540] mb-3 pb-1 border-b border-gray-200">
              2. Initial Clinic Administrator Account
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Input
                  label="Administrator Full Name *"
                  required
                  value={form.adminName}
                  onChange={(e) => setForm({ ...form, adminName: e.target.value })}
                  placeholder="e.g. Dr. Sarah Jenkins"
                />
              </div>

              <Input
                label="Admin Login Email *"
                type="email"
                required
                value={form.adminEmail}
                onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                placeholder="admin@metrocardio.com"
              />

              <Input
                label="Temporary Password *"
                type="password"
                required
                value={form.adminPassword}
                onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                placeholder="At least 8 chars"
                helperText="Forced reset on first login"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
            <Button variant="secondary" size="md" onClick={handleCloseCreate} type="button">
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              type="submit"
              loading={formLoading}
              icon={<Check className="w-4 h-4" />}
            >
              Provision Clinic & Administrator
            </Button>
          </div>
        </form>
      </Modal>

      {/* CLINIC DETAIL & CURRENCY CONFIGURATION MODAL */}
      {selectedClinic && (
        <Modal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          title={selectedClinic.clinic.name}
          subtitle={`Tenant ID: ${selectedClinic.clinic.id}`}
          maxWidth="lg"
        >
          <div className="space-y-5 text-xs">
            {/* Contact & Location Info */}
            <div className="grid grid-cols-2 gap-4 p-3.5 bg-gray-50 rounded border border-gray-200">
              <div>
                <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Contact</span>
                <p className="font-medium text-[#0A0A0A] mt-0.5">{selectedClinic.clinic.phone}</p>
                <p className="text-gray-600">{selectedClinic.clinic.email}</p>
              </div>
              <div>
                <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Location & Timezone</span>
                <p className="font-medium text-[#0A0A0A] mt-0.5">{selectedClinic.clinic.city}</p>
                <p className="text-gray-600 font-mono text-[11px]">{selectedClinic.clinic.timezone || 'America/Los_Angeles'}</p>
              </div>
            </div>

            {/* Platform Admin Currency Management Section */}
            <div className="p-3.5 bg-white border border-[#0A2540] rounded-md space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-[#0A2540]" />
                  <span className="font-bold text-[#0A2540] uppercase tracking-wider text-xs">
                    Clinic Billing Currency (Platform Admin Only)
                  </span>
                </div>
                <Badge status="ACTIVE" label="Platform Controlled" />
              </div>

              <p className="text-gray-600 text-xs">
                Configure the official currency and symbol for this clinic. All service fees, booking quotes, and AI Voice Receptionist pricing will automatically use this setting.
              </p>

              {currencySuccessMsg && (
                <div className="p-2.5 bg-gray-50 border border-[#0A2540] rounded text-xs font-semibold text-[#0A2540]">
                  {currencySuccessMsg}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Select Currency Standard
                  </label>
                  <select
                    value={editCurrencyCode}
                    onChange={(e) => {
                      const code = e.target.value;
                      setEditCurrencyCode(code);
                      const found = SUPPORTED_CURRENCIES.find((c) => c.code === code);
                      if (found) setEditCurrencySymbol(found.symbol);
                    }}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded bg-white text-[#0A0A0A] font-medium focus:ring-1 focus:ring-[#0A2540] focus:border-[#0A2540]"
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Currency Symbol
                  </label>
                  <input
                    type="text"
                    value={editCurrencySymbol}
                    onChange={(e) => setEditCurrencySymbol(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded bg-white text-[#0A0A0A] font-mono font-bold focus:ring-1 focus:ring-[#0A2540] focus:border-[#0A2540]"
                    placeholder="$"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  variant="primary"
                  size="sm"
                  loading={savingCurrency}
                  icon={<Save className="w-3.5 h-3.5" />}
                  onClick={handleSaveClinicCurrency}
                >
                  Save Currency Settings
                </Button>
              </div>
            </div>

            {/* Doctors list */}
            <div>
              <h5 className="font-bold text-[#0A2540] uppercase tracking-wider mb-2">
                Registered Doctors ({selectedClinic.doctors.length})
              </h5>
              <div className="divide-y divide-gray-100 border border-gray-200 rounded">
                {selectedClinic.doctors.map((d: Doctor) => (
                  <div key={d.id} className="p-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-[#0A0A0A]">{d.name}</span>
                      <span className="text-gray-500 ml-2">({d.specialization})</span>
                    </div>
                    <Badge status={d.status} />
                  </div>
                ))}
              </div>
            </div>

            {/* Staff list */}
            <div>
              <h5 className="font-bold text-[#0A2540] uppercase tracking-wider mb-2">
                Clinic Users & Staff ({selectedClinic.staff.length})
              </h5>
              <div className="divide-y divide-gray-100 border border-gray-200 rounded">
                {selectedClinic.staff.map((u: User) => (
                  <div key={u.id} className="p-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-[#0A0A0A]">{u.name}</span>
                      <span className="text-gray-500 ml-2 font-mono">{u.email}</span>
                    </div>
                    <Badge status={u.role} />
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setDetailModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation Modals */}
      <ConfirmModal
        isOpen={!!confirmStatusClinic}
        onClose={() => setConfirmStatusClinic(null)}
        onConfirm={() => {
          if (confirmStatusClinic) {
            toggleClinicStatus(confirmStatusClinic);
            setConfirmStatusClinic(null);
          }
        }}
        title={`Confirm ${confirmStatusClinic?.status === 'ACTIVE' ? 'Deactivation' : 'Activation'}`}
        message={`Are you sure you want to ${confirmStatusClinic?.status === 'ACTIVE' ? 'deactivate' : 'activate'} clinic "${confirmStatusClinic?.name}"?`}
        confirmText={`Yes, ${confirmStatusClinic?.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}`}
        destructive={confirmStatusClinic?.status === 'ACTIVE'}
      />
    </div>
  );
};
