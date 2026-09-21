import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MOCK_CANDIDATES, MOCK_ORG_STATS } from '../../core/mockData/org.mock';
import { StatCard } from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate } from '../../utils/formatDate';
import { formatScore, scoreColor } from '../../utils/formatScore';
import ROUTES from '../../core/routes';
import '../../styles/pages/portal.css';

const STORAGE_KEY_CANDIDATES = 'skillproof_org_candidates';

export default function Dashboard() {
  const [candidates, setCandidates] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CANDIDATES);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const stats = {
    total_candidates: candidates.length,
    verified_assessments: candidates.filter(c => c.latest_status === 'verified').length,
    pending_assessments: candidates.filter(c => c.latest_status !== 'verified').length,
    average_skill_score: candidates.length > 0 
      ? Math.round(candidates.reduce((acc, c) => acc + (c.average_score || 0), 0) / candidates.length)
      : 0,
  };

  return (
    <div className="anim-fade-in">
      <div className="page-header">
        <h2 className="page-header__title">Placement Dashboard</h2>
        <p className="page-header__subtitle">Manage students connected to NIT Trichy placement verification cell</p>
      </div>

      {/* Org Stats */}
      <div className="dashboard-grid">
        <StatCard
          label="Total Candidates"
          value={stats.total_candidates}
          icon="👥"
          accentColor="rgba(14, 165, 233, 0.25)"
        />
        <StatCard
          label="Verified Reports"
          value={stats.verified_assessments}
          icon="✓"
          accentColor="rgba(16, 185, 129, 0.25)"
        />
        <StatCard
          label="Pending Audits"
          value={stats.pending_assessments}
          icon="⏳"
          accentColor="rgba(245, 158, 11, 0.25)"
        />
        <StatCard
          label="Avg Score"
          value={`${formatScore(stats.average_skill_score)}%`}
          icon="⚡"
          accentColor="rgba(139, 92, 246, 0.25)"
        />
      </div>

      {/* Connected Candidates list */}
      <div className="dashboard-section">
        <div className="dashboard-section__header">
          <h3 style={{ fontSize: 18, fontWeight: 700 }}>Recently Linked Student Profiles</h3>
          <Link to={ROUTES.ORG.CANDIDATES} style={{ fontSize: 14, fontWeight: 600 }}>
            View All Students
          </Link>
        </div>

        <div className="common-table-container">
          <table className="common-table">
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Email Address</th>
                <th>Connected Date</th>
                <th>Biometrics</th>
                <th>Reports Shared</th>
                <th>Last Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {candidates.slice(0, 5).map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.full_name}</td>
                  <td>{c.email}</td>
                  <td>{formatDate(c.connected_at)}</td>
                  <td>
                    <span style={{ fontSize: 12 }}>
                      📸 {c.face_registered ? '✓' : '✗'} • 🎙 {c.voice_registered ? '✓' : '✗'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{c.reports_shared} reports</td>
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
                      Audit
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
