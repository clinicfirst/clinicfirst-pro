import { showToast } from '../../components/common/Toast';
import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  Calendar,
  PhoneCall,
  Clock,
  CheckCircle2,
  FileText,
  User,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input, Select } from '../../components/common/Input';
import { apiRequest } from '../../api';
import { Patient, Appointment, Call } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { can } from '../../lib/permissions';

export const PatientsPage: React.FC = () => {
  const { user } = useAuth();
  const canManage = can(user, 'manage_patients');

  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Add Patient Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    dob: '',
    gender: 'Prefer not to say',
    preferred_language: 'English',
    notes: '',
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Patient Detail Drawer / Modal
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [patientDetail, setPatientDetail] = useState<{
    patient: Patient;
    appointments: Appointment[];
    calls: Call[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ patients: Patient[] }>(
        `/api/clinic/patients${search ? `?search=${encodeURIComponent(search)}` : ''}`
      );
      setPatients(res.patients);
    } catch (err) {
      console.error('Failed to load patients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [search]);

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setAddLoading(true);

    try {
      await apiRequest('/api/clinic/patients', {
        method: 'POST',
        body: JSON.stringify(form),
      });

      setForm({
        name: '',
        phone: '',
        email: '',
        dob: '',
        gender: 'Prefer not to say',
        preferred_language: 'English',
        notes: '',
      });
      setAddModalOpen(false);
      fetchPatients();
    } catch (err: any) {
      setAddError(err.message || 'Failed to create patient record');
    } finally {
      setAddLoading(false);
    }
  };

  const openPatientDetail = async (patientId: string) => {
    try {
      setSelectedPatientId(patientId);
      setDetailLoading(true);
      const res = await apiRequest(`/api/clinic/patients/${patientId}`);
      setPatientDetail(res);
    } catch (err: any) {
      showToast(err.message || 'Failed to load patient history', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-[#0A0A0A] tracking-tight">Patients Directory</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Registered patient records, incoming caller identifications, and visit histories.
          </p>
        </div>

        {canManage && (
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setAddModalOpen(true)}
          >
            Add New Patient
          </Button>
        )}
      </div>

      {/* Search Input */}
      <div className="flex items-center gap-4">
        <div className="w-full sm:w-80">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone number..."
            icon={<Search className="w-4 h-4" />}
          />
        </div>
        <span className="text-xs font-mono text-gray-500">
          {patients.length} patients registered
        </span>
      </div>

      {/* Patients Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/75 border-b border-gray-200 text-gray-700 uppercase font-semibold text-[11px] tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Patient Name</th>
                <th className="px-6 py-3.5">Contact Phone & Email</th>
                <th className="px-6 py-3.5">Language</th>
                <th className="px-6 py-3.5">Registered</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-normal">
              {patients.map((p) => (
                <tr key={p.id} className="group hover:bg-[#F8FAFC] transition-colors duration-200 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-[#0A0A0A] text-sm">{p.name}</div>
                    {p.dob && <div className="text-gray-500 text-[11px]">DOB: {p.dob}</div>}
                  </td>

                  <td className="px-6 py-4 font-mono text-xs text-gray-700 space-y-0.5">
                    <div className="font-semibold text-[#0A0A0A]">{p.phone}</div>
                    {p.email && <div className="text-gray-500 text-[11px]">{p.email}</div>}
                  </td>

                  <td className="px-6 py-4 text-gray-700">
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                      {p.preferred_language || 'English'}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-gray-500 font-mono text-[11px]">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>

                  <td className="px-6 py-4 text-right opacity-80 group-hover:opacity-100 transition-opacity duration-200">
                    <Button variant="outline" size="sm" onClick={() => openPatientDetail(p.id)}>
                      View Profile & History
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD PATIENT MODAL */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Register New Patient"
        subtitle="Create patient record for clinical appointment scheduling and AI voice recognition"
        maxWidth="md"
      >
        <form onSubmit={handleCreatePatient} className="space-y-4 text-xs">
          {addError && (
            <div className="p-3 bg-gray-50 border border-black rounded font-semibold text-black">
              {addError}
            </div>
          )}

          <Input
            label="Full Name *"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Jonathan Miller"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Phone Number *"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+1-555-019-2834"
              helperText="Used by AI Receptionist to identify caller"
            />

            <Input
              label="Email Address"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="patient@example.com"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Date of Birth"
              type="date"
              value={form.dob}
              onChange={(e) => setForm({ ...form, dob: e.target.value })}
            />

            <Select
              label="Preferred Language"
              value={form.preferred_language}
              onChange={(e) => setForm({ ...form, preferred_language: e.target.value })}
              options={[
                { value: 'English', label: 'English' },
                { value: 'Spanish', label: 'Spanish' },
                { value: 'Hindi', label: 'Hindi' },
                { value: 'French', label: 'French' },
              ]}
            />
          </div>

          <Input
            label="Medical Notes / Allergies"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="e.g. Penicillin allergy, hypertension history"
          />

          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
            <Button variant="secondary" size="md" onClick={() => setAddModalOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" size="md" type="submit" loading={addLoading}>
              Save Patient
            </Button>
          </div>
        </form>
      </Modal>

      {/* PATIENT DETAIL MODAL / HISTORY */}
      {selectedPatientId && patientDetail && (
        <Modal
          isOpen={true}
          onClose={() => {
            setSelectedPatientId(null);
            setPatientDetail(null);
          }}
          title={patientDetail.patient.name}
          subtitle={`Phone: ${patientDetail.patient.phone} • Language: ${patientDetail.patient.preferred_language || 'English'}`}
          maxWidth="lg"
        >
          <div className="space-y-5 text-xs">
            {/* Notes banner */}
            {patientDetail.patient.notes && (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                <span className="font-semibold text-gray-700 uppercase tracking-wider text-[10px] block mb-0.5">
                  Clinical Notes
                </span>
                <p className="text-gray-800">{patientDetail.patient.notes}</p>
              </div>
            )}

            {/* Appointment History */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#0A2540] mb-2 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Appointment History ({patientDetail.appointments.length})</span>
              </h4>

              {patientDetail.appointments.length === 0 ? (
                <p className="text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded">
                  No appointments on record.
                </p>
              ) : (
                <div className="divide-y divide-gray-100 border border-gray-200 rounded max-h-48 overflow-y-auto">
                  {patientDetail.appointments.map((a) => (
                    <div key={a.id} className="p-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-semibold font-mono text-[#0A0A0A]">
                          {a.date} at {a.start_time}
                        </span>
                        <span className="text-gray-500 ml-2">with {a.doctor_name}</span>
                      </div>
                      <Badge status={a.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI Calls History */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#0A2540] mb-2 flex items-center gap-1.5">
                <PhoneCall className="w-3.5 h-3.5" />
                <span>AI Inbound Call History ({patientDetail.calls.length})</span>
              </h4>

              {patientDetail.calls.length === 0 ? (
                <p className="text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded">
                  No recorded phone calls from this patient.
                </p>
              ) : (
                <div className="divide-y divide-gray-100 border border-gray-200 rounded max-h-48 overflow-y-auto">
                  {patientDetail.calls.map((c) => (
                    <div key={c.id} className="p-2.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-gray-500 text-[11px]">
                          {new Date(c.start_time).toLocaleString()} ({c.duration_seconds}s)
                        </span>
                        <Badge status={c.outcome} />
                      </div>
                      {c.summary && <p className="text-gray-700 text-[11px]">{c.summary}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSelectedPatientId(null);
                  setPatientDetail(null);
                }}
              >
                Close Profile
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
