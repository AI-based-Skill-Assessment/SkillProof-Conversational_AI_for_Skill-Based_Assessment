import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardBody } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Alert from '../../components/common/Alert';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate } from '../../utils/formatDate';
import { apiErrorMessage } from '../../utils/apiError';
import { statusLabel, statusVariant } from '../../utils/assessmentLabels';
import { driveAttemptRoute } from './JoinDrive';
import ROUTES from '../../core/routes';
import client from '../../core/api/client';

export default function Drives() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await client.get('/drives/mine');
        setDrives(res.data || []);
      } catch (err) {
        setError(apiErrorMessage(err, 'your drives'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function openCode(e) {
    e.preventDefault();
    const clean = code.replace(/\s+/g, '').toUpperCase();
    if (clean) navigate(ROUTES.USER.JOIN_DRIVE(clean));
  }

  return (
    <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header">
        <h2 className="page-header__title">Placement Drives</h2>
        <p className="page-header__subtitle">Assessments your college or a company has invited you to</p>
      </div>

      <Card>
        <CardBody>
          <form onSubmit={openCode} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 220px' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Have an invite code?</span>
              <input
                className="common-input__field"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="e.g. 7CKC2JK8"
                maxLength={16}
                autoComplete="off"
                style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
              />
            </label>
            <Button type="submit" disabled={!code.trim()}>Open drive</Button>
          </form>
        </CardBody>
      </Card>

      {error && <Alert type="error">{error}</Alert>}

      <h3 style={{ fontSize: 18, fontWeight: 700 }}>Drives you joined</h3>

      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>}

      {!loading && drives.length === 0 && !error && (
        <Card>
          <CardBody style={{ color: 'var(--text-secondary)' }}>
            You haven't joined any placement drives yet. When your college or a company shares an invite link or code, it will show up here.
          </CardBody>
        </Card>
      )}

      {drives.map(d => {
        const done = d.status === 'scored' || d.status === 'completed';
        return (
          <Card key={d.session_id}>
            <CardBody style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{d.drive_title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {[d.organisation, d.role, d.skills.join(', ')].filter(Boolean).join(' · ')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Joined {formatDate(d.joined_at)}{d.deadline && ` · Deadline ${formatDate(d.deadline)}`}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <StatusBadge variant={statusVariant(d.status)}>{statusLabel(d.status)}</StatusBadge>
                {done && (d.decision === 'shortlisted'
                  ? <StatusBadge variant="success">Shortlisted</StatusBadge>
                  : <StatusBadge variant="neutral">Under review</StatusBadge>)}
                <Button size="sm" variant={done ? 'secondary' : 'primary'} onClick={() => navigate(driveAttemptRoute(d.session_id, d.status))}>
                  {done ? 'View report' : 'Continue'}
                </Button>
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
