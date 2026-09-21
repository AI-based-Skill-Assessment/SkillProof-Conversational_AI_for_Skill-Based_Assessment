import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MOCK_CANDIDATES } from '../../core/mockData/org.mock';
import StatusBadge from '../../components/common/StatusBadge';
import Button from '../../components/common/Button';
import { useToast } from '../../components/common/Toast';
import { formatDate } from '../../utils/formatDate';
import ROUTES from '../../core/routes';

const STORAGE_KEY_REQUESTS = 'skillproof_org_requests';
const STORAGE_KEY_CONNS = 'skillproof_user_connections';
const STORAGE_KEY_CANDIDATES = 'skillproof_org_candidates';

export default function Candidates() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'requests'

  // Active candidates list (only real approved linkages)
  const [candidates, setCandidates] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CANDIDATES);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      const mockNames = ['Arjun Sharma', 'Priya Nair', 'Rohan Mehta', 'Sneha Iyer'];
      return parsed.filter(c => !mockNames.includes(c.full_name));
    } catch {
      return [];
    }
  });

  // Pending incoming requests (only real student connection requests)
  const [requests, setRequests] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_REQUESTS);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      const mockReqNames = ['Aditi Rao', 'Karthik Raja'];
      return parsed.filter(r => !mockReqNames.includes(r.candidate_name));
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('skillproof_org_candidates', JSON.stringify(candidates));
  }, [candidates]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(requests));
  }, [requests]);

  const handleApprove = (req) => {
    // 1. Remove from pending requests
    const updatedRequests = requests.filter(r => r.id !== req.id);
    setRequests(updatedRequests);

    // 2. Add to active candidates
    const newCandidate = {
      id: req.candidate_id || `cand-${Date.now()}`,
      full_name: req.candidate_name,
      email: req.candidate_email,
      connected_at: new Date().toISOString().split('T')[0],
      reports_shared: 1,
      assessments_count: req.assessments_count || 1,
      average_score: req.average_score || 85,
      face_registered: req.face_registered ?? true,
      voice_registered: req.voice_registered ?? true,
      latest_status: 'verified',
    };
    setCandidates(prev => [newCandidate, ...prev]);

    // 3. Update candidate's connection status in localStorage
    try {
      const userConns = JSON.parse(localStorage.getItem(STORAGE_KEY_CONNS) || '[]');
      const updatedConns = userConns.map(c => {
        if (c.id === req.org_id || c.name === req.org_name || req.org_name?.includes(c.name)) {
          return { ...c, status: 'approved' };
        }
        return c;
      });
      localStorage.setItem(STORAGE_KEY_CONNS, JSON.stringify(updatedConns));
    } catch (e) {
      console.error(e);
    }

    toast.success('Linkage Approved', `${req.candidate_name} is now an active linked candidate.`);
  };

  const handleDecline = (req) => {
    const updatedRequests = requests.filter(r => r.id !== req.id);
    setRequests(updatedRequests);
    toast.info('Request Declined', `Connection request from ${req.candidate_name} was removed.`);
  };

  return (
    <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 className="page-header__title">Student Candidates & Requests</h2>
          <p className="page-header__subtitle">Manage student candidate linkages, incoming access authorizations, and verification reports</p>
        </div>
      </div>

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
            color: activeTab === 'active' ? '#FFFFFF' : 'var(--text-secondary)',
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
            color: activeTab === 'requests' ? '#FFFFFF' : 'var(--text-secondary)',
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
              background: activeTab === 'requests' ? 'rgba(255,255,255,0.25)' : 'var(--error)',
              color: '#FFFFFF',
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
      {activeTab === 'active' && (
        <div className="common-table-container">
          <table className="common-table">
            <thead>
              <tr>
                <th>Candidate Name</th>
                <th>Email</th>
                <th>Connected At</th>
                <th>Assessments Taken</th>
                <th>Biometrics Ready</th>
                <th>Latest Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {candidates.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                    No connected candidates yet. Approve incoming connection requests to link students.
                  </td>
                </tr>
              ) : (
                candidates.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.full_name}</td>
                    <td>{c.email}</td>
                    <td>{formatDate(c.connected_at)}</td>
                    <td style={{ fontWeight: 600 }}>{c.assessments_count} assessments</td>
                    <td>
                      <span style={{ fontSize: 12 }}>
                        Face: {c.face_registered ? '✅' : '❌'} • Voice: {c.voice_registered ? '✅' : '❌'}
                      </span>
                    </td>
                    <td>
                      <StatusBadge variant={c.latest_status === 'verified' ? 'success' : 'info'}>
                        {c.latest_status.toUpperCase()}
                      </StatusBadge>
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
