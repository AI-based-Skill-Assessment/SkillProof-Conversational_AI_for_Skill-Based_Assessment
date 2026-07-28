import { MOCK_CERTIFICATES } from '../../core/mockData/user.mock';
import StatusBadge from '../../components/common/StatusBadge';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/common/Card';
import QRDisplay from '../../components/common/QRDisplay';

export default function Certificates() {
  return (
    <div className="anim-fade-in">
      <div className="page-header">
        <h2 className="page-header__title">Verifiable Credentials Badges</h2>
        <p className="page-header__subtitle">Secure cryptographic badge logs representing your assessed technical expertise</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
        {MOCK_CERTIFICATES.map(c => (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle>{c.title}</CardTitle>
              <StatusBadge variant="success">VERIFIED</StatusBadge>
            </CardHeader>
            <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
              <div style={{ fontSize: 13, textAlign: 'center', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Issued To:</span>
                  <span style={{ fontWeight: 600 }}>{c.issued_to}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Overall Score:</span>
                  <span style={{ fontWeight: 700, color: 'var(--success)' }}>{c.score}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Issued Date:</span>
                  <span style={{ fontWeight: 600 }}>{c.issued_at}</span>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, width: '100%', display: 'flex', justifyContent: 'center' }}>
                <QRDisplay value={`${window.location.origin}/verify/${c.qr_id}`} label={c.qr_id} />
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
