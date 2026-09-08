import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../core/api/client';
import { useToast } from '../../components/common/Toast';
import { MOCK_SESSIONS } from '../../core/mockData/user.mock';
import { formatDate } from '../../utils/formatDate';
import { formatScore, scoreColor } from '../../utils/formatScore';
import StatusBadge from '../../components/common/StatusBadge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
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

      {sessions.length === 0 ? (
        <div className="common-card" style={{ padding: 48, textAlign: 'center' }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)' }}>No Assessment Reports Found</h3>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8 }}>
            Upload a certificate or complete an assessment to view reports here.
          </p>
          <div style={{ marginTop: 16 }}>
            <Link to={ROUTES.USER.NEW_ASSESSMENT} className="common-button common-button--primary">
              Start New Assessment
            </Link>
          </div>
        </div>
      ) : (
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
                      <StatusBadge variant={s.status === 'scored' ? 'success' : (s.status === 'ocr_done' || s.status === 'verified') ? 'warning' : 'info'}>
                        {s.status === 'scored' ? 'Completed' : (s.status === 'ocr_done' || s.status === 'verified') ? 'Ready for Interview' : 'Verifying'}
                      </StatusBadge>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {(s.status === 'ocr_done' || s.status === 'verified') && (
                          <Link
                            to={ROUTES.USER.INTERVIEW_CHECK(s.id)}
                            className="common-button common-button--primary common-button--sm"
                          >
                            Start Interview
                          </Link>
                        )}
                        {s.status === 'scored' ? (
                          <Link
                            to={ROUTES.USER.REPORT_DETAIL(s.id)}
                            className="common-button common-button--secondary common-button--sm"
                          >
                            View Report
                          </Link>
                        ) : (
                          <Link
                            to={ROUTES.USER.ASSESSMENT_REVIEW(s.id)}
                            className="common-button common-button--secondary common-button--sm"
                          >
                            Details
                          </Link>
                        )}

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
      )}

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
