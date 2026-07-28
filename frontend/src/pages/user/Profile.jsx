import { useAuth } from '../../core/auth/AuthContext';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate } from '../../utils/formatDate';

export default function Profile() {
  const { user } = useAuth();

  return (
    <div className="anim-fade-in" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="page-header">
        <h2 className="page-header__title">Candidate Profile</h2>
        <p className="page-header__subtitle">Manage your verified candidate identity and biometric statuses</p>
      </div>

      <Card>
        <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 60, height: 60, borderRadius: '50%',
              background: 'var(--primary)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContext: 'center',
              fontSize: 24, fontWeight: 700,
              justifyContent: 'center'
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
    </div>
  );
}
