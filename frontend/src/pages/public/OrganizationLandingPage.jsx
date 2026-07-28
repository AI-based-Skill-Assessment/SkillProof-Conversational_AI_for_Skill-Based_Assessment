import { Link } from 'react-router-dom';
import ROUTES from '../../core/routes';
import { useAuth } from '../../core/auth/AuthContext';
import '../../styles/pages/public.css';

export default function OrganizationLandingPage() {
  const { isAuthenticated, role } = useAuth();

  const getDashboardRoute = () => {
    if (role === 'user') return `${ROUTES.USER.DASHBOARD}?pending=true`;
    if (role === 'org') return ROUTES.ORG.DASHBOARD;
    if (role === 'admin') return ROUTES.ADMIN.DASHBOARD;
    return ROUTES.USER.DASHBOARD;
  };

  return (
    <div className="anim-fade-in">
      <section className="public-hero">
        <span className="public-hero__tagline">For Colleges & Corporates</span>
        <h1 className="public-hero__title">
          Eliminate Certificate Fraud, <span>Audit Skill Competency</span>
        </h1>
        <p className="public-hero__desc">
          Add placement-cell verifications, automate candidate pre-screening interviews, check certificate URLs,
          and receive high-fidelity, QR-coded candidate skill assessment sheets.
        </p>
        <div className="public-hero__actions">
          {isAuthenticated ? (
            <Link to={getDashboardRoute()} className="common-button common-button--primary common-button--lg">
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link to={ROUTES.ORG.SIGNUP} className="common-button common-button--primary common-button--lg">
                Register your Institution
              </Link>
              <Link to={ROUTES.USER.SIGNUP} className="common-button common-button--secondary common-button--lg">
                Try Candidate Portal
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="public-section">
        <div className="public-section__title">
          <h2>Enterprise Solutions</h2>
          <p>Deploy secure verification checks across your college placements or HR pipelines.</p>
        </div>

        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-card__icon">🎓</div>
            <h3 className="feature-card__title">For Placement Cells</h3>
            <p className="feature-card__desc">
              Verify all student certificates before sharing resume books with companies. Ensure your college's credential trust is unassailable.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-card__icon">🏢</div>
            <h3 className="feature-card__title">For Hiring Teams</h3>
            <p className="feature-card__desc">
              Pre-screen incoming applications automatically. Send custom skill assessments to candidates with built-in voice/face biometric tracking.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-card__icon">🔍</div>
            <h3 className="feature-card__title">Instant QR Auditing</h3>
            <p className="feature-card__desc">
              Scan report QR codes to fetch live cryptographically secure verification states straight from the database. No account required.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
