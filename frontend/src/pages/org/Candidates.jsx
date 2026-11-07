import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../../components/common/StatusBadge';
import Button from '../../components/common/Button';
import { useToast } from '../../components/common/Toast';
import { formatDate } from '../../utils/formatDate';
import Alert from '../../components/common/Alert';
import { formatScore, scoreColor } from '../../utils/formatScore';
import { apiErrorMessage } from '../../utils/apiError';
import { statusLabel, statusVariant } from '../../utils/assessmentLabels';
import ROUTES from '../../core/routes';

import client from '../../core/api/client';

export default function Candidates() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'requests'
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState([]);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      const [linksRes, candidatesRes] = await Promise.all([
        client.get('/auth/org/candidates/requests'),
        client.get('/org/candidates'),
      ]);
      setRequests((linksRes.data || []).filter(l => l.status === 'pending'));
      setCandidates(candidatesRes.data || []);
    } catch (err) {
      setError(apiErrorMessage(err, 'candidates'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? candidates.filter(c => `${c.full_name} ${c.email}`.toLowerCase().includes(q))
    : candidates;

  const handleApprove = async (req) => {
    try {
      await client.post(`/auth/org/candidates/requests/${req.id}/status?action=approve`);
      toast.success('Linkage Approved', `${req.candidate_name} is now an active linked candidate.`);
      loadData();
    } catch (err) {
      toast.error('Approval Failed', err.response?.data?.detail || 'Could not approve candidate linkage.');
    }
  };

  const handleDecline = async (req) => {
    try {
      await client.post(`/auth/org/candidates/requests/${req.id}/status?action=reject`);
      toast.info('Request Declined', `Connection request from ${req.candidate_name} was declined.`);
      loadData();
    } catch (err) {
      toast.error('Decline Failed', err.response?.data?.detail || 'Could not decline candidate linkage.');
    }
  };


  return (
    <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 className="page-header__title">Student Candidates & Requests</h2>
          <p className="page-header__subtitle">Manage student candidate linkages, incoming access authorizations, and verification reports</p>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          style={{
            padding: '8px 18px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '14px',
            background: activeTab === 'active' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'active' ? 'var(--text-on-fill)' : 'var(--text-secondary)',
            border: activeTab === 'active' ? '1px solid var(--primary)' : '1px solid var(--border)',
            cursor: 'pointer',
            transition: 'all 180ms ease'
          }}
        >
          Connected Candidates ({candidates.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('requests')}
          style={{
            padding: '8px 18px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '14px',
            background: activeTab === 'requests' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'requests' ? 'var(--text-on-fill)' : 'var(--text-secondary)',
            border: activeTab === 'requests' ? '1px solid var(--primary)' : '1px solid var(--border)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 180ms ease'
          }}
        >
          Incoming Connection Requests
          {requests.length > 0 && (
            <span style={{
              background: activeTab === 'requests' ? 'color-mix(in srgb, var(--text-on-fill) 20%, transparent)' : 'var(--error)',
              color: 'var(--text-on-fill)',
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: '10px'
            }}>
              {requests.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content: Active Candidates */}
      {activeTab === 'active' && candidates.length > 0 && (
        <input
          type="search"
          className="common-input__field"
          placeholder="Search by name or email…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ maxWidth: 360 }}
          aria-label="Search candidates"
        />
      )}

      {activeTab === 'active' && (
        <div className="common-table-container">
          <table className="common-table">
            <thead>
              <tr>
                <th>Candidate Name</th>
                <th>Email</th>
                <th>Connected At</th>
                <th>Assessments</th>
                <th>Avg Score</th>
                <th>Biometrics</th>
                <th>Latest Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>Loading…</td>
                </tr>
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                    No connected candidates yet. Approve incoming connection requests to link students.
                  </td>
                </tr>
              ) : (
                filtered.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.full_name}</td>
                    <td>{c.email}</td>
                    <td>{formatDate(c.connected_at)}</td>
                    <td style={{ fontWeight: 600 }}>{c.completed_count} completed / {c.assessments_count}</td>
                    <td style={{ fontWeight: 700, color: scoreColor(c.average_score) }}>
                      {c.average_score != null ? `${formatScore(c.average_score)}%` : '—'}
                    </td>
                    <td>
                      <span style={{ fontSize: 12 }}>
                        Face: {c.face_registered ? '✅' : '❌'} • Voice: {c.voice_registered ? '✅' : '❌'}
                      </span>
                    </td>
                    <td>
                      <StatusBadge variant={statusVariant(c.latest_status)}>
                        {statusLabel(c.latest_status)}
                      </StatusBadge>
                      {c.flagged && (
                        <div style={{ marginTop: 4 }}><StatusBadge variant="error">Flagged</StatusBadge></div>
                      )}
                    </td>
                    <td>
                      <Link
                        to={ROUTES.ORG.CANDIDATE_DETAIL(c.id)}
                        className="common-button common-button--secondary common-button--sm"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab Content: Incoming Connection Requests */}
      {activeTab === 'requests' && (
        <div className="common-table-container">
          <table className="common-table">
            <thead>
              <tr>
                <th>Student Candidate</th>
                <th>Email</th>
                <th>Requested Date</th>
                <th>Biometrics Completed</th>
                <th>Status</th>
                <th>Authorization Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                    ✨ All caught up! No pending candidate connection requests.
                  </td>
                </tr>
              ) : (
                requests.map(req => (
                  <tr key={req.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{req.candidate_name}</div>
                      {req.org_name && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Target: {req.org_name}</div>}
                    </td>
                    <td>{req.candidate_email}</td>
                    <td>{formatDate(req.requested_at)}</td>
                    <td>
                      <span style={{ fontSize: 12 }}>
                        Face: {req.face_registered ? '✅' : '❌'} • Voice: {req.voice_registered ? '✅' : '❌'}
                      </span>
                    </td>
                    <td>
                      <StatusBadge variant="warning">
                        PENDING APPROVAL
                      </StatusBadge>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(req)}
                          style={{ background: 'var(--success)', borderColor: 'var(--success)' }}
                        >
                          ✓ Approve Linkage
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleDecline(req)}
                        >
                          Decline
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
