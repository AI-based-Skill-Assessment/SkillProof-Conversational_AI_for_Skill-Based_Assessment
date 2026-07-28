import { Link } from 'react-router-dom';
import ROUTES from '../../core/routes';
import '../../styles/pages/public.css';

export default function HowItWorks() {
  return (
    <div className="anim-fade-in">
      <section className="public-hero">
        <span className="public-hero__tagline">The Assessment Pipeline</span>
        <h1 className="public-hero__title">
          How SkillProof <span>Proves Competency</span>
        </h1>
        <p className="public-hero__desc">
          Four automated steps convert certificate documents and dynamic conversational interviews into secure verified reports.
        </p>
      </section>

      <section className="public-section">
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 60 }}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            <div className="public-navbar__logo-icon" style={{ width: 48, height: 48, fontSize: 20 }}>1</div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Certificate Upload & OCR Ingestion</h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                Candidate uploads their PDF/image certificate. The backend runs OCR, parses raw content using language models, and identifies the target role, issuer, verification URL, and list of claimed skills.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            <div className="public-navbar__logo-icon" style={{ width: 48, height: 48, fontSize: 20 }}>2</div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Document URL & MCA Lookup</h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                The automated crawler fetches the certificate verification URL, checks if the recipient name matches the certificate text, and queries company registration records to verify authenticity.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            <div className="public-navbar__logo-icon" style={{ width: 48, height: 48, fontSize: 20 }}>3</div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Adaptive Conversational AI Interview</h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                Candidates enter the virtual interview room. An adaptive AI interviewer grills them verbally on the specific skills. MediaPipe headpose gaze tracking and SpeechBrain verify candidate identity continuously.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            <div className="public-navbar__logo-icon" style={{ width: 48, height: 48, fontSize: 20 }}>4</div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Report Generation & QR Minting</h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                All scores are aggregated. The LLM produces depth, consistency, and specificity scores alongside reasoning. A secure report is minted, linked to a scannable QR verification code.
              </p>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 60 }}>
          <Link to={ROUTES.USER.SIGNUP} className="common-button common-button--primary common-button--lg">
            Try It Now
          </Link>
        </div>
      </section>
    </div>
  );
}
