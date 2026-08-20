import { showToast } from '../../components/common/Toast';
import React, { useState, useEffect } from 'react';
import { Stethoscope, Plus, Phone, Mail, Clock, Check, Edit2, ShieldAlert } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input, Select } from '../../components/common/Input';
import { apiRequest } from '../../api';
import { Doctor } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { can } from '../../lib/permissions';

export const DoctorsPage: React.FC = () => {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  // Add / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [form, setForm] = useState({
    name: '',
    specialization: '',
    qualification: '',
    phone: '',
    email: '',
    consultation_duration_minutes: 30,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ doctors: Doctor[] }>('/api/clinic/doctors');
      setDoctors(res.doctors);
    } catch (err) {
      console.error('Failed to load doctors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const openAddModal = () => {
    setEditingDoctor(null);
    setForm({
      name: '',
      specialization: '',
      qualification: '',
      phone: '',
      email: '',
      consultation_duration_minutes: 30,
    });
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (doc: Doctor) => {
    setEditingDoctor(doc);
    setForm({
      name: doc.name,
      specialization: doc.specialization,
      qualification: doc.qualification || '',
      phone: doc.phone || '',
      email: doc.email || '',
      consultation_duration_minutes: doc.consultation_duration_minutes || 30,
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      if (editingDoctor) {
        await apiRequest(`/api/clinic/doctors/${editingDoctor.id}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
      } else {
        await apiRequest('/api/clinic/doctors', {
          method: 'POST',
          body: JSON.stringify(form),
        });
      }

      setModalOpen(false);
      fetchDoctors();
    } catch (err: any) {
      setError(err.message || 'Failed to save doctor details');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (doc: Doctor) => {
    const nextStatus = doc.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await apiRequest(`/api/clinic/doctors/${doc.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      });
      fetchDoctors();
    } catch (err: any) {
      showToast(err.message || 'Failed to update doctor status', 'error');
    }
  };

  const canManage = can(user, 'manage_doctors');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-[#0A0A0A] tracking-tight">Doctors Directory</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage clinical practitioners, specializations, standard consultation lengths, and availability.
          </p>
        </div>

        {canManage && (
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={openAddModal}
          >
            Add New Doctor
          </Button>
        )}
      </div>

      {/* Doctors Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/75 border-b border-gray-200 text-gray-700 uppercase font-semibold text-[11px] tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Doctor Name & Credentials</th>
                <th className="px-6 py-3.5">Specialization</th>
                <th className="px-6 py-3.5">Standard Duration</th>
                <th className="px-6 py-3.5">Contact Details</th>
                <th className="px-6 py-3.5">Status</th>
                {canManage && <th className="px-6 py-3.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-normal">
              {doctors.map((d) => (
                <tr key={d.id} className="group hover:bg-[#F8FAFC] transition-colors duration-200 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-[#0A0A0A] text-sm flex items-center gap-1.5">
                      <Stethoscope className="w-4 h-4 text-[#0A2540]" />
                      <span>{d.name}</span>
                    </div>
                    {d.qualification && (
                      <div className="text-gray-500 text-[11px] ml-5">{d.qualification}</div>
                    )}
                  </td>

                  <td className="px-6 py-4 font-medium text-[#0A0A0A]">{d.specialization}</td>

                  <td className="px-6 py-4 font-mono text-gray-700">
                    <span className="px-2 py-0.5 bg-gray-100 rounded">
                      {d.consultation_duration_minutes} min
                    </span>
                  </td>

                  <td className="px-6 py-4 text-gray-600 font-mono text-[11px] space-y-0.5">
                    {d.phone && <div>{d.phone}</div>}
                    {d.email && <div className="text-gray-500">{d.email}</div>}
                  </td>

                  <td className="px-6 py-4">
                    <Badge status={d.status} />
                  </td>

                  {canManage && (
                    <td className="px-6 py-4 text-right space-x-2 opacity-80 group-hover:opacity-100 transition-opacity duration-200">
                      <Button variant="outline" size="sm" onClick={() => openEditModal(d)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleStatus(d)}
                        className={d.status === 'ACTIVE' ? 'text-gray-600' : 'text-[#0A2540] font-semibold'}
                      >
                        {d.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingDoctor ? `Edit Doctor: ${editingDoctor.name}` : 'Add New Clinical Doctor'}
        subtitle="Registers physician into clinic directory and automatically provisions standard working schedules."
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-gray-50 border border-black rounded font-semibold text-black">
              {error}
            </div>
          )}

          <Input
            label="Doctor Name *"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Dr. Arthur Vance"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Specialization *"
              required
              value={form.specialization}
              onChange={(e) => setForm({ ...form, specialization: e.target.value })}
              placeholder="e.g. Cardiology"
            />

            <Input
              label="Qualification / Degrees"
              value={form.qualification}
              onChange={(e) => setForm({ ...form, qualification: e.target.value })}
              placeholder="e.g. MD, FACC"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Consultation Length (Minutes)"
              type="number"
              min={10}
              max={120}
              step={5}
              value={form.consultation_duration_minutes}
              onChange={(e) =>
                setForm({ ...form, consultation_duration_minutes: Number(e.target.value) })
              }
              helperText="Slot calculation increment"
            />

            <Input
              label="Direct Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+1-555-010-2211"
            />
          </div>

          <Input
            label="Email Address"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="doctor@clinic.com"
          />

          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
            <Button variant="secondary" size="md" onClick={() => setModalOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" size="md" type="submit" loading={saving}>
              {editingDoctor ? 'Save Changes' : 'Create Doctor'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
