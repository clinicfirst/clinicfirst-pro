import { showToast } from '../../components/common/Toast';
import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Shield,
  Building2,
  Mail,
  Phone,
  Check,
  Lock,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { apiRequest } from '../../api';
import { User, Clinic } from '../../types';

interface EnrichedUser extends User {
  clinic_name: string;
}

export const PlatformUsers: React.FC = () => {
  const [users, setUsers] = useState<EnrichedUser[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [clinicFilter, setClinicFilter] = useState<string>('ALL');

  // Create User Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'PLATFORM_ADMIN' as 'PLATFORM_ADMIN' | 'CLINIC_ADMIN' | 'CLINIC_STAFF',
    clinic_id: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, clinicsRes] = await Promise.all([
        apiRequest<{ users: EnrichedUser[] }>('/api/platform/users'),
        apiRequest<{ clinics: Clinic[] }>('/api/platform/clinics'),
      ]);
      setUsers(usersRes.users);
      setClinics(clinicsRes.clinics);
    } catch (err) {
      console.error('Failed to fetch platform users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);

    try {
      await apiRequest('/api/platform/users', {
        method: 'POST',
        body: JSON.stringify(form),
      });

      setForm({
        name: '',
        email: '',
        phone: '',
        password: '',
        role: 'PLATFORM_ADMIN',
        clinic_id: '',
      });
      setCreateModalOpen(false);
      fetchData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create user');
    } finally {
      setFormLoading(false);
    }
  };

  const toggleUserStatus = async (targetUser: EnrichedUser) => {
    const nextStatus = targetUser.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await apiRequest(`/api/platform/users/${targetUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      });
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update user status', 'error');
    }
  };

  const filtered = users.filter((u) => {
    const matchSearch =
      (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.clinic_name || '').toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchClinic = clinicFilter === 'ALL' || u.clinic_id === clinicFilter || (clinicFilter === 'PLATFORM' && !u.clinic_id);
    return matchSearch && matchRole && matchClinic;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-[#0A0A0A] tracking-tight">Platform Users</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Directory of Platform Administrators, Clinic Administrators, and Clinic Staff accounts.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setCreateModalOpen(true)}
        >
          Create User
        </Button>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col xl:flex-row xl:items-center gap-4">
        <div className="w-full xl:w-80">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, clinic..."
            icon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Role:</span>
            {(['ALL', 'PLATFORM_ADMIN', 'CLINIC_ADMIN', 'CLINIC_STAFF'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-2.5 py-1 text-xs font-medium rounded cursor-pointer transition-colors ${
                  roleFilter === r
                    ? 'bg-[#0A2540] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {r === 'ALL' ? 'All Roles' : r.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Clinic:</span>
            <select
              value={clinicFilter}
              onChange={(e) => setClinicFilter(e.target.value)}
              className="px-2.5 py-1 text-xs font-medium rounded border border-gray-200 bg-white text-gray-700 hover:border-gray-300 focus:outline-none focus:border-[#0A2540] transition-colors max-w-xs"
            >
              <option value="ALL">All Clinics & Platform</option>
              <option value="PLATFORM">Platform Level (No Clinic)</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/75 border-b border-gray-200 text-gray-700 uppercase font-semibold text-[11px] tracking-wider">
              <tr>
                <th className="px-6 py-3.5">User Name & Contact</th>
                <th className="px-6 py-3.5">Role</th>
                <th className="px-6 py-3.5">Clinic Scope</th>
                <th className="px-6 py-3.5">Account Status</th>
                <th className="px-6 py-3.5">Created</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-normal">
              {filtered.map((u, idx) => (
                <tr key={`${u.id}_${u.email || idx}`} className="group hover:bg-[#F8FAFC] transition-colors duration-200 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-[#0A0A0A] text-sm">{u.name}</div>
                    <div className="text-gray-500 text-xs mt-0.5 flex items-center gap-2">
                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        <Mail className="w-3 h-3 text-gray-400" />
                        {u.email}
                      </span>
                      {u.phone && (
                        <span className="flex items-center gap-1 font-mono text-[11px]">
                          <Phone className="w-3 h-3 text-gray-400" />
                          {u.phone}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <Badge status={u.role} />
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-gray-700">
                      <Building2 className="w-3.5 h-3.5 text-[#0A2540]" />
                      <span className="font-medium">{u.clinic_name}</span>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <Badge status={u.status} />
                  </td>

                  <td className="px-6 py-4 font-mono text-gray-400 text-[11px]">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>

                  <td className="px-6 py-4 text-right opacity-80 group-hover:opacity-100 transition-opacity duration-200">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleUserStatus(u)}
                      className={u.status === 'ACTIVE' ? 'text-gray-600' : 'text-[#0A2540] font-semibold'}
                    >
                      {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Platform or Clinic User"
        subtitle="Provision user credentials with explicit role authorization."
        maxWidth="md"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          {formError && (
            <div className="p-3 bg-gray-50 border border-black rounded text-xs font-semibold text-black">
              {formError}
            </div>
          )}

          <div className="space-y-3">
            <Input
              label="Full Name *"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. John Doe"
            />

            <Input
              label="Login Email *"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="user@example.com"
            />

            <Input
              label="Phone Number"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+1-555-010-0000"
            />

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                User Role *
              </label>
              <select
                value={form.role}
                onChange={(e) =>
                  setForm({
                    ...form,
                    role: e.target.value as any,
                    clinic_id: e.target.value === 'PLATFORM_ADMIN' ? '' : form.clinic_id,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-xs text-[#0A0A0A] focus:outline-none focus:border-[#0A2540]"
              >
                <option value="PLATFORM_ADMIN">PLATFORM_ADMIN (Global System Access)</option>
                <option value="CLINIC_ADMIN">CLINIC_ADMIN (Tenant Administrator)</option>
                <option value="CLINIC_STAFF">CLINIC_STAFF (Daily Clinic Operations)</option>
              </select>
            </div>

            {form.role !== 'PLATFORM_ADMIN' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                  Assign to Clinic *
                </label>
                <select
                  required
                  value={form.clinic_id}
                  onChange={(e) => setForm({ ...form, clinic_id: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-xs text-[#0A0A0A] focus:outline-none focus:border-[#0A2540]"
                >
                  <option value="">-- Select Clinic Tenant --</option>
                  {clinics.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.city})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Input
              label="Temporary Password *"
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="At least 8 chars"
              helperText="User will be prompted to reset upon first login."
            />
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
            <Button variant="secondary" size="md" onClick={() => setCreateModalOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" size="md" type="submit" loading={formLoading} icon={<Check className="w-4 h-4" />}>
              Create User
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
