import { Link } from 'react-router-dom';
import ROUTES from '../../core/routes';
import { useAuth } from '../../core/auth/AuthContext';
import '../../styles/pages/public.css';

export default function LandingPage() {
  const { isAuthenticated, role } = useAuth();

  const getDashboardRoute = () => {
    if (role === 'user') return `${ROUTES.USER.DASHBOARD}?pending=true`;
    if (role === 'org') return ROUTES.ORG.DASHBOARD;
    if (role === 'admin') return ROUTES.ADMIN.DASHBOARD;
    return ROUTES.USER.DASHBOARD;
  };

  return (
    <div className="anim-fade-in">
      {/* Hero */}
      <section className="public-hero">
        <span className="public-hero__tagline">Conversational AI Assessment</span>
        <h1 className="public-hero__title">
          Verify Certificates and <span>Prove Genuine Skills</span>
        </h1>
        <p className="public-hero__desc">
          SkillProof verifies course and internship certificates, then uses adaptive, conversational AI
          interviews and biometric checks to prove candidates genuinely possess the skills.
        </p>
        <div className="public-hero__actions">
          {isAuthenticated ? (
            <Link to={getDashboardRoute()} className="common-button common-button--primary common-button--lg">
              Go to Dashboard
            </Link>
          ) : (
            <Link to={ROUTES.USER.SIGNUP} className="common-button common-button--primary common-button--lg">
              Create Free Account
            </Link>
          )}
          <Link to={ROUTES.HOW_IT_WORKS} className="common-button common-button--secondary common-button--lg">
            See How It Works
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="public-section">
        <div className="public-section__title">
          <h2>Core Verification Pillars</h2>
          <p>SkillProof leverages multi-layered integrity engines to verify candidate profiles.</p>
        </div>

        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-card__icon">📄</div>
            <h3 className="feature-card__title">Certificate Ingestion</h3>
            <p className="feature-card__desc">
              Upload certificates in PDF or image format. The OCR engine automatically extracts issuer metadata, role scopes, and verification URLs.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-card__icon">🤖</div>
            <h3 className="feature-card__title">Conversational AI Interview</h3>
            <p className="feature-card__desc">
              A dynamic, adaptive voice/text interview evaluated by LLM. It assesses candidates on the specific skills listed in their certificates.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-card__icon">👤</div>
            <h3 className="feature-card__title">Continuous Biometrics</h3>
            <p className="feature-card__desc">
              Anti-spoofing face matching, voice print validation, eye tracking, and speech detection run in real-time to prevent impersonation.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
