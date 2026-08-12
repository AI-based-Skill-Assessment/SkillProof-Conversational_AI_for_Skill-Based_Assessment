import { useState } from 'react';
import { useAuth } from '../../core/auth/AuthContext';
import { useToast } from '../../components/common/Toast';
import client from '../../core/api/client';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate } from '../../utils/formatDate';

export default function Profile() {
  const { user, logout } = useAuth();
  const toast = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handlePasswordChange(e) {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;

    try {
      setLoading(true);
      await client.post('/auth/me/change-password', {
        current_password: currentPassword,
        new_password: newPassword
      });
      toast.success('Password updated', 'Your password has been changed.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      toast.error('Update failed', err.response?.data?.detail || 'Incorrect current password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="anim-fade-in" style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="page-header">
        <h2 className="page-header__title">Candidate Profile</h2>
        <p className="page-header__subtitle">Manage your verified candidate identity, security settings, and biometric statuses</p>
      </div>

      {/* Profile Details Card */}
      <Card>
        <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 60, height: 60, borderRadius: '50%',
              background: 'var(--primary)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, fontWeight: 700
            }}>
              {user?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>{user?.full_name || 'Candidate Name'}</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{user?.email}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, borderTop: '1px solid var(--border)', paddingTop: 20, fontSize: 14 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Account Type:</div>
            <div style={{ textTransform: 'capitalize' }}>{user?.account_type || 'individual'}</div>

            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Verified Status:</div>
            <div>
              <StatusBadge variant={user?.email_verified ? 'success' : 'warning'}>
                {user?.email_verified ? 'Email Verified' : 'Pending Verification'}
              </StatusBadge>
            </div>

            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Face ID Registry:</div>
            <div>
              <StatusBadge variant={user?.face_registered ? 'success' : 'neutral'}>
                {user?.face_registered ? 'Registered' : 'Not Registered'}
              </StatusBadge>
            </div>

            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Voice ID Registry:</div>
            <div>
              <StatusBadge variant={user?.voice_registered ? 'success' : 'neutral'}>
                {user?.voice_registered ? 'Registered' : 'Not Registered'}
              </StatusBadge>
            </div>

            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Member Since:</div>
            <div>{formatDate(user?.created_at)}</div>
          </div>
        </CardBody>
      </Card>

      {/* Change Password Card */}
      <Card>
        <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
        <CardBody>
          <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input
              label="Current Password"
              type="password"
              id="profile-curr-pass"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <Input
              label="New Password"
              type="password"
              id="profile-new-pass"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <Button type="submit" loading={loading}>
              Change Password
            </Button>
          </form>
        </CardBody>
      </Card>

      {/* Danger Zone Card */}
      <Card>
        <CardHeader><CardTitle>Danger Zone</CardTitle></CardHeader>
        <CardBody>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--error)' }}>Log Out of All Devices</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Clears all active JWT session keys from storage.
              </div>
            </div>
            <Button variant="danger" onClick={logout}>
              Log Out
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
