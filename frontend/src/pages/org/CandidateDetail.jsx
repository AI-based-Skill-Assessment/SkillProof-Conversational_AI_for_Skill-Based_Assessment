import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';
import Button from '../../components/common/Button';
import Alert from '../../components/common/Alert';
import { formatDate } from '../../utils/formatDate';
import { formatScore, scoreColor, verdictVariant } from '../../utils/formatScore';
import { apiErrorMessage } from '../../utils/apiError';
import { statusLabel, statusVariant, verdictLabel } from '../../utils/assessmentLabels';
import ROUTES from '../../core/routes';
import client from '../../core/api/client';

const PROCTORING_ROWS = [
  ['tab_switch_count', 'Tab switches'],
  ['window_blur_count', 'Left the interview window'],
  ['copy_paste_attempts', 'Copy / paste attempts'],
  ['gaze_violations', 'Looked away from screen'],
  ['camera_interruptions', 'Camera interruptions'],
  ['face_mismatch_count', 'Face did not match registration'],
  ['voice_mismatch_count', 'Voice did not match registration'],
  ['secondary_speaker_count', 'Another voice detected'],
];

function initials(name = '') {
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function Field({ label, children }) {
  return (
    <>
      <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</div>
      <div>{children}</div>
    </>
  );
}

function ProctoringSummary({ integrity }) {
  if (!integrity) {
    return <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No proctoring data was recorded for this assessment.</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Integrity score</span>
        <span style={{ fontWeight: 700, color: scoreColor(integrity.integrity_score) }}>
          {formatScore(integrity.integrity_score)} / 100
        </span>
      </div>
      {PROCTORING_ROWS.map(([key, label]) => {
        const n = integrity[key] || 0;
        return (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
            <span style={{ fontWeight: 600, color: n > 0 ? 'var(--warning)' : 'var(--success)' }}>
              {n === 0 ? 'None' : n}
            </span>
          </div>
        );
      })}
      {(integrity.face_duplicate_detected || integrity.voice_duplicate_detected) && (
        <Alert type="error">This candidate's face or voice matches another account's registration.</Alert>
      )}
      {integrity.flag_reasons?.length > 0 && (
        <div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>Flag reasons</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {integrity.flag_reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function CandidateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await client.get(`/org/candidates/${id}`);
        setCandidate(res.data);
      } catch (err) {
        setError(apiErrorMessage(err, 'candidate'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const backButton = (
    <Button variant="secondary" onClick={() => navigate(ROUTES.ORG.CANDIDATES)}>Back to Candidates</Button>
  );

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading candidate…</div>;
  }

  if (error || !candidate) {
    return (
      <div className="anim-fade-in" style={{ maxWidth: 600, margin: '40px auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Alert type="error">{error || 'Candidate not found.'}</Alert>
        <div>{backButton}</div>
      </div>
    );
  }

  const assessments = candidate.assessments || [];

  return (
    <div className="anim-fade-in" style={{ maxWidth: 860, margin: '0 auto' }}>
      <div className="page-header page-header--row">
        <div>
          <h2 className="page-header__title">Candidate Profile</h2>
          <p className="page-header__subtitle">Assessments and proctoring results this candidate has shared with you</p>
        </div>
        <div className="page-header__actions">{backButton}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Card>
          <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 60, height: 60, borderRadius: '50%',
                background: 'var(--primary)', color: 'var(--text-on-fill)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: 700, flexShrink: 0,
              }}>
                {initials(candidate.full_name)}
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>{candidate.full_name}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>{candidate.email}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 1fr) 2fr', gap: 14, borderTop: '1px solid var(--border)', paddingTop: 20, fontSize: 14 }}>
              <Field label="Connected since">{formatDate(candidate.connected_at)}</Field>
              <Field label="Face registered">
                <StatusBadge variant={candidate.face_registered ? 'success' : 'neutral'}>
                  {candidate.face_registered ? 'Yes' : 'No'}
                </StatusBadge>
              </Field>
              <Field label="Voice registered">
                <StatusBadge variant={candidate.voice_registered ? 'success' : 'neutral'}>
                  {candidate.voice_registered ? 'Yes' : 'No'}
                </StatusBadge>
              </Field>
              <Field label="Assessments">{candidate.completed_count} completed of {candidate.assessments_count}</Field>
              <Field label="Average score">
                <span style={{ fontWeight: 700, color: scoreColor(candidate.average_score) }}>
                  {candidate.average_score != null ? `${formatScore(candidate.average_score)}%` : 'Not scored yet'}
                </span>
              </Field>
              <Field label="Lowest integrity">
                {candidate.integrity_score != null
                  ? <span style={{ fontWeight: 700, color: scoreColor(candidate.integrity_score) }}>{formatScore(candidate.integrity_score)} / 100</span>
                  : '—'}
                {candidate.flagged && <span style={{ marginLeft: 8 }}><StatusBadge variant="error">Flagged</StatusBadge></span>}
              </Field>
            </div>
          </CardBody>
        </Card>

        <h3 style={{ fontSize: 18, fontWeight: 700 }}>Assessments ({assessments.length})</h3>

        {assessments.length === 0 && (
          <Card><CardBody style={{ color: 'var(--text-secondary)' }}>This candidate has not started any assessments yet.</CardBody></Card>
        )}

        {assessments.map(a => (
          <Card key={a.id}>
            <CardHeader>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <CardTitle>{a.skills?.length ? a.skills.join(', ') : (a.role || 'Assessment')}</CardTitle>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <StatusBadge variant={statusVariant(a.status)}>{statusLabel(a.status)}</StatusBadge>
                  {a.verdict && <StatusBadge variant={verdictVariant(a.verdict)}>{verdictLabel(a.verdict)}</StatusBadge>}
                </div>
              </div>
            </CardHeader>
            <CardBody style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Date</span>
                  <span>{formatDate(a.created_at)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Type</span>
                  <span>{a.intake_mode === 'skill_only' ? 'Skill interview' : 'Certificate + interview'}</span>
                </div>
                {a.company && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Issuer</span>
                    <span style={{ textAlign: 'right' }}>{a.company}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Overall score</span>
                  <span style={{ fontWeight: 700, color: scoreColor(a.score) }}>
                    {a.score != null ? `${formatScore(a.score)}%` : '—'}
                  </span>
                </div>
                {a.skill_scores?.[0] && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Technical depth</span>
                      <span>{formatScore(a.skill_scores[0].depth)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Specificity</span>
                      <span>{formatScore(a.skill_scores[0].specificity)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Consistency</span>
                      <span>{formatScore(a.skill_scores[0].consistency)}</span>
                    </div>
                  </>
                )}
              </div>
              <ProctoringSummary integrity={a.integrity} />
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
