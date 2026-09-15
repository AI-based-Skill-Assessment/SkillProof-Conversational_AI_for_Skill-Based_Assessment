import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Logo from '../../components/common/Logo';
import { useAuth } from '../../core/auth/AuthContext';
import { useToast } from '../../components/common/Toast';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import GoogleButton from '../../components/common/GoogleButton';
import ROUTES from '../../core/routes';
import '../../styles/pages/portal.css';

export default function SignIn() {
  const { userLogin, googleLogin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const from = location.state?.from?.pathname || ROUTES.USER.DASHBOARD;

  useEffect(() => {
    if (location.search.includes('expired=true')) {
      toast.warning('Session Expired', 'You have been logged out due to inactivity.');
      navigate(location.pathname, { replace: true });
    }
  }, [location, toast, navigate]);

  async function handleGoogleSuccess(credentialToken) {
    try {
      setLoading(true);
      await googleLogin(credentialToken);
      toast.success('Login Successful', 'Welcome to SkillProof!');
      navigate(from, { replace: true });
    } catch (err) {
      console.error(err);
      toast.error('Google Auth Failed', err.response?.data?.detail || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});
    
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!emailRegex.test(email)) {
      newErrors.email = 'Invalid email address format';
    }
    if (!password) {
      newErrors.password = 'Password is required';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setLoading(true);
      await userLogin({ email, password });
      toast.success('Login Successful', 'Welcome back to SkillProof!');
      navigate(from, { replace: true });
    } catch (err) {
      console.error(err);
      toast.error('Login Failed', err.response?.data?.detail || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card anim-scale-in">
        <Link to="/" className="auth-card__brand">
          <Logo size={36} className="public-navbar__logo-icon" color="var(--primary)" />
          <span>SkillProof</span>
        </Link>
        <div className="auth-card__header">
          <h2 className="auth-card__title">Welcome Back</h2>
          <p className="auth-card__subtitle">Candidate / User Portal Sign In</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label="Email Address"
            type="email"
            id="signin-email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            required
          />

          <Input
            label="Password"
            type="password"
            id="signin-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            required
          />

          <div style={{ textAlign: 'right', marginTop: -8 }}>
            <Link to={ROUTES.USER.FORGOT_PASSWORD} style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              Forgot password?
            </Link>
          </div>

          <Button type="submit" fullWidth loading={loading} shimmer>
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
          <Link to={ROUTES.USER.SIGNUP} style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
