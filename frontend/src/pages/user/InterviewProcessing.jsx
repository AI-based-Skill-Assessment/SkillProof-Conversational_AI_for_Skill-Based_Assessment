import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../../core/api/client';
import ROUTES from '../../core/routes';
import '../../styles/pages/portal.css';

export default function InterviewProcessing() {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    async function triggerScoring() {
      try {
        // Trigger LLM verification assessment calculations (POST /score/{session_id})
        await client.post(`/score/${id}`);
      } catch (err) {
        console.error('Scoring failed, falling back to dashboard:', err);
      } finally {
        // Take them to the report detail page
        setTimeout(() => {
          navigate(ROUTES.USER.REPORT_DETAIL(id));
        }, 3000);
      }
    }
    triggerScoring();
  }, [id, navigate]);

  return (
    <div className="auth-container" style={{ textAlign: 'center' }}>
      <div className="auth-card anim-scale-in" style={{ alignItems: 'center' }}>
        <div style={{
          width: 60, height: 60, borderRadius: '50%',
          border: '4px solid var(--border)',
          borderTopColor: 'var(--primary)',
          animation: 'spin 1s linear infinite',
          marginBottom: 16
        }} />
        <h2 className="auth-card__title">Generating Report</h2>
        <p className="auth-card__subtitle" style={{ maxWidth: 280, margin: '0 auto', lineHeight: 1.5 }}>
          Our AI is evaluating your verbal answers, calculating skills depth scores, and processing biometrics security logs...
        </p>
      </div>
    </div>
  );
}
