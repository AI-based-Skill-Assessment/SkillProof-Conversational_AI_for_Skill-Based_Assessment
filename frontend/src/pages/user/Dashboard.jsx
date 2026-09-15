import { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import client from '../../core/api/client';
import { useToast } from '../../components/common/Toast';
import { EP } from '../../core/api/endpoints';
import { MOCK_SESSIONS, MOCK_DASHBOARD_STATS } from '../../core/mockData/user.mock';
import { StatCard } from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate } from '../../utils/formatDate';
import { formatScore, scoreColor, verdictVariant } from '../../utils/formatScore';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import ROUTES from '../../core/routes';
import '../../styles/pages/portal.css';

export default function Dashboard() {
  const { isDemo, setIsDemo } = useOutletContext() || {};
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(MOCK_DASHBOARD_STATS);
  const [loading, setLoading] = useState(true);
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const toast = useToast();

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        // Call real backend endpoint to fetch candidate's sessions
        const res = await client.get('/sessions');
        
        if (res.data && res.data.length > 0) {
          setSessions(res.data);
          if (setIsDemo) setIsDemo(false);
          
          // Compute live stats based on actual data
          const completed = res.data.filter(s => s.status === 'scored').length;
          const verified = res.data.filter(s => s.document?.fetch_status === 'verified').length;
          const scoresList = res.data.flatMap(s => s.scores || []).map(sc => sc.overall_skill_score);
          const avgScore = scoresList.length > 0 ? (scoresList.reduce((a, b) => a + b, 0) / scoresList.length) : 0;
          
          setStats({
            completed_assessments: res.data.length,
            verified_certificates: verified,
            average_skill_score: avgScore,
            shared_organisations: 0
          });
        } else {
          // If no data is present on the backend, fall back to mock data
          setSessions(MOCK_SESSIONS);
          setStats(MOCK_DASHBOARD_STATS);
          if (setIsDemo) setIsDemo(true);
        }
      } catch (err) {
        console.error('Failed to load sessions from API, running in Demo Mode:', err);
        // Fall back on error (no database connection / server offline)
        setSessions(MOCK_SESSIONS);
        setStats(MOCK_DASHBOARD_STATS);
        if (setIsDemo) setIsDemo(true);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [setIsDemo]);

  async function confirmDelete() {
    if (!sessionToDelete) return;
    const sessionId = sessionToDelete;
    setSessionToDelete(null);

    try {
      await client.delete(`/sessions/${sessionId}`);
      toast.success('Deleted successfully', 'The assessment session has been removed.');
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (err) {
      console.warn('Failed to delete session on backend, removing locally:', err.message);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      toast.success('Removed successfully', 'The assessment session has been removed.');
    }
  }

  return (
    <div className="anim-fade-in">
      <div className="page-header page-header--row">
        <div>
          <h2 className="page-header__title">Welcome, Candidate</h2>
          <p className="page-header__subtitle">
            Manage your verification sessions, take skills assessments, and view certified reports.
          </p>
        </div>
        <div className="page-header__actions">
          <Link to={ROUTES.USER.NEW_ASSESSMENT} className="common-button common-button--primary">
            New Assessment
          </Link>
        </div>
      </div>

      <div className="dashboard-stats" aria-label="Assessment summary">
        <StatCard icon="◎" value={stats.completed_assessments} label="Assessments" />
        <StatCard icon="✓" value={stats.verified_certificates} label="Verified certificates" />
        <StatCard icon="%" value={stats.average_skill_score ? `${formatScore(stats.average_skill_score)}%` : '—'} label="Average skill score" />
        <StatCard icon="↗" value={stats.shared_organisations} label="Organisations" />
      </div>

      {/* Candidate Action Hub Cards */}
      <div className="dashboard-grid">
        {/* Card 1: Primary Action */}
        <div className="hub-card hub-card--primary">
          <div>
            <div className="hub-card__icon" aria-hidden="true">+</div>
            <div className="hub-card__top">
              <span className="hub-card__tag">Next Action</span>
              <span className="hub-card__badge hub-card__badge--cyan">
                {sessions.find(s => s.status === 'ocr_done' || s.status === 'verified') ? 'Ready' : 'New'}
              </span>
            </div>
            <div className="hub-card__title">
              {sessions.find(s => s.status === 'ocr_done' || s.status === 'verified') 
                ? 'Take AI Interview' 
                : 'Upload Certificate'}
            </div>
            <div className="hub-card__text">
              {sessions.find(s => s.status === 'ocr_done' || s.status === 'verified')
                ? 'Your document is verified.'
                : 'Upload to start evaluation.'}
            </div>
          </div>
          <div className="hub-card__action">
            {sessions.find(s => s.status === 'ocr_done' || s.status === 'verified') ? (
              <Link to={ROUTES.USER.INTERVIEW_CHECK(sessions.find(s => s.status === 'ocr_done' || s.status === 'verified').id)} className="common-button common-button--primary common-button--sm" style={{ width: '100%', justifyContent: 'center' }}>
                Start Interview
              </Link>
            ) : (
              <Link to={ROUTES.USER.NEW_ASSESSMENT} className="common-button common-button--primary common-button--sm" style={{ width: '100%', justifyContent: 'center' }}>
                New Assessment
              </Link>
            )}
          </div>
        </div>

        {/* Card 2: Active Pipeline Tracker */}
        <div className="hub-card hub-card--info">
          <div>
            <div className="hub-card__icon" aria-hidden="true">≡</div>
            <div className="hub-card__top">
              <span className="hub-card__tag">My Applications</span>
              <span className="hub-card__badge hub-card__badge--blue">
                {sessions.length} Total
              </span>
            </div>
            <div className="hub-card__title">
              {sessions.filter(s => s.status !== 'scored').length} In Progress
            </div>
            <div className="hub-card__text">
              {sessions.filter(s => s.status === 'scored').length} reports completed
            </div>
          </div>
          <div className="hub-card__action">
            <Link to={ROUTES.USER.REPORTS_LIST} className="common-button common-button--secondary common-button--sm" style={{ width: '100%', justifyContent: 'center' }}>
              View Reports
            </Link>
          </div>
        </div>

        {/* Card 3: Camera & Mic Security Check */}
        <div className="hub-card hub-card--success">
          <div>
            <div className="hub-card__icon" aria-hidden="true">◉</div>
            <div className="hub-card__top">
              <span className="hub-card__tag">Hardware Check</span>
              <span className="hub-card__badge hub-card__badge--green">
                Quick Test
              </span>
            </div>
            <div className="hub-card__title">
              Cam & Mic Test
            </div>
            <div className="hub-card__text">
              Test video & voice before interview
            </div>
          </div>
          <div className="hub-card__action">
            <Link to={ROUTES.USER.BIOMETRIC_CHECK} className="common-button common-button--outline common-button--sm" style={{ width: '100%', justifyContent: 'center' }}>
              Test Devices
            </Link>
          </div>
        </div>

        {/* Card 4: Certificates & Badges */}
        <div className="hub-card hub-card--purple">
          <div>
            <div className="hub-card__icon" aria-hidden="true">◇</div>
            <div className="hub-card__top">
              <span className="hub-card__tag">Share Credentials</span>
              <span className="hub-card__badge hub-card__badge--purple">
                QR Badges
              </span>
            </div>
            <div className="hub-card__title">
              Digital Badges
            </div>
            <div className="hub-card__text">
              Share verified QR badges with recruiters
            </div>
          </div>
          <div className="hub-card__action">
            <Link to={ROUTES.USER.CERTIFICATES} className="common-button common-button--secondary common-button--sm" style={{ width: '100%', justifyContent: 'center' }}>
              My Badges
            </Link>
          </div>
        </div>
      </div>

      <div className="dashboard-pipeline" aria-label="Assessment pipeline summary">
        <div className="dashboard-pipeline__step">
          <span className="dashboard-pipeline__label">Intake</span>
          <strong className="dashboard-pipeline__value">{sessions.length} submitted</strong>
        </div>
        <div className="dashboard-pipeline__step">
          <span className="dashboard-pipeline__label">Verification</span>
          <strong className="dashboard-pipeline__value">{sessions.filter(s => ['ocr_done', 'verified'].includes(s.status)).length} ready</strong>
        </div>
        <div className="dashboard-pipeline__step">
          <span className="dashboard-pipeline__label">Interview</span>
          <strong className="dashboard-pipeline__value">{sessions.filter(s => s.status === 'scored').length} completed</strong>
        </div>
      </div>

      {/* Recent Sessions */}
      <div className="dashboard-section">
        <div className="dashboard-section__header">
          <h3 style={{ fontSize: 18, fontWeight: 700 }}>Recent Assessment Pipeline Sessions</h3>
          <Link to={ROUTES.USER.REPORTS_LIST} style={{ fontSize: 14, fontWeight: 600 }}>
            View All Reports
          </Link>
        </div>

        {loading ? (
          <div className="app-loading-state">
            <span className="app-loading-state__spinner" aria-hidden="true" />
            <span>Loading assessment sessions...</span>
          </div>
        ) : (
          <div className="common-table-container">
            <table className="common-table">
              <thead>
                <tr>
                  <th>Intake Role / Course</th>
                  <th>Type</th>
                  <th>Uploaded Date</th>
                  <th>Pipeline Status</th>
                  <th>Overall Score</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const scoreObj = session.scores?.[0];
                  const hasScores = !!scoreObj;

                  return (
                    <tr key={session.id}>
                      <td style={{ fontWeight: 600 }}>
                        {session.extracted_role || (session.intake_mode === 'certificate' ? 'Processing Certificate' : 'General Skill Assessment')}
                        {session.extracted_company && (
                          <span style={{ display: 'block', fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
                            {session.extracted_company}
                          </span>
                        )}
                      </td>
                      <td>
                        <span style={{ textTransform: 'capitalize' }}>
                          {session.intake_mode.replace('_', ' ')}
                        </span>
                      </td>
                      <td>{formatDate(session.created_at)}</td>
                      <td>
                        <StatusBadge
                          variant={
                            session.status === 'scored'
                              ? 'success'
                              : (session.status === 'ocr_done' || session.status === 'verified')
                              ? 'warning'
                              : 'info'
                          }
                        >
                          {session.status === 'scored'
                            ? 'Completed'
                            : (session.status === 'ocr_done' || session.status === 'verified')
                            ? 'Ready for Interview'
                            : 'Verifying'}
                        </StatusBadge>
                      </td>
                      <td style={{ fontWeight: 700, color: scoreColor(scoreObj?.overall_skill_score) }}>
                        {hasScores ? `${formatScore(scoreObj.overall_skill_score)}%` : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {(session.status === 'ocr_done' || session.status === 'verified') && (
                            <Link
                              to={ROUTES.USER.INTERVIEW_CHECK(session.id)}
                              className="common-button common-button--primary common-button--sm"
                            >
                              Start Interview
                            </Link>
                          )}
                          {session.status === 'scored' && (
                            <Link
                              to={ROUTES.USER.REPORT_DETAIL(session.id)}
                              className="common-button common-button--outline common-button--sm"
                            >
                              View Report
                            </Link>
                          )}
                          <Link
                            to={ROUTES.USER.ASSESSMENT_REVIEW(session.id)}
                            className="common-button common-button--secondary common-button--sm"
                          >
                            Details
                          </Link>
                          {session.status !== 'scored' && (
                            <button
                              type="button"
                              onClick={() => setSessionToDelete(session.id)}
                              className="common-button common-button--danger common-button--sm"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reusable Portal Modal for delete verification */}
      <Modal
        open={!!sessionToDelete}
        onClose={() => setSessionToDelete(null)}
        title="Cancel Assessment"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSessionToDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
          Are you sure you want to cancel and delete this assessment session? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
