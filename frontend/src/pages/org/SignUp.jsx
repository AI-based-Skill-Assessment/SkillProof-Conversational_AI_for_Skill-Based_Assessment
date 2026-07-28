import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/auth/AuthContext';
import { useToast } from '../../components/common/Toast';
import client from '../../core/api/client';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Select from '../../components/common/Select';
import GoogleButton from '../../components/common/GoogleButton';
import ROUTES from '../../core/routes';
import '../../styles/pages/portal.css';

export default function SignUp() {
  const { orgGoogleLogin } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [type, setType] = useState('college');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  async function handleGoogleSuccess(credentialToken) {
    try {
      setLoading(true);
      await orgGoogleLogin(credentialToken, true);
      toast.success('Registration Successful', 'Welcome to SkillProof!');
      navigate(ROUTES.ORG.GOOGLE_ONBOARD);
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

    if (!name) newErrors.name = 'Organisation name is required';

    if (!email) {
      newErrors.email = 'Email address is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        newErrors.email = 'Please enter a valid email address';
      }
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setLoading(true);
      await client.post('/auth/org/register', {
        name,
        email,
        password,
        org_type: type,
        contact_name: contactName,
        contact_phone: contactPhone,
        website,
        address
      });

      toast.success('Registration Submitted', 'Your account is pending admin approval. You will receive an email once approved.');
      navigate(ROUTES.ORG.PENDING);
    } catch (err) {
      toast.error('Registration Failed', err.response?.data?.detail || 'An organisation with this email already exists.');
    } finally {
      setLoading(false);
    }
  }

  const typeOptions = [
    { value: 'college', label: 'College' },
    { value: 'university', label: 'University' },
    { value: 'placement_cell', label: 'Placement Cell' },
    { value: 'company', label: 'Company / Corporate' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <div className="auth-container">
      <div className="auth-card anim-scale-in" style={{ maxWidth: 540 }}>
        <Link to="/" className="auth-card__brand">
          <div className="public-navbar__logo-icon">SP</div>
          <span>SkillProof</span>
        </Link>
        <div className="auth-card__header">
          <h2 className="auth-card__title">Institution Registration</h2>
          <p className="auth-card__subtitle">Create an account for college placement or pre-screening</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ gridColumn: 'span 2' }}>
            <Input
              label="Organisation / College Name"
              type="text"
              id="org-reg-name"
              placeholder="e.g. NIT Trichy"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              required
            />
          </div>

          <Input
            label="Official Contact Email"
            type="email"
            id="org-reg-email"
            placeholder="placement@nitt.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            required
          />

          <Input
            label="Password"
            type="password"
            id="org-reg-password"
            placeholder="Min 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            required
          />

          <Select
            label="Institution Type"
            id="org-reg-type"
            options={typeOptions}
            value={type}
            onChange={(e) => setType(e.target.value)}
          />

          <Input
            label="Primary Contact Name"
            type="text"
            id="org-reg-contact"
            placeholder="Dr. Ramesh Kumar"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />

          <Input
            label="Contact Phone"
            type="text"
            id="org-reg-phone"
            placeholder="+91-XXXXXXXXXX"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
          />

          <Input
            label="Website URL"
            type="text"
            id="org-reg-web"
            placeholder="https://www.nitt.edu"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />

          <div style={{ gridColumn: 'span 2' }}>
            <Input
              label="Physical Address"
              type="text"
              id="org-reg-addr"
              placeholder="Tanjore Road, Trichy, TN"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              textarea
            />
          </div>

          <div style={{ gridColumn: 'span 2', marginTop: 10 }}>
            <Button type="submit" fullWidth loading={loading}>
              Submit Registration
            </Button>
          </div>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0 8px 0', gap: 12 }}>
          <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-color)' }}></div>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>or</span>
          <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-color)' }}></div>
        </div>

        <GoogleButton onSuccess={handleGoogleSuccess} label="Sign up with Google" />

        <div style={{ textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 8 }}>
          Already registered?{' '}
          <Link to={ROUTES.ORG.SIGNIN} style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
