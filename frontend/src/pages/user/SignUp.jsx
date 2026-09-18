import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../../components/common/Logo';
import { useAuth } from '../../core/auth/AuthContext';
import { useToast } from '../../components/common/Toast';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import GoogleButton from '../../components/common/GoogleButton';
import ROUTES from '../../core/routes';
import '../../styles/pages/portal.css';
import PortalSwitcher from '../../components/common/PortalSwitcher';

export default function SignUp() {
  const { userRegister, googleLogin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const from = location.state?.from?.pathname || ROUTES.USER.DASHBOARD;

  async function handleGoogleSuccess(credentialToken) {
    try {
      setLoading(true);
      await googleLogin(credentialToken, true);
      toast.success('Registration Successful', 'Welcome to SkillProof!');
      navigate(from, { replace: true });
    } catch (err) {
      console.error(err);
      toast.error('Google Registration Failed', err.response?.data?.detail || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});
    
    const newErrors = {};
    if (!fullName || fullName.length < 2) newErrors.fullName = 'Full name must be at least 2 characters';

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!emailRegex.test(email)) {
      newErrors.email = 'Invalid email address format';
    }

    if (!password || password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setLoading(true);
      await userRegister({ full_name: fullName, email, password });
      toast.success('Registration Successful', 'Welcome to SkillProof!');
      navigate(from, { replace: true });
    } catch (err) {
      console.error(err);
      toast.error('Registration Failed', err.response?.data?.detail || 'An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <PortalSwitcher />
      <div className="auth-card anim-scale-in">
        <Link to="/" className="auth-card__brand">
          <Logo size={36} className="public-navbar__logo-icon" color="var(--primary)" />
          <span>SkillProof</span>
        </Link>
        <div className="auth-card__header">
          <h2 className="auth-card__title">Create Account</h2>
          <p className="auth-card__subtitle">Get started with conversational skill verification</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label="Full Name"
            type="text"
            id="signup-name"
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            required
          />

          <Input
            label="Email Address"
            type="email"
            id="signup-email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            required
          />

          <Input
            label="Password"
            type="password"
            id="signup-password"
            placeholder="Min 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            showStrength
            required
          />

          <Button type="submit" fullWidth loading={loading} shimmer>
            Create Account
          </Button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0 8px 0', gap: 12 }}>
          <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-color)' }}></div>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>or</span>
          <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-color)' }}></div>
        </div>

        <GoogleButton onSuccess={handleGoogleSuccess} label="Sign up with Google" />

        <div style={{ textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link to={ROUTES.USER.SIGNIN} style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
