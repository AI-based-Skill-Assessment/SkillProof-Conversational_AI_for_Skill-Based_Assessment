import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../../components/common/StatusBadge';
import Alert from '../../components/common/Alert';
import { formatDate } from '../../utils/formatDate';
import { formatScore, scoreColor, verdictVariant } from '../../utils/formatScore';
import { apiErrorMessage } from '../../utils/apiError';
import { verdictLabel } from '../../utils/assessmentLabels';
import ROUTES from '../../core/routes';
import client from '../../core/api/client';

const FILTERS = [
  ['all', 'All'],
  ['verified', 'Verified'],
  ['suspicious', 'Suspicious'],
  ['likely_fraudulent', 'Likely fraudulent'],
  ['flagged', 'Flagged'],
];

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await client.get('/org/reports');
        setReports(res.data || []);
      } catch (err) {
        setError(apiErrorMessage(err, 'reports'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const shown = reports.filter(r =>
    filter === 'all' ? true : filter === 'flagged' ? r.flagged : r.verdict === filter
  );

  return (
    <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="page-header">
        <h2 className="page-header__title">Assessment Reports</h2>
        <p className="page-header__subtitle">Completed assessments from candidates connected to your organisation</p>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            style={{
              padding: '6px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer',
              background: filter === key ? 'var(--primary)' : 'transparent',
              color: filter === key ? 'var(--text-on-fill)' : 'var(--text-secondary)',
              border: `1px solid ${filter === key ? 'var(--primary)' : 'var(--border)'}`,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="common-table-container">
        <table className="common-table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Skills</th>
              <th>Type</th>
              <th>Date</th>
              <th>Score</th>
              <th>Integrity</th>
              <th>Verdict</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>Loading…</td></tr>
            )}
            {!loading && shown.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
                  {reports.length === 0
                    ? 'No completed assessments yet. They appear here once a connected candidate finishes an interview.'
                    : 'No reports match this filter.'}
                </td>
              </tr>
            )}
            {shown.map(r => (
              <tr key={r.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{r.candidate_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.candidate_email}</div>
                </td>
                <td>{r.skills?.length ? r.skills.join(', ') : '—'}</td>
                <td>{r.assessment_type === 'skill_only' ? 'Skill interview' : 'Certificate'}</td>
                <td>{formatDate(r.created_at)}</td>
                <td style={{ fontWeight: 700, color: scoreColor(r.score) }}>
                  {r.score != null ? `${formatScore(r.score)}%` : '—'}
                </td>
                <td>
                  {r.flagged
                    ? <StatusBadge variant="error">Flagged</StatusBadge>
                    : r.integrity_score != null
                      ? <span style={{ fontWeight: 600, color: scoreColor(r.integrity_score) }}>{formatScore(r.integrity_score)}</span>
                      : '—'}
                </td>
                <td><StatusBadge variant={verdictVariant(r.verdict)}>{verdictLabel(r.verdict)}</StatusBadge></td>
                <td>
                  <Link
                    to={ROUTES.ORG.CANDIDATE_DETAIL(r.candidate_id)}
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
  );
}
