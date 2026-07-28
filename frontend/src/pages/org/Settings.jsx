import { useAuth } from '../../core/auth/AuthContext';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/common/Card';
import Button from '../../components/common/Button';

export default function Settings() {
  const { logout } = useAuth();

  return (
    <div className="anim-fade-in" style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="page-header">
        <h2 className="page-header__title">Institution Settings</h2>
        <p className="page-header__subtitle">Manage credentials and platform authority parameters</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Access Settings</CardTitle></CardHeader>
        <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600 }}>Revoke placement credentials</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Temporarily pause students from joining NIT Trichy placement listings.
              </div>
            </div>
            <Button variant="outline">Pause Intake</Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Danger Zone</CardTitle></CardHeader>
        <CardBody style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--error)' }}>Log Out of Institutional Panel</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              Clear browser session keys.
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
