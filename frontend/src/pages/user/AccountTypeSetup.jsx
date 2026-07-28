import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../core/auth/AuthContext';
import { useToast } from '../../components/common/Toast';
import client from '../../core/api/client';
import Button from '../../components/common/Button';
import ROUTES from '../../core/routes';
import '../../styles/pages/portal.css';

export default function AccountTypeSetup() {
  const { user, updateUserCache } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [selected, setSelected] = useState('individual');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('pending') === 'true') {
      toast.warning('Onboarding Required', 'Please complete your registration setup to access the dashboard.');
      navigate(location.pathname, { replace: true });
    }
  }, [location.pathname, location.search, navigate, toast]);

  async function handleSave() {
    setLoading(true);
    try {
      const res = await client.put('/auth/me/account-type', { account_type: selected });
      updateUserCache(res.data);
      toast.success('Account Type Saved', 'Your preference has been registered.');
      navigate(ROUTES.USER.FACE_REGISTRATION);
    } catch (err) {
      console.error(err);
      toast.error('Setup Failed', err.response?.data?.detail || 'Failed to save account type.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card anim-scale-in" style={{ maxWidth: 520 }}>
        <div className="auth-card__header">
          <h2 className="auth-card__title">Choose Account Type</h2>
          <p className="auth-card__subtitle">How do you plan to use the platform?</p>
        </div>

        <div className="intake-selector">
          <div
            className={`intake-card${selected === 'individual' ? ' intake-card--selected' : ''}`}
            onClick={() => setSelected('individual')}
          >
            <div className="intake-card__icon">👤</div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Individual Candidate</h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Evaluate your own skills and share verification certificates with recruiters.
            </p>
          </div>

          <div
            className={`intake-card${selected === 'organisation_connected' ? ' intake-card--selected' : ''}`}
            onClick={() => setSelected('organisation_connected')}
          >
            <div className="intake-card__icon">🎓</div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>College Connected</h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Connected to a university placement cell or hiring drive.
            </p>
          </div>
        </div>

        <Button fullWidth onClick={handleSave} loading={loading}>
          Continue to Face Registration
        </Button>
      </div>
    </div>
  );
}
