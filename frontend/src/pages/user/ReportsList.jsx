import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../core/api/client';
import { MOCK_SESSIONS } from '../../core/mockData/user.mock';
import { formatDate } from '../../utils/formatDate';
import { formatScore, scoreColor } from '../../utils/formatScore';
import StatusBadge from '../../components/common/StatusBadge';
import ROUTES from '../../core/routes';

export default function ReportsList() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

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
                    <Link
                      to={s.status === 'scored' ? ROUTES.USER.REPORT_DETAIL(s.id) : ROUTES.USER.ASSESSMENT_REVIEW(s.id)}
                      className="common-button common-button--secondary common-button--sm"
                    >
                      {s.status === 'scored' ? 'View Report' : 'Review details'}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
