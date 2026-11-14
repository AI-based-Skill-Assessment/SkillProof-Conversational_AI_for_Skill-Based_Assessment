import { useState } from 'react';
import { useAuth } from '../../core/auth/AuthContext';
import { useToast } from '../../components/common/Toast';
import client from '../../core/api/client';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/common/Card';

export default function Settings() {
  const { user, logout, updateUserCache } = useAuth();
  const [deletingBio, setDeletingBio] = useState(false);

  async function handleDeleteBiometrics() {
    const ok = window.confirm(
      'Delete your face and voice data? Your stored face and voice templates will be erased from your account and '
      + 'from all your assessments. Your scores and reports stay. You will need to register again before your next assessment.'
    );
    if (!ok) return;
    try {
      setDeletingBio(true);
      await client.delete('/auth/me/biometrics');
      updateUserCache({ ...user, face_registered: false, voice_registered: false });
      toast.success('Biometric data deleted', 'Your face and voice data has been erased.');
    } catch (err) {
      toast.error('Could not delete', err.response?.data?.detail || 'Please try again.');
    } finally {
      setDeletingBio(false);
    }
  }
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
        <CardHeader><CardTitle>Your Biometric Data</CardTitle></CardHeader>
        <CardBody>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 260px' }}>
              <div style={{ fontWeight: 600 }}>Delete my face &amp; voice data</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
                SkillProof stores numeric face and voice templates (not photos or recordings) to confirm it is you during
                interviews. Per-assessment copies are erased automatically after a retention period; this erases all of them now.
              </div>
            </div>
            <Button variant="danger" onClick={handleDeleteBiometrics} loading={deletingBio}
              disabled={!user?.face_registered && !user?.voice_registered}>
              {user?.face_registered || user?.voice_registered ? 'Delete biometric data' : 'Nothing stored'}
            </Button>
          </div>
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
