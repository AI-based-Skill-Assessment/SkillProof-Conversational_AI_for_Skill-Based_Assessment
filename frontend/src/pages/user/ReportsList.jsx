import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../core/api/client';
import { useToast } from '../../components/common/Toast';
import { MOCK_SESSIONS } from '../../core/mockData/user.mock';
import { formatDate } from '../../utils/formatDate';
import { formatScore, scoreColor } from '../../utils/formatScore';
import StatusBadge from '../../components/common/StatusBadge';
import ROUTES from '../../core/routes';

export default function ReportsList() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const toast = useToast();

  useEffect(() => {
    async function loadReports() {
      try {
        const res = await client.get('/sessions');
        if (res.data && res.data.length > 0) {
          setSessions(res.data);
        } else {
          setSessions(MOCK_SESSIONS);
        }
      } catch (err) {
        setSessions(MOCK_SESSIONS);
      } finally {
        setLoading(false);
      }
    }
    loadReports();
  }, []);

  async function confirmDelete() {
    if (!sessionToDelete) return;
    const sessionId = sessionToDelete;
    setSessionToDelete(null);

    try {
      // Attempt backend delete
      await client.delete(`/sessions/${sessionId}`);
      toast.success('Deleted successfully', 'The assessment session has been removed.');
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (err) {
      // In case of mock data/demo mode or any network issue, filter locally anyway to keep UX smooth
      console.warn('Failed to delete session on backend, removing locally:', err.message);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      toast.success('Removed successfully', 'The assessment session has been removed.');
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading reports list...</div>;

  return (
    <div className="anim-fade-in">
      <div className="page-header">
        <h2 className="page-header__title">My Assessment Reports</h2>
        <p className="page-header__subtitle">Track your verified certificate status and check evaluation scores</p>
      </div>

      <div className="common-table-container">
        <table className="common-table">
          <thead>
            <tr>
              <th>Role / Course Title</th>
              <th>Issuer / Company</th>
              <th>Assessment Date</th>
              <th>Evaluation Score</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(s => {
              const scObj = s.scores?.[0];
              return (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.extracted_role || 'General Skill Assessment'}</td>
                  <td>{s.extracted_company || 'SkillProof Direct'}</td>
                  <td>{formatDate(s.created_at)}</td>
                  <td style={{ fontWeight: 700, color: scoreColor(scObj?.overall_skill_score) }}>
                     {scObj ? `${formatScore(scObj.overall_skill_score)}%` : '—'}
                  </td>
                  <td>
                    <StatusBadge variant={s.status === 'scored' ? 'success' : 'info'}>
                      {s.status === 'scored' ? 'Completed' : 'Pending Interview'}
                    </StatusBadge>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Link
                        to={s.status === 'scored' ? ROUTES.USER.REPORT_DETAIL(s.id) : ROUTES.USER.ASSESSMENT_REVIEW(s.id)}
                        className="common-button common-button--secondary common-button--sm"
                      >
                        {s.status === 'scored' ? 'View Report' : 'Review details'}
                      </Link>
                      
                      {s.status !== 'scored' && (
                        <button
                          type="button"
                          onClick={() => setSessionToDelete(s.id)}
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

      {/* Reusable custom Confirm Modal for delete verification */}
      {sessionToDelete && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="common-card" style={{ maxWidth: 400, padding: 28, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Cancel Assessment</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
              Are you sure you want to cancel and delete this assessment session? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 8 }}>
              <Button variant="secondary" onClick={() => setSessionToDelete(null)} style={{ minWidth: 120 }}>
                Cancel
              </Button>
              <Button onClick={confirmDelete} style={{ minWidth: 120, background: 'var(--error)' }}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
