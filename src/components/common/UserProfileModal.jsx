import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';
import Badge from './Badge';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { validatePhone } from '../../utils/validation';
import { User, Lock, Shield, Building, Mail, Phone, Calendar } from 'lucide-react';

export const UserProfileModal = ({ isOpen, onClose }) => {
  const { user, userRole, branch, company, updateProfile, changePassword, fetchUserProfile } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'password'

  // Profile Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password Form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
    }
  }, [isOpen, user]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Name cannot be empty', 'warning');
      return;
    }
    if (!email.trim()) {
      showToast('Email cannot be empty', 'warning');
      return;
    }
    if (phone?.trim()) {
      const phoneErr = validatePhone(phone, { required: false, fieldName: 'Phone number' });
      if (phoneErr) {
        showToast(phoneErr, 'warning');
        return;
      }
    }

    setSavingProfile(true);
    try {
      await updateProfile({ name: name.trim(), email: email.trim(), phone: phone.trim() });
      showToast('Profile updated successfully!', 'success');
      onClose();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to update profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      showToast('Please enter both current and new password', 'warning');
      return;
    }
    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters long', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'warning');
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword({ currentPassword, newPassword });
      showToast('Password changed successfully!', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onClose();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to change password', 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="User Profile & Account Settings">
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          style={{
            padding: '10px 16px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'profile' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'profile' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.88rem',
          }}
        >
          Profile Details
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('password')}
          style={{
            padding: '10px 16px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'password' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'password' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.88rem',
          }}
        >
          Security & Password
        </button>
      </div>

      {activeTab === 'profile' ? (
        <div>
          {/* Identity Card */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: 14,
              borderRadius: 10,
              backgroundColor: 'var(--bg-subtle, rgba(0,0,0,0.02))',
              border: '1px solid var(--border)',
              marginBottom: 18,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                backgroundColor: 'var(--primary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1.1rem',
              }}
            >
              {(user?.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.98rem' }}>{user?.name || 'User'}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{user?.email}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                <Badge variant="primary">{userRole}</Badge>
                <Badge variant={user?.isActive !== false ? 'success' : 'danger'}>
                  {user?.isActive !== false ? 'Active Account' : 'Deactivated'}
                </Badge>
                {branch?.name && <Badge variant="secondary">{branch.name}</Badge>}
              </div>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile}>
            <Input
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Name"
              required
            />
            <Input
              label="Email Address (Login ID)"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your Email"
              required
            />
            <Input
              label="Phone Number"
              type="tel"
              isPhone={true}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit phone number"
            />

            <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
              <Button variant="primary" type="submit" loading={savingProfile}>
                Save Changes
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <form onSubmit={handleChangePassword}>
          <div style={{ marginBottom: 14, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            Enter your current password and pick a new secure password (min 6 characters).
          </div>

          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
            required
          />

          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minimum 6 characters"
            required
          />

          <Input
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            required
          />

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={changingPassword}>
              Change Password
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default UserProfileModal;
