import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/common/Button';
import ROUTES from '../../core/routes';
import '../../styles/pages/portal.css';

export default function NewAssessment() {
  const [selected, setSelected] = useState(null);
  const navigate = useNavigate();

  function handleProceed() {
    if (!selected) return;
    if (selected === 'certificate') {
      navigate(ROUTES.USER.CERTIFICATE_ASSESSMENT);
    } else {
      navigate(ROUTES.USER.SKILL_ASSESSMENT);
    }
  }

  return (
    <div className="page-shell page-shell--narrow anim-fade-in" style={{ paddingBottom: 48 }}>
      <div className="page-header">
        <h2 className="page-header__title">Start a New Assessment</h2>
        <p className="page-header__subtitle">Choose how you want to ingest your credentials or skills</p>
      </div>

      <div className="intake-selector page-shell__grid" style={{ marginBottom: 32 }}>
        <div
          className={`intake-card${selected === 'certificate' ? ' intake-card--selected' : ''}`}
          onClick={() => setSelected('certificate')}
        >
          <div className="intake-card__icon">📄</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Certificate Upload</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Upload a PDF or image of your course/internship certificate. Our AI will automatically parse the issuer, role, and skills.
          </p>
        </div>

        <div
          className={`intake-card${selected === 'skill_only' ? ' intake-card--selected' : ''}`}
          onClick={() => setSelected('skill_only')}
        >
          <div className="intake-card__icon">⚡</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Skill-only Declaration</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Directly enter the programming languages and skills you possess. No files or certificates required.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginBottom: 48 }}>
        <Button variant="secondary" onClick={() => navigate(ROUTES.USER.DASHBOARD)}>
          Cancel
        </Button>
        <Button onClick={handleProceed} disabled={!selected} shimmer className="common-button--shimmer-slow">
          Proceed
        </Button>
      </div>

      {/* ── How it Works Step Guide ── */}
      <div style={{ paddingTop: 32, borderTop: '1px solid var(--border)' }}>
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            How SkillProof Assessment Works
          </h3>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
            A conversational, AI-proctored verification pipeline in 3 streamlined steps
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
          {/* Step 1 */}
          <div className="common-card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
                1
              </span>
              <span style={{ fontSize: 20 }}>📥</span>
            </div>
            <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Ingestion & Setup</h4>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Upload your credential or declare skills. Our AI extracts core competencies and generates an adaptive question blueprint.
            </p>
          </div>

          {/* Step 2 */}
          <div className="common-card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
                2
              </span>
              <span style={{ fontSize: 20 }}>🎙️</span>
            </div>
            <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Interactive AI Interview</h4>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Engage in a live voice and coding conversation with the AI examiner, with real-time deep-dives based on your responses.
            </p>
          </div>

          {/* Step 3 */}
          <div className="common-card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
                3
              </span>
              <span style={{ fontSize: 20 }}>🏅</span>
            </div>
            <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Cryptographic Credential</h4>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Receive an immutable score breakdown and a cryptographic QR certificate ready to share with hiring organizations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
