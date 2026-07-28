import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../core/auth/AuthContext';
import { useToast } from '../../components/common/Toast';
import client from '../../core/api/client';
import CameraPreview from '../../components/common/CameraPreview';
import Button from '../../components/common/Button';
import ROUTES from '../../core/routes';
import '../../styles/pages/biometrics-premium.css';

export default function FaceRegistration() {
  const { user, updateUserCache } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [registering, setRegistering] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('pending') === 'true') {
      toast.warning('Onboarding Required', 'Please complete your registration setup to access the dashboard.');
      navigate(location.pathname, { replace: true });
    }
  }, [location.pathname, location.search, navigate, toast]);

  async function handleEnroll() {
    setRegistering(true);
    try {
      const res = await client.post('/auth/me/register-face');
      updateUserCache(res.data);
      setComplete(true);
      toast.success('Face Registered', 'Holographic face template saved successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Registration Failed', err.response?.data?.detail || 'Failed to save biometric face template.');
    } finally {
      setRegistering(false);
    }
  }

  function handleNext() {
    navigate(ROUTES.USER.VOICE_REGISTRATION);
  }

  return (
    <div className="biometric-page">
      <div className="biometric-card anim-scale-in">
        <h2 className="biometric-card__title">Biometric Face Registry</h2>
        <p className="biometric-card__subtitle">
          Align your face within the frame to verify and secure your candidate profile.
        </p>

        <div className="hud-scanner-container">
          <div className={`hud-camera-wrapper ${complete ? 'hud-camera-wrapper--success' : ''}`}>
            <CameraPreview active={!complete} className="hud-camera-video" />
            
            <div className={`hud-face-reticle ${complete ? 'hud-face-reticle--success' : ''}`}>
              <div className={`hud-face-oval ${complete ? 'hud-face-oval--success' : ''}`} />
            </div>
          </div>
        </div>

        <div className={`biometric-status-banner ${complete ? 'biometric-status-banner--success' : ''}`}>
          {complete 
            ? '✓ Face Template Registered Successfully' 
            : registering 
              ? 'Analyzing facial landmarks...' 
              : 'Position your face in the center of the frame.'}
        </div>

        {complete ? (
          <Button fullWidth onClick={handleNext}>
            Proceed to Voice Registry →
          </Button>
        ) : (
          <Button fullWidth onClick={handleEnroll} loading={registering}>
            Capture Face Key
          </Button>
        )}
      </div>
    </div>
  );
}
