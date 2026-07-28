import { useState } from 'react';
import { useToast } from '../../components/common/Toast';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';
import { formatScore, scoreColor } from '../../utils/formatScore';

export default function QRVerification() {
  const toast = useToast();
  const [qrId, setQrId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  function handleVerify(e) {
    e.preventDefault();
    if (!qrId) return;

    setLoading(true);
    // Simulate live cryptographic report database query check
    setTimeout(() => {
      setLoading(false);
      if (qrId.toUpperCase().includes('SP-')) {
        setResult({
          qr_id: qrId.toUpperCase(),
          candidate: 'Arjun Sharma',
          role: 'React & Node.js Developer',
          score: 82,
          verdict: 'verified',
          integrity: '100%',
          timestamp: new Date().toLocaleString(),
        });
        toast.success('Certificate Verified', 'Cryptographic signature is valid and matching database records.');
      } else {
        toast.error('Verification Failed', 'Invalid signature key format. Check spelling or QR scan details.');
        setResult(null);
      }
    }, 1200);
  }

  return (
    <div className="anim-fade-in" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="page-header">
        <h2 className="page-header__title">Audit Candidate Credentials</h2>
        <p className="page-header__subtitle">Enter candidate report Verification ID to query secure database records</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Card>
          <CardHeader><CardTitle>Audit Query Panel</CardTitle></CardHeader>
          <CardBody>
            <form onSubmit={handleVerify} style={{ display: 'flex', gap: 12 }}>
              <Input
                id="audit-qr-id"
                placeholder="e.g. SP-82AB-9F3C-2024"
                value={qrId}
                onChange={(e) => setQrId(e.target.value)}
              />
              <Button type="submit" loading={loading}>
                Audit Key
              </Button>
            </form>
          </CardBody>
        </Card>

        {result && (
          <Card className="anim-scale-in">
            <CardHeader>
              <CardTitle>Verification Audit Sheet</CardTitle>
              <StatusBadge variant="success">SECURELY VERIFIED</StatusBadge>
            </CardHeader>
            <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, fontSize: 14 }}>
                <div style={{ color: 'var(--text-secondary)' }}>Verification ID:</div>
                <div style={{ fontWeight: 600 }}>{result.qr_id}</div>

                <div style={{ color: 'var(--text-secondary)' }}>Candidate Name:</div>
                <div style={{ fontWeight: 600 }}>{result.candidate}</div>

                <div style={{ color: 'var(--text-secondary)' }}>Evaluated Role:</div>
                <div>{result.role}</div>

                <div style={{ color: 'var(--text-secondary)' }}>Overall Score:</div>
                <div style={{ fontWeight: 700, color: scoreColor(result.score) }}>{formatScore(result.score)}%</div>

                <div style={{ color: 'var(--text-secondary)' }}>Biometrics integrity:</div>
                <div style={{ color: 'var(--success)', fontWeight: 600 }}>{result.integrity} Match Passed</div>

                <div style={{ color: 'var(--text-secondary)' }}>Audit Date:</div>
                <div>{result.timestamp}</div>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
