import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MOCK_CANDIDATES } from '../../core/mockData/org.mock';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate } from '../../utils/formatDate';
import ROUTES from '../../core/routes';

export default function Candidates() {
  const [candidates] = useState(MOCK_CANDIDATES);

  return (
    <div className="anim-fade-in">
      <div className="page-header">
        <h2 className="page-header__title">Student Candidates List</h2>
        <p className="page-header__subtitle">Search and audit all student profiles connected to your organisation</p>
      </div>

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
            {candidates.map(c => (
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
