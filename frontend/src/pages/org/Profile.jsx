import { useAuth } from '../../core/auth/AuthContext';
import { Card, CardBody } from '../../components/common/Card';
import { formatDate } from '../../utils/formatDate';

export default function Profile() {
  const { user } = useAuth();

  return (
    <div className="anim-fade-in" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="page-header">
        <h2 className="page-header__title">Institution Profile</h2>
        <p className="page-header__subtitle">Review your placement-cell / corporate authority registry information</p>
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
              {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'O'}
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>{user?.name || 'NIT Trichy'}</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{user?.email}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, borderTop: '1px solid var(--border)', paddingTop: 20, fontSize: 14 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Organization Type:</div>
            <div style={{ textTransform: 'capitalize' }}>{user?.org_type || 'university'}</div>

            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Primary Contact:</div>
            <div>{user?.contact_name || 'Dr. Ramesh Kumar'}</div>

            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Contact Phone:</div>
            <div>{user?.contact_phone || '+91-9876543210'}</div>

            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Website Link:</div>
            <div>
              <a href={user?.website} target="_blank" rel="noopener noreferrer">{user?.website || 'https://www.nitt.edu'}</a>
            </div>

            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Address:</div>
            <div>{user?.address || 'Trichy, TN'}</div>

            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Approved Since:</div>
            <div>{formatDate(user?.created_at)}</div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
