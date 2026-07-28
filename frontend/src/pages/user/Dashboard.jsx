import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import client from '../../core/api/client';
import { EP } from '../../core/api/endpoints';
import { MOCK_SESSIONS, MOCK_DASHBOARD_STATS } from '../../core/mockData/user.mock';
import { StatCard } from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate } from '../../utils/formatDate';
import { formatScore, scoreColor, verdictVariant } from '../../utils/formatScore';
import Button from '../../components/common/Button';
import ROUTES from '../../core/routes';
import '../../styles/pages/portal.css';

export default function Dashboard() {
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(MOCK_DASHBOARD_STATS);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        // Call real backend endpoint to fetch candidate's sessions
        const res = await client.get('/sessions');
        
        if (res.data && res.data.length > 0) {
          setSessions(res.data);
          setIsDemo(false);
          
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
          setIsDemo(true);
        }
      } catch (err) {
        console.error('Failed to load sessions from API, running in Demo Mode:', err);
        // Fall back on error (no database connection / server offline)
        setSessions(MOCK_SESSIONS);
        setStats(MOCK_DASHBOARD_STATS);
        setIsDemo(true);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

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

      {isDemo && (
        <div className="common-alert common-alert--info" style={{ marginBottom: 24 }}>
          <strong>Demo Mode:</strong> No live sessions found on the server. Showing mock data for demonstration.
        </div>
      )}

      {/* Stats Cards */}
      <div className="dashboard-grid">
        <StatCard
          label="Total Assessments"
          value={stats.completed_assessments}
          icon="📄"
        />
        <StatCard
          label="Verified Credentials"
          value={stats.verified_certificates}
          icon="✓"
        />
        <StatCard
          label="Avg Skill Score"
          value={stats.average_skill_score > 0 ? `${formatScore(stats.average_skill_score)}%` : '—'}
          icon="⚡"
        />
        <StatCard
          label="Linked Orgs"
          value={stats.shared_organisations}
          icon="🎓"
        />
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
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading sessions...</div>
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
                              : session.status === 'ocr_done'
                              ? 'warning'
                              : 'info'
                          }
                        >
                          {session.status === 'scored'
                            ? 'Completed'
                            : session.status === 'ocr_done'
                            ? 'Ready for Interview'
                            : 'Verifying'}
                        </StatusBadge>
                      </td>
                      <td style={{ fontWeight: 700, color: scoreColor(scoreObj?.overall_skill_score) }}>
                        {hasScores ? `${formatScore(scoreObj.overall_skill_score)}%` : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {session.status === 'ocr_done' && (
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
    </div>
  );
}
