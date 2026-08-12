import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Logo from '../../components/common/Logo';
import { useAuth } from '../../core/auth/AuthContext';
import { useToast } from '../../components/common/Toast';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import ROUTES from '../../core/routes';
import '../../styles/pages/portal.css';

export default function Login() {
  const { adminLoginStep1 } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (location.search.includes('expired=true')) {
      toast.warning('Session Expired', 'You have been logged out due to inactivity.');
      navigate(location.pathname, { replace: true });
    }
  }, [location, toast, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) return;

    try {
      setLoading(true);
      // Run first step authentication check (password check)
      const data = await adminLoginStep1({ email, password });
      toast.success('Step 1 Validated', data.message);
      
      navigate(ROUTES.ADMIN.TWO_FACTOR, {
        state: {
          temp_token: data.temp_token,
          totp_enabled: data.totp_enabled,
          totp_uri: data.totp_uri,
          totp_secret: data.totp_secret
        }
      });
    } catch (err) {
      toast.error('Login Failed', err.response?.data?.detail || 'Incorrect admin password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card anim-scale-in">
        <div className="auth-card__brand">
          <Logo size={36} className="public-navbar__logo-icon" color="var(--error)" />
          <span style={{ color: 'var(--text-primary)' }}>SkillProof Admin</span>
        </div>
        <div className="auth-card__header">
          <h2 className="auth-card__title">System Administration</h2>
          <p className="auth-card__subtitle">Enter password to initiate 2FA login verification</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label="Admin Email"
            type="email"
            id="admin-email"
            placeholder="admin@skillproof.ai"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Admin Password"
            type="password"
            id="admin-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button type="submit" fullWidth loading={loading} style={{ background: 'var(--error)', borderColor: 'var(--error)' }}>
            Authenticate Password
          </Button>
        </form>
      </div>
    </div>
  );
}
