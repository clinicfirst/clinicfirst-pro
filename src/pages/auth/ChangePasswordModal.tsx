import React, { useState } from 'react';
import { Lock, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { apiRequest } from '../../api';

export const ChangePasswordModal: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user || !user.must_change_password) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      });

      if (res.user) {
        updateUser(res.user);
      } else {
        updateUser({ ...user, must_change_password: false });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={() => {}} // Forced: cannot dismiss until password updated
      title="Security Requirement: Update Temporary Password"
      subtitle="Your account was created with a temporary password. Please set a secure password to proceed."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-gray-50 border border-black rounded text-xs font-semibold text-black">
            {error}
          </div>
        )}

        <Input
          label="New Password"
          type="password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="At least 8 characters"
          helperText="Must be at least 8 characters"
          icon={<Lock className="w-4 h-4" />}
        />

        <Input
          label="Confirm New Password"
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Repeat new password"
          icon={<Lock className="w-4 h-4" />}
        />

        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            size="md"
            className="w-full"
            loading={loading}
            icon={<Check className="w-4 h-4" />}
          >
            Save Password & Continue
          </Button>
        </div>
      </form>
    </Modal>
  );
};
