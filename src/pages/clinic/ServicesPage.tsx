import { showToast } from '../../components/common/Toast';
import React, { useState, useEffect } from 'react';
import { Settings, Plus, DollarSign, Clock, Check, Edit2 } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { Input } from '../../components/common/Input';
import { apiRequest } from '../../api';
import { Service, Doctor } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { can } from '../../lib/permissions';

export const ServicesPage: React.FC = () => {
  const { user, clinic } = useAuth();
  const currencySymbol = clinic?.currency_symbol || '$';
  const [services, setServices] = useState<Service[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  // Add/Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [confirmStatusService, setConfirmStatusService] = useState<Service | null>(null);
  const [form, setForm] = useState({
    name: '',
    duration_minutes: 30,
    fee: 100,
    assigned_doctor_ids: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [srvsRes, docsRes] = await Promise.all([
        apiRequest<{ services: Service[] }>('/api/clinic/services'),
        apiRequest<{ doctors: Doctor[] }>('/api/clinic/doctors'),
      ]);
      setServices(srvsRes.services);
      setDoctors(docsRes.doctors);
    } catch (err) {
      console.error('Failed to load services:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddModal = () => {
    setEditingService(null);
    setForm({
      name: '',
      duration_minutes: 30,
      fee: 120,
      assigned_doctor_ids: doctors.map((d) => d.id),
    });
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (service: Service) => {
    setEditingService(service);
    setForm({
      name: service.name,
      duration_minutes: service.duration_minutes,
      fee: service.fee,
      assigned_doctor_ids: service.assigned_doctor_ids || [],
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      if (editingService) {
        await apiRequest(`/api/clinic/services/${editingService.id}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
      } else {
        await apiRequest('/api/clinic/services', {
          method: 'POST',
          body: JSON.stringify(form),
        });
      }

      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to save service');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (srv: Service) => {
    const nextStatus = srv.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await apiRequest(`/api/clinic/services/${srv.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      });
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update service status', 'error');
    }
  };

  const toggleDoctorAssignment = (docId: string) => {
    if (form.assigned_doctor_ids.includes(docId)) {
      setForm({
        ...form,
        assigned_doctor_ids: form.assigned_doctor_ids.filter((id) => id !== docId),
      });
    } else {
      setForm({
        ...form,
        assigned_doctor_ids: [...form.assigned_doctor_ids, docId],
      });
    }
  };

  const canManage = can(user, 'manage_services');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-[#0A0A0A] tracking-tight">Services & Procedures</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure clinical consultation offerings, consultation durations, standard fees, and assigned physicians.
          </p>
        </div>

        {canManage && (
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={openAddModal}
          >
            Add New Service
          </Button>
        )}
      </div>

      {/* Services Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/75 border-b border-gray-200 text-gray-700 uppercase font-semibold text-[11px] tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Service Name</th>
                <th className="px-6 py-3.5">Duration</th>
                <th className="px-6 py-3.5">Standard Fee</th>
                <th className="px-6 py-3.5">Assigned Doctors</th>
                <th className="px-6 py-3.5">Status</th>
                {canManage && <th className="px-6 py-3.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-normal">
              {services.map((srv) => (
                <tr key={srv.id} className="group hover:bg-[#F8FAFC] transition-colors duration-200 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-[#0A0A0A] text-sm">{srv.name}</div>
                  </td>

                  <td className="px-6 py-4 font-mono text-gray-700">
                    <span className="px-2 py-0.5 bg-gray-100 rounded">
                      {srv.duration_minutes} minutes
                    </span>
                  </td>

                  <td className="px-6 py-4 font-mono text-gray-900 font-semibold">
                    {currencySymbol}{srv.fee}
                  </td>

                  <td className="px-6 py-4 text-gray-600">
                    {srv.assigned_doctor_ids?.length
                      ? `${srv.assigned_doctor_ids.length} Doctor(s) Assigned`
                      : 'All Clinic Doctors'}
                  </td>

                  <td className="px-6 py-4">
                    <Badge status={srv.status} />
                  </td>

                  {canManage && (
                    <td className="px-6 py-4 text-right space-x-2 opacity-80 group-hover:opacity-100 transition-opacity duration-200">
                      <Button variant="outline" size="sm" onClick={() => openEditModal(srv)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmStatusService(srv)}
                        className={srv.status === 'ACTIVE' ? 'text-gray-600' : 'text-[#0A2540] font-semibold'}
                      >
                        {srv.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD/EDIT MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingService ? `Edit Service: ${editingService.name}` : 'Create Clinical Service'}
        subtitle="Services define the consultation duration and fee used by the AI Receptionist and booking calendar."
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-gray-50 border border-black rounded font-semibold text-black">
              {error}
            </div>
          )}

          <Input
            label="Service Title *"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Echocardiogram & Consultation"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Duration (Minutes) *"
              type="number"
              min={10}
              max={180}
              step={5}
              required
              value={form.duration_minutes}
              onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
            />

            <Input
              label={`Standard Consultation Fee (${currencySymbol})`}
              type="number"
              min={0}
              step={5}
              value={form.fee}
              onChange={(e) => setForm({ ...form, fee: Number(e.target.value) })}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
              Assigned Doctors
            </label>
            <div className="space-y-1.5 max-h-36 overflow-y-auto p-2 border border-gray-200 rounded">
              {doctors.map((d) => {
                const isAssigned = form.assigned_doctor_ids.includes(d.id);
                return (
                  <label
                    key={d.id}
                    className="flex items-center gap-2 text-xs text-[#0A0A0A] cursor-pointer group hover:bg-[#F8FAFC] transition-colors duration-200 p-1 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={isAssigned}
                      onChange={() => toggleDoctorAssignment(d.id)}
                      className="rounded border-gray-300 text-[#0A2540] focus:ring-[#0A2540]"
                    />
                    <span>
                      {d.name} ({d.specialization})
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
            <Button variant="secondary" size="md" onClick={() => setModalOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" size="md" type="submit" loading={saving}>
              {editingService ? 'Save Changes' : 'Create Service'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirmation Modals */}
      <ConfirmModal
        isOpen={!!confirmStatusService}
        onClose={() => setConfirmStatusService(null)}
        onConfirm={() => {
          if (confirmStatusService) {
            toggleStatus(confirmStatusService);
            setConfirmStatusService(null);
          }
        }}
        title={`Confirm ${confirmStatusService?.status === 'ACTIVE' ? 'Deactivation' : 'Activation'}`}
        message={`Are you sure you want to ${confirmStatusService?.status === 'ACTIVE' ? 'deactivate' : 'activate'} the service "${confirmStatusService?.name}"?`}
        confirmText={`Yes, ${confirmStatusService?.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}`}
        destructive={confirmStatusService?.status === 'ACTIVE'}
      />
    </div>
  );
};
