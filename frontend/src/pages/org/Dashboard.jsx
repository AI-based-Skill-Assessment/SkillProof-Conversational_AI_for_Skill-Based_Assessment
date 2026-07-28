import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MOCK_CANDIDATES, MOCK_ORG_STATS } from '../../core/mockData/org.mock';
import { StatCard } from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate } from '../../utils/formatDate';
import { formatScore, scoreColor } from '../../utils/formatScore';
import ROUTES from '../../core/routes';
import '../../styles/pages/portal.css';

export default function Dashboard() {
  const [candidates, setCandidates] = useState(MOCK_CANDIDATES);
  const [stats, setStats] = useState(MOCK_ORG_STATS);

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
        />
        <StatCard
          label="Verified Reports"
          value={stats.verified_assessments}
          icon="✓"
        />
        <StatCard
          label="Pending Audits"
          value={stats.pending_assessments}
          icon="⏳"
        />
        <StatCard
          label="Avg Score"
          value={`${formatScore(stats.average_skill_score)}%`}
          icon="⚡"
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
