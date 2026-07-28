import { useState } from 'react';
import { Link } from 'react-router-dom';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import ROUTES from '../../core/routes';
import '../../styles/pages/portal.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setSent(true);
      setLoading(false);
    }, 1000);
  }

  return (
    <div className="auth-container">
      <div className="auth-card anim-scale-in">
        <Link to="/" className="auth-card__brand">
          <div className="public-navbar__logo-icon">SP</div>
          <span>SkillProof</span>
        </Link>

        {sent ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 className="auth-card__title">Check Your Email</h2>
            <p className="auth-card__subtitle" style={{ color: 'var(--text-secondary)' }}>
              We have sent password recovery instructions to <strong>{email}</strong>.
            </p>
            <Link to={ROUTES.USER.SIGNIN} className="common-button common-button--primary">
              Back to Sign In
            </Link>
          </div>
        ) : (
          <>
            <div className="auth-card__header">
              <h2 className="auth-card__title">Reset Password</h2>
              <p className="auth-card__subtitle">Enter your email and we'll send reset links</p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Input
                label="Email Address"
                type="email"
                id="reset-email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <Button type="submit" fullWidth loading={loading}>
                Send Reset Link
              </Button>
            </form>
          </>
        )}

        <div style={{ textAlign: 'center', fontSize: 'var(--text-sm)' }}>
          <Link to={ROUTES.USER.SIGNIN} style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
