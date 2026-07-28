import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../core/auth/AuthContext';
import { useToast } from '../../components/common/Toast';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import GoogleButton from '../../components/common/GoogleButton';
import ROUTES from '../../core/routes';
import '../../styles/pages/portal.css';

export default function SignIn() {
  const { orgLogin, orgGoogleLogin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  async function handleGoogleSuccess(credentialToken) {
    try {
      setLoading(true);
      await orgGoogleLogin(credentialToken, false);
      toast.success('Login Successful', 'Welcome to the Organisation Dashboard!');
      navigate(ROUTES.ORG.DASHBOARD);
    } catch (err) {
      console.error(err);
      toast.error('Google Auth Failed', err.response?.data?.detail || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (location.search.includes('expired=true')) {
      toast.warning('Session Expired', 'You have been logged out due to inactivity.');
      navigate(location.pathname, { replace: true });
    }
  }, [location, toast, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});
    
    const newErrors = {};
    if (!email) {
      newErrors.email = 'Email is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        newErrors.email = 'Please enter a valid email address';
      }
    }
    if (!password) newErrors.password = 'Password is required';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setLoading(true);
      await orgLogin({ email, password });
      toast.success('Login Successful', 'Welcome to the Organisation Dashboard!');
      navigate(ROUTES.ORG.DASHBOARD);
    } catch (err) {
      console.error(err);
      toast.error('Login Failed', err.response?.data?.detail || 'Invalid email, password, or account is pending approval.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card anim-scale-in">
        <Link to="/" className="auth-card__brand">
          <div className="public-navbar__logo-icon">SP</div>
          <span>SkillProof</span>
        </Link>
        <div className="auth-card__header">
          <h2 className="auth-card__title">Institution Login</h2>
          <p className="auth-card__subtitle">Colleges, Universities & Corporates Sign In</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label="College / Corp Email"
            type="email"
            id="org-signin-email"
            placeholder="placement@nitt.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            required
          />

          <Input
            label="Password"
            type="password"
            id="org-signin-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            required
          />

          <Button type="submit" fullWidth loading={loading}>
            Sign In
          </Button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0 8px 0', gap: 12 }}>
          <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-color)' }}></div>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>or</span>
          <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-color)' }}></div>
        </div>

        <GoogleButton onSuccess={handleGoogleSuccess} label="Sign in with Google" />

        <div style={{ textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          Don't have an account?{' '}
          <Link to={ROUTES.ORG.SIGNUP} style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Register Now
          </Link>
        </div>
      </div>
    </div>
  );
}
