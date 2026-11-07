import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { StatCard } from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';
import Alert from '../../components/common/Alert';
import { useAuth } from '../../core/auth/AuthContext';
import { formatDate } from '../../utils/formatDate';
import { formatScore, scoreColor } from '../../utils/formatScore';
import { apiErrorMessage } from '../../utils/apiError';
import { statusLabel, statusVariant } from '../../utils/assessmentLabels';
import ROUTES from '../../core/routes';
import client from '../../core/api/client';
import '../../styles/pages/portal.css';

export default function Dashboard() {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [totals, setTotals] = useState(null);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [cands, analytics, requests] = await Promise.all([
          client.get('/org/candidates'),
          client.get('/org/analytics'),
          client.get('/auth/org/candidates/requests'),
        ]);
        setCandidates(cands.data || []);
        setTotals(analytics.data?.totals || null);
        setPendingRequests((requests.data || []).filter(r => r.status === 'pending').length);
      } catch (err) {
        setError(apiErrorMessage(err, 'dashboard'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const recent = [...candidates]
    .sort((a, b) => (b.connected_at || '').localeCompare(a.connected_at || ''))
    .slice(0, 5);

  return (
    <div className="anim-fade-in">
      <div className="page-header">
        <h2 className="page-header__title">Placement Dashboard</h2>
        <p className="page-header__subtitle">
          Candidates connected to {user?.name || 'your organisation'} and their verified assessments
        </p>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {pendingRequests > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Alert type="info">
            {pendingRequests} candidate{pendingRequests === 1 ? ' is' : 's are'} waiting for approval.{' '}
            <Link to={ROUTES.ORG.CANDIDATES} style={{ fontWeight: 600 }}>Review requests</Link>
          </Alert>
        </div>
      )}

      <div className="dashboard-grid">
        <StatCard label="Connected Candidates" value={loading ? '…' : (totals?.candidates ?? 0)} icon="👥" />
        <StatCard label="Completed Assessments" value={loading ? '…' : (totals?.completed ?? 0)} icon="✓" />
        <StatCard label="In Progress" value={loading ? '…' : (totals?.in_progress ?? 0)} icon="⏳" />
        <StatCard
          label="Average Score"
          value={loading ? '…' : (totals?.average_score != null ? `${formatScore(totals.average_score)}%` : '—')}
          icon="⚡"
        />
      </div>

      <div className="dashboard-section">
        <div className="dashboard-section__header">
          <h3 style={{ fontSize: 18, fontWeight: 700 }}>Recently Connected Candidates</h3>
          <Link to={ROUTES.ORG.CANDIDATES} style={{ fontSize: 14, fontWeight: 600 }}>
            View All Candidates
          </Link>
        </div>

        <div className="common-table-container">
          <table className="common-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Connected</th>
                <th>Assessments</th>
                <th>Avg Score</th>
                <th>Integrity</th>
                <th>Latest Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {!loading && recent.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
                    No connected candidates yet. Candidates appear here once they connect to your organisation and you approve them.
                  </td>
                </tr>
              )}
              {recent.map(c => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.full_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.email}</div>
                  </td>
                  <td>{formatDate(c.connected_at)}</td>
                  <td style={{ fontWeight: 600 }}>{c.completed_count} / {c.assessments_count}</td>
                  <td style={{ fontWeight: 700, color: scoreColor(c.average_score) }}>
                    {c.average_score != null ? `${formatScore(c.average_score)}%` : '—'}
                  </td>
                  <td>
                    {c.flagged
                      ? <StatusBadge variant="error">Flagged</StatusBadge>
                      : c.integrity_score != null
                        ? <span style={{ fontWeight: 600, color: scoreColor(c.integrity_score) }}>{formatScore(c.integrity_score)}</span>
                        : '—'}
                  </td>
                  <td>
                    <StatusBadge variant={statusVariant(c.latest_status)}>{statusLabel(c.latest_status)}</StatusBadge>
                  </td>
                  <td>
                    <Link
                      to={ROUTES.ORG.CANDIDATE_DETAIL(c.id)}
                      className="common-button common-button--secondary common-button--sm"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
