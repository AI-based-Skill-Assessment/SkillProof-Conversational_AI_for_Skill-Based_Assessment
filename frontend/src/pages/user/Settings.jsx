import { useState } from 'react';
import { useAuth } from '../../core/auth/AuthContext';
import { useToast } from '../../components/common/Toast';
import client from '../../core/api/client';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/common/Card';

export default function Settings() {
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
      await client.post('/auth/me/change-password', { current_password: currentPassword, new_password: newPassword });
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
        <h2 className="page-header__title">Account Settings</h2>
        <p className="page-header__subtitle">Manage password security and platform preferences</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
        <CardBody>
          <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input
              label="Current Password"
              type="password"
              id="set-curr"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <Input
              label="New Password"
              type="password"
              id="set-new"
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
