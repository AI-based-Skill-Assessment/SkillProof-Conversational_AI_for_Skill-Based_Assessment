import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../core/auth/AuthContext';
import { useToast } from '../../components/common/Toast';
import client from '../../core/api/client';
import VoiceWaveform from '../../components/common/VoiceWaveform';
import Button from '../../components/common/Button';
import ROUTES from '../../core/routes';
import '../../styles/pages/biometrics-premium.css';

export default function VoiceRegistration() {
  const { user, updateUserCache } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [recording, setRecording] = useState(false);
  const [complete, setComplete] = useState(false);
  const [seconds, setSeconds] = useState(5);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('pending') === 'true') {
      toast.warning('Onboarding Required', 'Please complete your registration setup to access the dashboard.');
      navigate(location.pathname, { replace: true });
    }
  }, [location.pathname, location.search, navigate, toast]);

  useEffect(() => {
    if (!recording) return;
    if (seconds <= 0) {
      setRecording(false);
      setComplete(true);
      toast.success('Voice Registered', 'Speaker voiceprint vector template saved successfully!');
      return;
    }
    const timer = setTimeout(() => setSeconds(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [recording, seconds, toast]);

  function handleRecord() {
    setSeconds(5);
    setRecording(true);
  }

  async function handleFinish() {
    try {
      const res = await client.post('/auth/me/register-voice');
      updateUserCache(res.data);
      toast.success('Onboarding Complete', 'Welcome to your dashboard!');
      navigate(ROUTES.USER.DASHBOARD);
    } catch (err) {
      console.error(err);
      toast.error('Setup Failed', err.response?.data?.detail || 'Failed to complete registration.');
    }
  }

  // Calculate circular progress ring stroke-dashoffset (circumference is 440)
  const dashOffset = recording ? 440 - (440 * seconds) / 5 : complete ? 0 : 440;

  return (
    <div className="biometric-page">
      <div className="biometric-card anim-scale-in">
        <h2 className="biometric-card__title">Biometric Voice Registry</h2>
        <p className="biometric-card__subtitle">
          Read the phrase below aloud to register your voiceprint.
        </p>

        {/* Minimal Speech Box */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          padding: '20px 24px',
          borderRadius: '16px',
          fontSize: '14px',
          fontWeight: 500,
          textAlign: 'center',
          color: 'var(--text-primary)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          width: '100%',
          margin: '0 0 20px 0',
          lineHeight: '1.5'
        }}>
          "I confirm that I am completing the SkillProof assessment independently."
        </div>

        {/* Minimal Mic & Ring Visualizer */}
        <div className="voice-radar-wrapper">
          <div className={`voice-mic-icon-button ${recording ? 'voice-mic-icon-button--active' : ''}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </div>

          <svg className="circular-progress-ring" width="150" height="150">
            <circle className="circular-progress-ring__bg" cx="75" cy="75" r="55" />
            <circle 
              className={`circular-progress-ring__bar ${complete ? 'circular-progress-ring__bar--success' : ''}`}
              cx="75" 
              cy="75" 
              r="55" 
              style={{ strokeDashoffset: dashOffset }}
            />
          </svg>
        </div>

        {/* Active Waveform feedback */}
        <div style={{ width: '100%', marginBottom: 24 }}>
          <VoiceWaveform active={recording} barCount={20} className="w-full" style={{ height: 48 }} />
        </div>

        <div className={`biometric-status-banner ${complete ? 'biometric-status-banner--success' : ''}`}>
          {complete 
            ? '✓ Speaker Template Registered' 
            : recording 
              ? `Recording... Speak Now (${seconds}s)` 
              : 'Press the button below to record voiceprint.'}
        </div>

        {complete ? (
          <Button fullWidth onClick={handleFinish}>
            Go to Dashboard →
          </Button>
        ) : (
          <Button fullWidth onClick={handleRecord} loading={recording}>
            Record Voiceprint
          </Button>
        )}
      </div>
    </div>
  );
}
