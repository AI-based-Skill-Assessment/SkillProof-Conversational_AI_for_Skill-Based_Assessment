import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card, CardBody, StatCard } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Alert from '../../components/common/Alert';
import StatusBadge from '../../components/common/StatusBadge';
import QRDisplay from '../../components/common/QRDisplay';
import { useToast } from '../../components/common/Toast';
import { formatDate, formatDateTime } from '../../utils/formatDate';
import { formatScore, scoreColor, verdictVariant } from '../../utils/formatScore';
import { apiErrorMessage } from '../../utils/apiError';
import { statusLabel, statusVariant, verdictLabel } from '../../utils/assessmentLabels';
import { driveStatusBadge } from './Drives';
import ROUTES from '../../core/routes';
import client from '../../core/api/client';

const FILTERS = [
  ['all', 'All'],
  ['completed', 'Completed'],
  ['passing', 'Meets pass mark'],
  ['shortlisted', 'Shortlisted'],
  ['flagged', 'Flagged'],
];

const DECISION_BADGE = {
  shortlisted: <StatusBadge variant="success">Shortlisted</StatusBadge>,
  rejected: <StatusBadge variant="error">Rejected</StatusBadge>,
  pending: <StatusBadge variant="neutral">Pending</StatusBadge>,
};

export default function DriveDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [drive, setDrive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState('');

  const load = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      const res = await client.get(`/org/drives/${id}`);
      setDrive(res.data);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'drive'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(true); }, [load]);

  const inviteLink = drive ? `${window.location.origin}${ROUTES.USER.JOIN_DRIVE(drive.invite_code)}` : '';

  async function copy(text, what) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied', `${what} copied to clipboard.`);
    } catch {
      toast.error('Copy failed', 'Select the text and copy it manually.');
    }
  }

  async function setDecision(row, decision) {
    try {
      setBusy(row.session_id);
      await client.post(`/org/drives/${id}/candidates/${row.session_id}/decision`, { decision });
      // Update in place so the table doesn't jump around
      setDrive(d => {
        const candidates = d.candidates.map(c => c.session_id === row.session_id ? { ...c, decision } : c);
        return { ...d, candidates, shortlisted: candidates.filter(c => c.decision === 'shortlisted').length };
      });
    } catch (err) {
      toast.error('Could not save decision', apiErrorMessage(err, 'decision'));
    } finally {
      setBusy('');
    }
  }

  async function toggleOpen() {
    const next = drive.status === 'open' ? 'closed' : 'open';
    try {
      setBusy('status');
      await client.patch(`/org/drives/${id}`, { status: next });
      toast.success(next === 'open' ? 'Drive reopened' : 'Drive closed',
        next === 'open' ? 'Candidates can join again.' : 'No new candidates can join. Existing attempts can still finish.');
      await load();
    } catch (err) {
      toast.error('Could not update drive', apiErrorMessage(err, 'drive'));
    } finally {
      setBusy('');
    }
  }

  async function exportCsv() {
    try {
      setBusy('csv');
      const res = await client.get(`/org/drives/${id}/export.csv`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `drive-${drive.invite_code}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Export failed', apiErrorMessage(err, 'export'));
    } finally {
      setBusy('');
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading drive…</div>;
  }
  if (error || !drive) {
    return (
      <div className="anim-fade-in" style={{ maxWidth: 600, margin: '40px auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Alert type="error">{error || 'Drive not found.'}</Alert>
        <div><Button variant="secondary" onClick={() => navigate(ROUTES.ORG.DRIVES)}>Back to Drives</Button></div>
      </div>
    );
  }

  const rows = drive.candidates.filter(c => {
    if (filter === 'completed') return c.rank != null;
    if (filter === 'passing') return c.meets_min_score === true;
    if (filter === 'shortlisted') return c.decision === 'shortlisted';
    if (filter === 'flagged') return c.flagged;
    return true;
  });

  return (
    <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header page-header--row">
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 className="page-header__title">{drive.title}</h2>
            {driveStatusBadge(drive)}
          </div>
          <p className="page-header__subtitle">
            {[drive.role, drive.skills.join(', ')].filter(Boolean).join(' · ')}
            {drive.deadline && ` · Deadline ${formatDateTime(drive.deadline)}`}
            {drive.min_score != null && ` · Pass mark ${formatScore(drive.min_score)}`}
          </p>
        </div>
        <div className="page-header__actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => navigate(ROUTES.ORG.DRIVES)}>All Drives</Button>
          <Button variant="secondary" onClick={exportCsv} loading={busy === 'csv'} disabled={drive.joined === 0}>Export CSV</Button>
          <Button variant={drive.status === 'open' ? 'danger' : 'primary'} onClick={toggleOpen} loading={busy === 'status'}>
            {drive.status === 'open' ? 'Close Drive' : 'Reopen Drive'}
          </Button>
        </div>
      </div>

      <Card>
        <CardBody style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: 132, flexShrink: 0 }}>
            <QRDisplay value={inviteLink} darkColor="#000000" lightColor="#ffffff" />
          </div>
          <div style={{ flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontWeight: 700 }}>Invite candidates</div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              Share this link or QR code. Students sign in, take the AI interview on these skills, and appear in the ranking below.
              They can also type the code on their <em>Placement Drives</em> page.
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <code style={{ fontSize: 13, padding: '6px 10px', background: 'var(--surface-hover)', borderRadius: 6, overflowWrap: 'anywhere', flex: '1 1 240px' }}>
                {inviteLink}
              </code>
              <Button size="sm" variant="secondary" onClick={() => copy(inviteLink, 'Invite link')}>Copy link</Button>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Code</span>
              <code style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.12em' }}>{drive.invite_code}</code>
              <Button size="sm" variant="secondary" onClick={() => copy(drive.invite_code, 'Invite code')}>Copy</Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {drive.description && <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{drive.description}</p>}

      <div className="dashboard-grid">
        <StatCard label="Joined" value={drive.joined} icon="👥" />
        <StatCard label="Completed" value={drive.completed} icon="✓" />
        <StatCard label={drive.min_score != null ? 'Meet pass mark' : 'Shortlisted'} value={drive.min_score != null ? drive.passed : drive.shortlisted} icon="★" />
        <StatCard label="Average score" value={drive.average_score != null ? `${formatScore(drive.average_score)}%` : '—'} icon="⚡" />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {FILTERS.filter(([k]) => k !== 'passing' || drive.min_score != null).map(([key, label]) => (
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
              <th>Rank</th>
              <th>Candidate</th>
              <th>Status</th>
              <th>Score</th>
              <th>Verdict</th>
              <th>Integrity</th>
              <th>Decision</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 36, color: 'var(--text-secondary)' }}>
                  {drive.joined === 0 ? 'No candidates yet. Share the invite link to get started.' : 'No candidates match this filter.'}
                </td>
              </tr>
            )}
            {rows.map(c => (
              <tr key={c.session_id}>
                <td style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{c.rank ?? '—'}</td>
                <td>
                  {c.candidate_id
                    ? <Link to={ROUTES.ORG.CANDIDATE_DETAIL(c.candidate_id)} style={{ fontWeight: 600 }}>{c.full_name}</Link>
                    : <span style={{ fontWeight: 600 }}>{c.full_name}</span>}
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.email} · started {formatDate(c.started_at)}</div>
                </td>
                <td><StatusBadge variant={statusVariant(c.status)}>{statusLabel(c.status)}</StatusBadge></td>
                <td>
                  <span style={{ fontWeight: 700, color: scoreColor(c.score) }}>{c.score != null ? `${formatScore(c.score)}%` : '—'}</span>
                  {c.meets_min_score === false && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>below pass mark</div>}
                </td>
                <td>{c.verdict ? <StatusBadge variant={verdictVariant(c.verdict)}>{verdictLabel(c.verdict)}</StatusBadge> : '—'}</td>
                <td>
                  {c.flagged
                    ? <StatusBadge variant="error">Flagged</StatusBadge>
                    : c.integrity_score != null
                      ? <span style={{ fontWeight: 600, color: scoreColor(c.integrity_score) }}>{formatScore(c.integrity_score)}</span>
                      : '—'}
                </td>
                <td>{DECISION_BADGE[c.decision] || DECISION_BADGE.pending}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {c.decision !== 'shortlisted' && (
                      <Button size="sm" onClick={() => setDecision(c, 'shortlisted')} disabled={busy === c.session_id}>Shortlist</Button>
                    )}
                    {c.decision !== 'rejected' && (
                      <Button size="sm" variant="secondary" onClick={() => setDecision(c, 'rejected')} disabled={busy === c.session_id}>Reject</Button>
                    )}
                    {c.decision !== 'pending' && (
                      <Button size="sm" variant="ghost" onClick={() => setDecision(c, 'pending')} disabled={busy === c.session_id}>Undo</Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
