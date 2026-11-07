import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardBody, StatCard } from '../../components/common/Card';
import Alert from '../../components/common/Alert';
import { formatScore } from '../../utils/formatScore';
import { apiErrorMessage } from '../../utils/apiError';
import client from '../../core/api/client';

const VERDICT_COLORS = {
  verified: 'var(--success)',
  suspicious: 'var(--warning)',
  likely_fraudulent: 'var(--error)',
  in_progress: 'var(--info)',
};

function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** Horizontal bar list: label · bar (scaled to the largest value) · count */
function BarList({ rows, emptyText }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  if (rows.every(r => r.value === 0)) {
    return <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{emptyText}</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map(r => (
        <div key={r.label} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 140px) 1fr 32px', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.label}>
            {r.label}
          </span>
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${(r.value / max) * 100}%`, height: '100%', background: r.color || 'var(--primary)', borderRadius: 4 }} />
          </div>
          <span style={{ fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await client.get('/org/analytics');
        setData(res.data);
      } catch (err) {
        setError(apiErrorMessage(err, 'analytics'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const t = data?.totals;

  return (
    <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="page-header">
        <h2 className="page-header__title">Analytics</h2>
        <p className="page-header__subtitle">How your connected candidates are performing, from their real assessment results</p>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <div className="dashboard-grid">
        <StatCard label="Candidates" value={loading ? '…' : (t?.candidates ?? 0)} icon="👥" />
        <StatCard label="Completed" value={loading ? '…' : (t?.completed ?? 0)} icon="✓" />
        <StatCard label="Flagged for integrity" value={loading ? '…' : (t?.flagged ?? 0)} icon="⚠" />
        <StatCard label="Average score" value={loading ? '…' : (t?.average_score != null ? `${formatScore(t.average_score)}%` : '—')} icon="⚡" />
      </div>

      {data && (
        <div className="grid-2">
          <Card>
            <CardHeader><CardTitle>Verdicts</CardTitle></CardHeader>
            <CardBody>
              <BarList
                rows={data.verification_distribution.map(d => ({ label: d.label, value: d.value, color: VERDICT_COLORS[d.key] }))}
                emptyText="No assessments yet."
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Score distribution</CardTitle></CardHeader>
            <CardBody>
              <BarList
                rows={data.score_distribution.map(d => ({ label: d.range, value: d.count }))}
                emptyText="No scored assessments yet."
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Completed per month</CardTitle></CardHeader>
            <CardBody>
              <BarList
                rows={data.completion_trend.map(d => ({ label: monthLabel(d.month), value: d.count }))}
                emptyText="No completed assessments yet."
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Verified skills</CardTitle></CardHeader>
            <CardBody>
              <BarList
                rows={data.top_skills.map(d => ({ label: d.skill, value: d.count }))}
                emptyText="No skills verified yet."
              />
              {data.top_skills.length > 0 && (
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 12 }}>
                  Number of candidates with a verified assessment in each skill.
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
