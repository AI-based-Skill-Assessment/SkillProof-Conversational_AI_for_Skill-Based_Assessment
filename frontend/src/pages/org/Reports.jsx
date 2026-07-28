import { useState } from 'react';
import { MOCK_ORG_REPORTS } from '../../core/mockData/org.mock';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate } from '../../utils/formatDate';
import { formatScore, scoreColor } from '../../utils/formatScore';

export default function Reports() {
  const [reports] = useState(MOCK_ORG_REPORTS);

  return (
    <div className="anim-fade-in">
      <div className="page-header">
        <h2 className="page-header__title">Student Verification Reports</h2>
        <p className="page-header__subtitle">Access all secure PDF reports shared by candidates connected to your institution</p>
      </div>

      <div className="common-table-container">
        <table className="common-table">
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Email</th>
              <th>Assessment Mode</th>
              <th>Evaluated Skill</th>
              <th>Shared Date</th>
              <th>Overall Score</th>
              <th>Integrity Verdict</th>
            </tr>
          </thead>
          <tbody>
            {reports.map(r => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.candidate_name}</td>
                <td>{r.candidate_email}</td>
                <td style={{ textTransform: 'capitalize' }}>{r.assessment_type}</td>
                <td>{r.skill}</td>
                <td>{formatDate(r.shared_at)}</td>
                <td style={{ fontWeight: 700, color: scoreColor(r.score) }}>{formatScore(r.score)}%</td>
                <td>
                  <StatusBadge variant={r.verdict === 'verified' ? 'success' : 'warning'}>
                    {r.verdict.toUpperCase()}
                  </StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
