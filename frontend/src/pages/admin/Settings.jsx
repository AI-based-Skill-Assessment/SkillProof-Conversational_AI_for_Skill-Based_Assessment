import { useAuth } from '../../core/auth/AuthContext';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/common/Card';
import Button from '../../components/common/Button';

export default function Settings() {
  const { logout } = useAuth();

  return (
    <div className="anim-fade-in" style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="page-header">
        <h2 className="page-header__title">Platform Settings</h2>
        <p className="page-header__subtitle">Configure system parameters and authentication policies</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Authentication Constraints</CardTitle></CardHeader>
        <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600 }}>Enforce Admin TOTP 2FA</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Requires all system admins to pass Google Authenticator checks.
              </div>
            </div>
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>ENABLED</span>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Danger Zone</CardTitle></CardHeader>
        <CardBody style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--error)' }}>Exit Administrative Session</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              Deauthorize current session credentials.
            </div>
          </div>
          <Button variant="danger" onClick={logout}>
            Log Out
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
