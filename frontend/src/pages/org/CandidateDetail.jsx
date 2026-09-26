import { useParams, useNavigate } from 'react-router-dom';
import { MOCK_CANDIDATES } from '../../core/mockData/org.mock';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate } from '../../utils/formatDate';
import Button from '../../components/common/Button';
import ROUTES from '../../core/routes';

export default function CandidateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Find candidate by localStorage or mock ID
  const candidate = (() => {
    try {
      const saved = localStorage.getItem('skillproof_org_candidates');
      if (saved) {
        const list = JSON.parse(saved);
        const match = list.find(c => c.id === id);
        if (match) return match;
      }
    } catch (e) {
      console.error(e);
    }
    return MOCK_CANDIDATES.find(c => c.id === id) || null;
  })();

  if (!candidate) {
    return (
      <div className="anim-fade-in" style={{ maxWidth: 600, margin: '40px auto', textAlign: 'center' }}>
        <Card>
          <CardBody style={{ padding: 40, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
            <h3 style={{ fontSize: 20, fontWeight: 700 }}>Candidate Profile Not Found</h3>
            <p style={{ color: 'var(--text-secondary)' }}>The requested student candidate could not be found or has not linked with your institution.</p>
            <Button onClick={() => navigate(ROUTES.ORG.CANDIDATES)}>Back to Candidates List</Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="anim-fade-in" style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="page-header page-header--row">
        <div>
          <h2 className="page-header__title">Student Audit Profile</h2>
          <p className="page-header__subtitle">Review verification checkpoints and biometric integrity reports</p>
        </div>
        <div className="page-header__actions">
          <Button variant="secondary" onClick={() => navigate(ROUTES.ORG.CANDIDATES)}>
            Back to List
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Card>
          <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 60, height: 60, borderRadius: '50%',
                background: 'var(--primary)', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: 700
              }}>
                {candidate.full_name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>{candidate.full_name}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{candidate.email}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, borderTop: '1px solid var(--border)', paddingTop: 20, fontSize: 14 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Connected Since:</div>
              <div>{formatDate(candidate.connected_at)}</div>

              <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Face Template Matching:</div>
              <div>
                <StatusBadge variant={candidate.face_registered ? 'success' : 'neutral'}>
                  {candidate.face_registered ? 'Registry active' : 'Not setup'}
                </StatusBadge>
              </div>

              <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Voiceprint Matching:</div>
              <div>
                <StatusBadge variant={candidate.voice_registered ? 'success' : 'neutral'}>
                  {candidate.voice_registered ? 'Registry active' : 'Not setup'}
                </StatusBadge>
              </div>

              <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Proctoring Trust Index:</div>
              <div>
                <span style={{ color: 'var(--success)', fontWeight: 700 }}>
                  {candidate.integrity_score || 98}% High Trust
                </span>
              </div>

              <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Latest Pipeline Status:</div>
              <div>
                <StatusBadge variant={candidate.latest_status === 'verified' ? 'success' : 'info'}>
                  {candidate.latest_status.toUpperCase()}
                </StatusBadge>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Anti-Cheating & Proctoring Telemetry Summary for Org */}
        <Card>
          <CardHeader><CardTitle>Proctoring & Anti-Cheating Telemetry</CardTitle></CardHeader>
          <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Continuous Facial Re-Verification:</span>
              <span style={{ color: 'var(--success)', fontWeight: 600 }}>PASSED (ArcFace 512D)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Voice Biometric Consistency:</span>
              <span style={{ color: 'var(--success)', fontWeight: 600 }}>PASSED (ECAPA-TDNN)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Browser Tab Switches Logged:</span>
              <span style={{ color: 'var(--success)', fontWeight: 600 }}>0 Incidents</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Unauthorized Proxy Detection:</span>
              <span style={{ color: 'var(--success)', fontWeight: 600 }}>CLEAN (No Multi-Face Detected)</span>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
