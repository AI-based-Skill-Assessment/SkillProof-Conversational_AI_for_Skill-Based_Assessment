import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/common/Button';
import ROUTES from '../../core/routes';
import '../../styles/pages/portal.css';

export default function NewAssessment() {
  const [selected, setSelected] = useState('certificate');
  const navigate = useNavigate();

  function handleProceed() {
    if (selected === 'certificate') {
      navigate(ROUTES.USER.CERTIFICATE_ASSESSMENT);
    } else {
      navigate(ROUTES.USER.SKILL_ASSESSMENT);
    }
  }

  return (
    <div className="anim-fade-in" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="page-header">
        <h2 className="page-header__title">Start a New Assessment</h2>
        <p className="page-header__subtitle">Choose how you want to ingest your credentials or skills</p>
      </div>

      <div className="intake-selector" style={{ marginBottom: 32 }}>
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

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={() => navigate(ROUTES.USER.DASHBOARD)}>
          Cancel
        </Button>
        <Button onClick={handleProceed}>
          Proceed
        </Button>
      </div>
    </div>
  );
}
