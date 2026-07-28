import { useEffect, useState } from 'react';
import client from '../../core/api/client';
import { MOCK_ADMIN_ASSESSMENTS } from '../../core/mockData/admin.mock';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate } from '../../utils/formatDate';

export default function Assessments() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAssessments() {
      try {
        const res = await client.get('/admin/assessments');
        setItems(res.data);
      } catch (err) {
        setItems(MOCK_ADMIN_ASSESSMENTS);
      } finally {
        setLoading(false);
      }
    }
    loadAssessments();
  }, []);

  return (
    <div className="anim-fade-in">
      <div className="page-header">
        <h2 className="page-header__title">Verification Pipelines</h2>
        <p className="page-header__subtitle">Review active and completed evaluation sessions across all portals</p>
      </div>

      {loading ? (
        <div>Loading sessions...</div>
      ) : (
        <div className="common-table-container">
          <table className="common-table">
            <thead>
              <tr>
                <th>Candidate Name</th>
                <th>Email Address</th>
                <th>Intake Type</th>
                <th>Assessed Role</th>
                <th>Extracted Skills</th>
                <th>Created At</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.candidate_name}</td>
                  <td>{s.candidate_email}</td>
                  <td style={{ textTransform: 'capitalize' }}>{s.intake_mode}</td>
                  <td style={{ fontWeight: 600 }}>{s.extracted_role || 'Not set'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {s.extracted_skills?.map(sk => (
                        <span key={sk} style={{ background: 'var(--surface-hover)', fontSize: 11, padding: '2px 6px', borderRadius: 4 }}>
                          {sk}
                        </span>
                      )) || '—'}
                    </div>
                  </td>
                  <td>{formatDate(s.created_at)}</td>
                  <td>
                    <StatusBadge variant={s.status === 'scored' ? 'success' : s.status === 'ocr_done' ? 'warning' : 'info'}>
                      {s.status.toUpperCase()}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
