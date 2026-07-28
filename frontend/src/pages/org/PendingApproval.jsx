import { Link } from 'react-router-dom';
import ROUTES from '../../core/routes';
import '../../styles/pages/portal.css';

export default function PendingApproval() {
  return (
    <div className="auth-container">
      <div className="auth-card anim-scale-in" style={{ textAlign: 'center', alignItems: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
        <h2 className="auth-card__title">Registration Pending Approval</h2>
        <p className="auth-card__subtitle" style={{ maxWidth: 300, lineHeight: 1.5, margin: '8px auto 20px' }}>
          Your institution profile is currently under review by our platform administration.
          You will receive an email notice as soon as your access is approved.
        </p>
        <Link to={ROUTES.HOME} className="common-button common-button--primary">
          Back to Home Page
        </Link>
      </div>
    </div>
  );
}
