import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CameraPreview from '../../components/common/CameraPreview';
import VoiceWaveform from '../../components/common/VoiceWaveform';
import Button from '../../components/common/Button';
import ROUTES from '../../core/routes';
import '../../styles/pages/portal.css';

export default function InterviewCheck() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [micTest, setMicTest] = useState(false);
  const [complete, setComplete] = useState(false);

  function handleTestMic() {
    setMicTest(true);
    setTimeout(() => {
      setMicTest(false);
      setComplete(true);
    }, 1500);
  }

  function handleStart() {
    navigate(ROUTES.USER.INTERVIEW_SESSION(id));
  }

  return (
    <div className="anim-fade-in" style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
      <div className="page-header">
        <h2 className="page-header__title">Pre-Interview Hardware Check</h2>
        <p className="page-header__subtitle">Verify your webcam and microphone feed before entering the room</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
        {/* Camera block */}
        <CameraPreview active={true} />

        {/* Microphone block */}
        <div className="common-card" style={{ width: '100%', maxWidth: 360, padding: 20 }}>
          <VoiceWaveform active={micTest} barCount={15} style={{ height: 40 }} />
          {complete ? (
            <div style={{ color: 'var(--success)', fontWeight: 600, marginTop: 12 }}>✓ Microphone levels checked</div>
          ) : (
            <Button size="sm" onClick={handleTestMic} loading={micTest} style={{ marginTop: 12 }}>
              Test Microphone
            </Button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 360 }}>
          <Button variant="secondary" fullWidth onClick={() => navigate(ROUTES.USER.DASHBOARD)}>
            Cancel
          </Button>
          <Button fullWidth onClick={handleStart} disabled={!complete}>
            Enter Interview Room
          </Button>
        </div>
      </div>
    </div>
  );
}
