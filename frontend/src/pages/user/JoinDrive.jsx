import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardBody } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Alert from '../../components/common/Alert';
import StatusBadge from '../../components/common/StatusBadge';
import { useToast } from '../../components/common/Toast';
import { formatDateTime } from '../../utils/formatDate';
import { apiErrorMessage } from '../../utils/apiError';
import ROUTES from '../../core/routes';
import client from '../../core/api/client';

/** Where to send a candidate for a drive attempt, based on how far they got. */
export function driveAttemptRoute(sessionId, status) {
  if (status === 'scored' || status === 'completed') return ROUTES.USER.REPORT_DETAIL(sessionId);
  if (status === 'interview_done') return ROUTES.USER.INTERVIEW_PROCESSING(sessionId);
  return ROUTES.USER.ASSESSMENT_REVIEW(sessionId);
}

export default function JoinDrive() {
  const { code } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [drive, setDrive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await client.get(`/drives/invite/${encodeURIComponent(code)}`);
        setDrive(res.data);
      } catch (err) {
        setError(err?.response?.status === 404
          ? `No placement drive found for code "${code}". Check the code with your organisation.`
          : apiErrorMessage(err, 'drive'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [code]);

  async function handleJoin() {
    try {
      setJoining(true);
      const res = await client.post(`/drives/invite/${encodeURIComponent(code)}/join`);
      if (res.data.resumed) {
        toast.info('Welcome back', 'You already joined this drive. Continuing your attempt.');
      } else {
        toast.success('Joined drive', `Your interview will cover ${drive.skills.join(', ')}.`);
      }
      navigate(driveAttemptRoute(res.data.session_id, res.data.status));
    } catch (err) {
      toast.error('Could not join', err?.response?.data?.detail || apiErrorMessage(err, 'drive'));
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading drive…</div>;
  }

  if (error || !drive) {
    return (
      <div className="anim-fade-in" style={{ maxWidth: 560, margin: '40px auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Alert type="error">{error || 'Drive not found.'}</Alert>
        <div><Button variant="secondary" onClick={() => navigate(ROUTES.USER.DRIVES)}>Back to Placement Drives</Button></div>
      </div>
    );
  }

  return (
    <div className="anim-fade-in" style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header">
        <h2 className="page-header__title">Placement Drive</h2>
        <p className="page-header__subtitle">Invitation from {drive.organisation.name}</p>
      </div>

      <Card>
        <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 700 }}>{drive.title}</h3>
              {drive.role && <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{drive.role}</div>}
            </div>
            {drive.accepting
              ? <StatusBadge variant="success">Open</StatusBadge>
              : <StatusBadge variant="neutral">Closed</StatusBadge>}
          </div>

          {drive.description && <p style={{ margin: 0, lineHeight: 1.6 }}>{drive.description}</p>}

          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Skills you will be interviewed on</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {drive.skills.map(s => <StatusBadge key={s} variant="info" dot={false}>{s}</StatusBadge>)}
            </div>
          </div>

          {drive.deadline && (
            <div style={{ fontSize: 14 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Deadline: </span>
              <strong>{formatDateTime(drive.deadline)}</strong>
            </div>
          )}

          <Alert type="info">
            You'll take a proctored AI voice interview (about 7 questions) with your camera and microphone on.
            You get <strong>one attempt</strong>. By joining, you agree to share your result and proctoring report with {drive.organisation.name}.
          </Alert>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Button onClick={handleJoin} loading={joining} disabled={!drive.accepting}>
              {drive.accepting ? 'Join and start' : 'Not accepting candidates'}
            </Button>
            <Button variant="secondary" onClick={() => navigate(ROUTES.USER.DRIVES)}>Not now</Button>
          </div>
          {!drive.accepting && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              If you already started this drive, open it from your Placement Drives page.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
