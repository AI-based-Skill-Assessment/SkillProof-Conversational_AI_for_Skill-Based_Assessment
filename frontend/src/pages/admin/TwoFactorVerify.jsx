import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/auth/AuthContext';
import { useToast } from '../../components/common/Toast';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import ROUTES from '../../core/routes';
import '../../styles/pages/portal.css';

export default function TwoFactorVerify() {
  const { adminLoginStep2 } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const {
    temp_token: tempToken,
    totp_enabled: totpEnabled,
    totp_uri: totpUri,
    totp_secret: totpSecret,
  } = location.state || {};

  async function handleSubmit(e) {
    e.preventDefault();
    if (!code || !tempToken) return;

    try {
      setLoading(true);
      await adminLoginStep2({ temp_token: tempToken, totp_code: code });
      toast.success('Admin Logged In', 'Welcome to the administration dashboard.');
      navigate(ROUTES.ADMIN.DASHBOARD);
    } catch (err) {
      toast.error('2FA Verification Failed', err.response?.data?.detail || 'Incorrect or expired TOTP code.');
    } finally {
      setLoading(false);
    }
  }

  const showSetup = totpEnabled === false;

  return (
    <div className="auth-container">
      <div className="auth-card anim-scale-in" style={{ maxWidth: showSetup ? '460px' : '400px' }}>
        <div className="auth-card__brand">
          <div className="public-navbar__logo-icon" style={{ background: 'var(--error)' }}>SP</div>
          <span style={{ color: 'var(--text-primary)' }}>SkillProof Security</span>
        </div>
        
        <div className="auth-card__header">
          <h2 className="auth-card__title">
            {showSetup ? 'Configure Two-Factor Auth' : 'Two-Factor Authentication'}
          </h2>
          <p className="auth-card__subtitle">
            {showSetup 
              ? 'Scan the QR code below with your authenticator app to enable 2FA.'
              : 'Enter the 6-digit verification code from your authenticator app.'}
          </p>
        </div>

        {showSetup && totpUri && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '12px', padding: '20px', marginBottom: '20px'
          }}>
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(totpUri)}`}
              alt="Scan this QR Code in Authenticator app"
              style={{
                width: '180px', height: '180px', borderRadius: '8px', 
                border: '8px solid white', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                marginBottom: '16px'
              }}
            />
            <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', textAlign: 'center' }}>
              Secret Key: <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{totpSecret}</strong>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label={showSetup ? 'Confirm 6-Digit Code' : 'Verification Code'}
            type="text"
            id="totp-code"
            placeholder="e.g. 123456"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            autoComplete="one-time-code"
          />

          <Button type="submit" fullWidth loading={loading} style={{ background: 'var(--error)', borderColor: 'var(--error)' }}>
            {showSetup ? 'Verify and Enable 2FA' : 'Confirm 2FA Code'}
          </Button>
        </form>
      </div>
    </div>
  );
}
