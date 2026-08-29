import { showToast } from '../../components/common/Toast';
import React, { useState, useEffect } from 'react';
import { Users, Plus, Key, Check, ShieldAlert, Mail, Phone, Lock, Shield, Settings, Sliders } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { Input } from '../../components/common/Input';
import { apiRequest } from '../../api';
import { User, StaffPermissions } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { can, DEFAULT_STAFF_PERMISSIONS } from '../../lib/permissions';

const MODULE_DEFINITIONS: Array<{
  key: keyof StaffPermissions;
  label: string;
  description: string;
  levels: Array<{ value: 'NONE' | 'READ' | 'EDIT'; label: string }>;
}> = [
  {
    key: 'appointments',
    label: 'Appointments & Scheduling',
    description: 'Controls booking, rescheduling, cancellations, and status check-ins.',
    levels: [
      { value: 'NONE', label: 'No Access' },
      { value: 'READ', label: 'View Only' },
      { value: 'EDIT', label: 'Full Access (Book, Edit, Cancel)' },
    ],
  },
  {
    key: 'patients',
    label: 'Patients Directory',
    description: 'Controls viewing patient histories and registering walk-in/new patients.',
    levels: [
      { value: 'NONE', label: 'No Access' },
      { value: 'READ', label: 'View Only' },
      { value: 'EDIT', label: 'Full Access (Register & Edit)' },
    ],
  },
  {
    key: 'calls',
    label: 'AI Call Logs & Escalations',
    description: 'Controls viewing incoming call transcripts and resolving callback escalations.',
    levels: [
      { value: 'NONE', label: 'No Access' },
      { value: 'READ', label: 'View Only' },
      { value: 'EDIT', label: 'Full Access (Resolve Callbacks)' },
    ],
  },
  {
    key: 'schedules',
    label: 'Doctor Shifts & Leaves',
    description: 'Controls inspecting physician availability vs configuring weekly duty hours.',
    levels: [
      { value: 'NONE', label: 'No Access' },
      { value: 'READ', label: 'View Availability Only' },
      { value: 'EDIT', label: 'Manage Shifts & Leaves' },
    ],
  },
  {
    key: 'doctors',
    label: 'Doctors Directory',
    description: 'Controls viewing doctor specializations vs adding/updating practitioners.',
    levels: [
      { value: 'NONE', label: 'No Access' },
      { value: 'READ', label: 'View Directory Only' },
      { value: 'EDIT', label: 'Manage Doctors' },
    ],
  },
  {
    key: 'services',
    label: 'Services & Pricing',
    description: 'Controls viewing consultation menu vs modifying fees and durations.',
    levels: [
      { value: 'NONE', label: 'No Access' },
      { value: 'READ', label: 'View Services Only' },
      { value: 'EDIT', label: 'Manage Services & Fees' },
    ],
  },
  {
    key: 'ai_receptionist',
    label: 'AI Receptionist Core',
    description: 'Controls testing phone calls vs reconfiguring voice models and greeting scripts.',
    levels: [
      { value: 'NONE', label: 'No Access' },
      { value: 'READ', label: 'Test & Monitor Only' },
      { value: 'EDIT', label: 'Configure Receptionist' },
    ],
  },
];

export const StaffPage: React.FC = () => {
  const { user } = useAuth();
  const canManageStaff = can(user, 'manage_staff');

  const [staffList, setStaffList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Staff Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    tempPassword: 'StaffPassword2026!',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset Password Modal
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<User | null>(null);
  const [newTempPassword, setNewTempPassword] = useState('StaffPassword2026!');
  const [resetLoading, setResetLoading] = useState(false);

  // Permissions Modal
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const [editingPermissions, setEditingPermissions] = useState<StaffPermissions>(DEFAULT_STAFF_PERMISSIONS);
  const [permStaff, setPermStaff] = useState<User | null>(null);
  const [permLoading, setPermLoading] = useState(false);
  const [confirmStatusStaff, setConfirmStatusStaff] = useState<User | null>(null);

  const fetchStaff = async () => {
    if (!canManageStaff) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await apiRequest<{ staff: User[] }>('/api/clinic/staff');
      setStaffList(res.staff);
    } catch (err) {
      console.error('Failed to load staff list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [canManageStaff]);

  // Security gate: If current user is not a Clinic Admin, block access immediately
  if (!canManageStaff) {
    return (
      <div className="max-w-2xl mx-auto mt-8 p-6 bg-white border border-[#E2E8F0] rounded-xl shadow-xs text-center space-y-4">
        <div className="w-12 h-12 bg-[#0A2540]/10 text-[#0A2540] rounded-full flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-base font-bold text-[#172B3A]">Staff Management Access Restricted</h2>
          <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
            Staff account administration, temporary credential generation, and component access control are reserved exclusively for the <strong>Clinic Administrator</strong>.
          </p>
        </div>
        <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#64748B] text-left">
          <span className="font-semibold text-[#172B3A] block mb-1">Your Operational Role:</span>
          You are currently logged in as a <strong>Clinic Staff / Receptionist</strong> member. You have active access to your assigned operational modules (Dashboard, Appointments, Patients, and AI Call verification).
        </div>
      </div>
    );
  }

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      await apiRequest('/api/clinic/staff', {
        method: 'POST',
        body: JSON.stringify(form),
      });

      setForm({
        name: '',
        email: '',
        phone: '',
        tempPassword: 'StaffPassword2026!',
      });
      setAddModalOpen(false);
      showToast('New staff member account created successfully.', 'success');
      fetchStaff();
    } catch (err: any) {
      setError(err.message || 'Failed to add staff member');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    setResetLoading(true);

    try {
      await apiRequest(`/api/clinic/staff/${selectedStaff.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newTempPassword }),
      });

      setResetModalOpen(false);
      setSelectedStaff(null);
      showToast(`Temporary password for ${selectedStaff.name} has been reset. They will be required to change it upon next login.`, 'success');
      fetchStaff();
    } catch (err: any) {
      showToast(err.message || 'Failed to reset password', 'error');
    } finally {
      setResetLoading(false);
    }
  };

  const toggleStatus = async (staffMember: User) => {
    const nextStatus = staffMember.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await apiRequest(`/api/clinic/staff/${staffMember.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      });
      showToast(`Staff member status updated to ${nextStatus}.`, 'success');
      fetchStaff();
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#0A0A0A] tracking-tight">Clinic Staff & Access Control</h1>
            <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[#0A2540]/10 text-[#0A2540] rounded">
              Clinic Admin Access Only
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage front-desk receptionists, assign or revoke component permissions, and issue temporary credentials.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setAddModalOpen(true)}
        >
          Add Staff Member
        </Button>
      </div>

      {/* Staff Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/75 border-b border-gray-200 text-gray-700 uppercase font-semibold text-[11px] tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Staff Member</th>
                <th className="px-6 py-3.5">Role</th>
                <th className="px-6 py-3.5">Credentials Status</th>
                <th className="px-6 py-3.5">Account Status</th>
                <th className="px-6 py-3.5 text-right">Access Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-normal">
              {staffList.map((s) => (
                <tr key={s.id} className="group hover:bg-[#F8FAFC] transition-colors duration-200">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-[#0A0A0A] text-sm">{s.name}</div>
                    <div className="text-gray-500 font-mono text-[11px] mt-0.5">{s.email}</div>
                    {s.phone && <div className="text-gray-400 font-mono text-[10px]">{s.phone}</div>}
                  </td>

                  <td className="px-6 py-4">
                    <Badge status={s.role} />
                  </td>

                  <td className="px-6 py-4 text-xs font-mono">
                    {s.must_change_password ? (
                      <span className="text-[#0A2540] font-semibold flex items-center gap-1">
                        <Key className="w-3.5 h-3.5" /> Must Reset on Login
                      </span>
                    ) : (
                      <span className="text-gray-500">Active / Verified</span>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    <Badge status={s.status} />
                  </td>

                  <td className="px-6 py-4 text-right space-x-2 opacity-80 group-hover:opacity-100 transition-opacity duration-200">
                    {s.role !== 'CLINIC_ADMIN' && (
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<Sliders className="w-3.5 h-3.5" />}
                        onClick={() => {
                          setPermStaff(s);
                          const currentPerms = s.permissions || DEFAULT_STAFF_PERMISSIONS;
                          setEditingPermissions({
                            ...DEFAULT_STAFF_PERMISSIONS,
                            ...currentPerms,
                            staff: 'NONE', // Enforce staff cannot manage staff
                          });
                          setPermissionsModalOpen(true);
                        }}
                      >
                        Component Access
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Key className="w-3 h-3" />}
                      onClick={() => {
                        setSelectedStaff(s);
                        setResetModalOpen(true);
                      }}
                    >
                      Reset Password
                    </Button>

                    {s.role !== 'CLINIC_ADMIN' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmStatusStaff(s)}
                        className={s.status === 'ACTIVE' ? 'text-gray-600' : 'text-[#0A2540] font-semibold'}
                      >
                        {s.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD STAFF MODAL */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Clinic Staff Member"
        subtitle="Creates a receptionist/staff account with temporary credentials and forced first-time password change."
        maxWidth="md"
      >
        <form onSubmit={handleAddStaff} className="space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded font-semibold">
              {error}
            </div>
          )}

          <Input
            label="Staff Full Name *"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Jessica Adams"
          />

          <Input
            label="Staff Work Email *"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="jessica@clinic.com"
          />

          <Input
            label="Phone Number"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+1-555-019-3322"
          />

          <Input
            label="Temporary Initial Password *"
            type="password"
            required
            value={form.tempPassword}
            onChange={(e) => setForm({ ...form, tempPassword: e.target.value })}
            helperText="User will be forced to choose a new password when they log in"
          />

          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
            <Button variant="secondary" size="md" onClick={() => setAddModalOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" size="md" type="submit" loading={saving}>
              Create Staff Account
            </Button>
          </div>
        </form>
      </Modal>

      {/* RESET PASSWORD MODAL */}
      {selectedStaff && (
        <Modal
          isOpen={resetModalOpen}
          onClose={() => setResetModalOpen(false)}
          title={`Reset Temporary Password for ${selectedStaff.name}`}
          subtitle="Staff member will be prompted to set a permanent password upon next login."
          maxWidth="md"
        >
          <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
            <Input
              label="New Temporary Password *"
              type="password"
              required
              value={newTempPassword}
              onChange={(e) => setNewTempPassword(e.target.value)}
              placeholder="At least 8 chars"
            />

            <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
              <Button variant="secondary" size="md" onClick={() => setResetModalOpen(false)} type="button">
                Cancel
              </Button>
              <Button variant="primary" size="md" type="submit" loading={resetLoading}>
                Confirm Password Reset
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* GRANULAR PERMISSIONS & ACCESS CONTROL MODAL */}
      {permStaff && editingPermissions && (
        <Modal
          isOpen={permissionsModalOpen}
          onClose={() => setPermissionsModalOpen(false)}
          title={`Access Control: ${permStaff.name}`}
          subtitle="Clinic Administrator control: assign or revoke access to clinical components for this staff member."
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#64748B]">
              <span className="font-semibold text-[#172B3A] block mb-0.5">Role Governance Rule:</span>
              Staff members cannot add other staff, modify clinic settings, or change security configurations. Select which operational modules this receptionist can view or manage.
            </div>

            <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden bg-white">
              {MODULE_DEFINITIONS.map((mod) => (
                <div key={mod.key} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F8FAFC] transition-colors">
                  <div className="space-y-0.5 max-w-sm">
                    <span className="font-bold text-[#172B3A] text-xs block">{mod.label}</span>
                    <p className="text-[11px] text-gray-500 leading-tight">{mod.description}</p>
                  </div>

                  <div className="shrink-0">
                    <select
                      className="px-3 py-1.5 border border-gray-300 rounded text-xs font-semibold focus:outline-none focus:border-[#0A2540] bg-white text-[#172B3A] min-w-[180px]"
                      value={editingPermissions[mod.key] || 'NONE'}
                      onChange={(e) =>
                        setEditingPermissions({
                          ...editingPermissions,
                          [mod.key]: e.target.value as 'NONE' | 'READ' | 'EDIT',
                        })
                      }
                    >
                      {mod.levels.map((lvl) => (
                        <option key={lvl.value} value={lvl.value}>
                          {lvl.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3 mt-4">
              <Button variant="secondary" size="md" onClick={() => setPermissionsModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                loading={permLoading}
                onClick={async () => {
                  setPermLoading(true);
                  try {
                    const finalPermissions = {
                      ...editingPermissions,
                      staff: 'NONE' as const, // Strict enforcement: staff can never access staff management
                    };
                    await apiRequest(`/api/clinic/staff/${permStaff.id}`, {
                      method: 'PUT',
                      body: JSON.stringify({ permissions: finalPermissions }),
                    });
                    showToast(`Access rights updated for ${permStaff.name}.`, 'success');
                    setPermissionsModalOpen(false);
                    fetchStaff();
                  } catch (err: any) {
                    showToast(err.message || 'Failed to save access controls', 'error');
                  } finally {
                    setPermLoading(false);
                  }
                }}
              >
                Save Access Controls
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation Modals */}
      <ConfirmModal
        isOpen={!!confirmStatusStaff}
        onClose={() => setConfirmStatusStaff(null)}
        onConfirm={() => {
          if (confirmStatusStaff) {
            toggleStatus(confirmStatusStaff);
            setConfirmStatusStaff(null);
          }
        }}
        title={`Confirm ${confirmStatusStaff?.status === 'ACTIVE' ? 'Deactivation' : 'Activation'}`}
        message={`Are you sure you want to ${confirmStatusStaff?.status === 'ACTIVE' ? 'deactivate' : 'activate'} staff member ${confirmStatusStaff?.name}?`}
        confirmText={`Yes, ${confirmStatusStaff?.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}`}
        destructive={confirmStatusStaff?.status === 'ACTIVE'}
      />
    </div>
  );
};

