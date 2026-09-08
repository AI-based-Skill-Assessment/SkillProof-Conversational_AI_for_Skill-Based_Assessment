import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../core/auth/AuthContext';
import { useToast } from '../../components/common/Toast';
import client from '../../core/api/client';
import Button from '../../components/common/Button';
import ROUTES from '../../core/routes';
import '../../styles/pages/biometrics-premium.css';

export default function FaceRegistration() {
  const { user, updateUserCache } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [faceApiLoaded, setFaceApiLoaded] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [complete, setComplete] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const [captureStep, setCaptureStep] = useState(1); // 1: Frontal, 2: Left Angle, 3: Right Angle
  const [capturedPoses, setCapturedPoses] = useState([]);
  const [autoCaptureActive, setAutoCaptureActive] = useState(false);

  const [statusMessage, setStatusMessage] = useState('Click "Start Automated Face Scan" to begin multi-pose face registration.');
  const [statusClass, setStatusClass] = useState('');
  const [progress, setProgress] = useState(0);

  const streamRef = useRef(null);
  const loopActiveRef = useRef(false);
  const autoCaptureHoldRef = useRef(0);
  const captureStepRef = useRef(1);
  const capturedPosesRef = useRef([]);

  useEffect(() => {
    captureStepRef.current = captureStep;
  }, [captureStep]);

  useEffect(() => {
    capturedPosesRef.current = capturedPoses;
  }, [capturedPoses]);

  // 1. Inject face-api.js script if not present
  useEffect(() => {
    if (window.faceapi) {
      setFaceApiLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
    script.async = true;
    script.onload = () => {
      console.log('face-api.js script loaded successfully.');
      setFaceApiLoaded(true);
    };
    script.onerror = (e) => {
      console.error('Failed to load face-api.js script:', e);
      setStatusMessage('Error: Failed to load face-api.js script from CDN.');
      setStatusClass('err');
    };
    document.body.appendChild(script);

    return () => {
      stopFaceCamera();
    };
  }, []);

  // Onboarding warning check
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('pending') === 'true') {
      toast.warning('Onboarding Required', 'Please complete your registration setup to access the dashboard.');
      navigate(location.pathname, { replace: true });
    }
  }, [location.pathname, location.search, navigate, toast]);

  // Load models from CDN - using highly reliable jsDelivr CDN linking directly to the official repository weights
  async function loadFaceModels() {
    if (modelsLoaded) return;
    setStatusMessage('Loading neural face recognition models...');
    setStatusClass('info');
    setProgress(15);
    
    const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights/';
    try {
      await window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await window.faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await window.faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
      await window.faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
      setModelsLoaded(true);
      setProgress(25);
    } catch (err) {
      console.warn('Primary model load failed, attempting fallback URL...', err);
      const FALLBACK_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
      await window.faceapi.nets.tinyFaceDetector.loadFromUri(FALLBACK_URL);
      await window.faceapi.nets.faceLandmark68Net.loadFromUri(FALLBACK_URL);
      await window.faceapi.nets.faceLandmark68TinyNet.loadFromUri(FALLBACK_URL);
      await window.faceapi.nets.faceRecognitionNet.loadFromUri(FALLBACK_URL);
      setModelsLoaded(true);
      setProgress(25);
    }
  }

  async function startFaceEnroll() {
    if (!faceApiLoaded) {
      toast.error('Loading Error', 'Biometric face-api library is still loading. Please try again in a moment.');
      return;
    }
    setCameraActive(true);
    setBlocked(false);
    setAutoCaptureActive(true);
    setStatusMessage('Requesting camera permission…');
    setStatusClass('info');
    setProgress(10);

    try {
      await loadFaceModels();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640, min: 320 },
          height: { ideal: 480, min: 240 }
        }
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setStatusMessage('Center your face inside the circle looking straight ahead.');
      setStatusClass('info');
      setProgress(30);

      // Start automatic detection & capture loop
      startFaceDetectionLoop();
    } catch (err) {
      console.error(err);
      setStatusMessage('Camera access denied: ' + err.message);
      setStatusClass('err');
      setCameraActive(false);
      setProgress(0);
      toast.error('Camera Access Denied', 'Please allow camera permissions to complete face enrollment.');
    }
  }

  function startFaceDetectionLoop() {
    loopActiveRef.current = true;
    
    async function loop() {
      if (!loopActiveRef.current || !videoRef.current || !canvasRef.current) return;
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        if (loopActiveRef.current) requestAnimationFrame(loop);
        return;
      }

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      try {
        const options = new window.faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.25 });
        const det = await window.faceapi
          .detectSingleFace(video, options)
          .withFaceLandmarks(true)
          .withFaceDescriptor();

        if (det) {
          const jaw = det.landmarks.getJawOutline();
          const nose = det.landmarks.getNose();
          const leftJawX = jaw[0].x;
          const rightJawX = jaw[16].x;
          const noseX = nose[3] ? nose[3].x : nose[0].x;
          const jawWidth = Math.max(1, rightJawX - leftJawX);
          const relativeNose = (noseX - leftJawX) / jawWidth;

          const currentStep = captureStepRef.current;

          let isPoseMatch = false;
          if (currentStep === 1) {
            // Frontal pose check (strictly center position ~0.44 to 0.56)
            isPoseMatch = relativeNose >= 0.44 && relativeNose <= 0.56;
            if (isPoseMatch) {
              setStatusMessage('✓ Frontal pose detected. Hold still…');
              setStatusClass('ok');
            } else {
              setStatusMessage('Center your face straight inside the circle.');
              setStatusClass('warn');
            }
          } else if (currentStep === 2) {
            // Left turned pose check (strictly LEFT turn in mirrored selfie view: relativeNose > 0.58)
            isPoseMatch = relativeNose > 0.58;
            if (isPoseMatch) {
              setStatusMessage('✓ Left profile pose detected. Hold still…');
              setStatusClass('ok');
            } else {
              setStatusMessage('👈 Slowly turn your head to the LEFT');
              setStatusClass('info');
            }
          } else if (currentStep === 3) {
            // Right turned pose check (strictly RIGHT turn in mirrored selfie view: relativeNose < 0.42)
            isPoseMatch = relativeNose < 0.42;
            if (isPoseMatch) {
              setStatusMessage('✓ Right profile pose detected. Hold still…');
              setStatusClass('ok');
            } else {
              setStatusMessage('👉 Slowly turn your head to the RIGHT');
              setStatusClass('info');
            }
          }

          // Auto-capture trigger after holding pose for ~800ms
          if (isPoseMatch && det.descriptor) {
            autoCaptureHoldRef.current += 1;
            if (autoCaptureHoldRef.current >= 8) { // ~800ms steady hold
              autoCaptureHoldRef.current = 0;
              await autoCaptureCurrentPose(det.descriptor);
            }
          } else {
            autoCaptureHoldRef.current = Math.max(0, autoCaptureHoldRef.current - 1);
          }
        } else {
          setStatusMessage('No face detected — center your face inside the circle.');
          setStatusClass('warn');
          autoCaptureHoldRef.current = 0;
        }
      } catch (err) {
        console.error('[Face detection loop error]', err);
      }

      if (loopActiveRef.current) {
        requestAnimationFrame(loop);
      }
    }

    requestAnimationFrame(loop);
  }

  async function checkDuplicate(faceEmbedding) {
    try {
      const res = await client.post('/biometric/check-duplicate', {
        session_id: user?.id || user?.user_id,
        face_embedding: faceEmbedding
      }, { timeout: 3500 });
      return res.data;
    } catch (err) {
      console.warn('Duplicate check skipped (non-blocking):', err.message);
      return null;
    }
  }

  async function autoCaptureCurrentPose(descriptorObj) {
    const currentStep = captureStepRef.current;
    const poseVector = Array.from(descriptorObj);

    // ── Instant Per-Step Duplicate Check ──────────────────────────────────────
    setStatusMessage(`Verifying pose ${currentStep}/3 against database registry…`);
    setStatusClass('info');

    const dupResult = await checkDuplicate(poseVector);
    if (dupResult && (dupResult.face_is_duplicate || dupResult.any_duplicate)) {
      stopFaceCamera();
      setRegistering(false);
      setBlocked(true);
      setStatusMessage('❌ Duplicate Face Registered: This face pattern is already registered to another candidate account.');
      setStatusClass('err');
      toast.error('Duplicate Face Registered', 'This face pattern is already registered to another account.');
      return;
    }

    const updatedPoses = [...capturedPosesRef.current, poseVector];
    capturedPosesRef.current = updatedPoses;
    setCapturedPoses(updatedPoses);

    if (currentStep === 1) {
      setCaptureStep(2);
      setProgress(50);
      setStatusMessage('✓ Step 1/3 Complete (Frontal)! Now slowly turn your head to the LEFT 👈');
      setStatusClass('ok');
      return;
    }

    if (currentStep === 2) {
      setCaptureStep(3);
      setProgress(85);
      setStatusMessage('✓ Step 2/3 Complete (Left Angle)! Now slowly turn your head to the RIGHT 👉');
      setStatusClass('ok');
      return;
    }

    if (currentStep === 3) {
      loopActiveRef.current = false;
      setRegistering(true);
      setStatusMessage('Submitting 3-Pose Multi-Angle Biometric Profile to Server…');
      setStatusClass('info');
      setProgress(95);

      try {
        await client.post('/biometric/register', {
          session_id: user?.id || user?.user_id,
          face_embedding: updatedPoses // Array of 3 128D pose vectors [front, left, right]
        });

        if (updateUserCache) {
          updateUserCache({ 
            face_registered: true,
            onboarding_step: 'voice_registration'
          });
        }

        stopFaceCamera();
        setRegistering(false);
        setComplete(true);
        setProgress(100);
        setStatusMessage('✓ Multi-Angle Biometric Profile Registered Successfully!');
        setStatusClass('ok');
        toast.success('Registration Complete', 'Multi-angle face enrollment completed successfully!');
      } catch (err) {
        console.error(err);
        setRegistering(false);
        setStatusMessage('Registration error: ' + (err.response?.data?.detail || err.message));
        setStatusClass('err');
        toast.error('Registration Error', err.response?.data?.detail || err.message);
      }
    }
  }

  function stopFaceCamera() {
    loopActiveRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function handleRetry() {
    stopFaceCamera();
    setCameraActive(false);
    setRegistering(false);
    setComplete(false);
    setBlocked(false);
    setAutoCaptureActive(false);
    setCaptureStep(1);
    setCapturedPoses([]);
    setProgress(0);
    setStatusMessage('Click "Start Automated Face Scan" to begin multi-pose face registration.');
    setStatusClass('');
  }

  function handleNext() {
    if (updateUserCache) {
      updateUserCache({ 
        face_registered: true,
        onboarding_step: 'voice_registration'
      });
    }
    navigate('/user/voice-registration');
  }

  // Dynamic high-contrast theme mapping for status text colors
  const statusColors = {
    ok: '#22c55e',
    warn: '#f59e0b',
    err: '#ef4444',
    info: '#6c63ff'
  };
  const currentColor = statusColors[statusClass] || 'var(--text-secondary)';

  return (
    <div className="biometric-page" style={{ background: 'var(--background)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div className="biometric-card anim-scale-in" 
           style={{ 
             maxWidth: 580, 
             width: '100%',
             background: 'var(--surface)', 
             borderRadius: 24,
             border: '1px solid var(--border)', 
             boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
             padding: 32,
             color: 'var(--text-primary)',
             display: 'flex',
             flexDirection: 'column',
             alignItems: 'center'
           }}>
        
        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>Face Registration</h2>
          {complete && (
            <span className="badge badge-done" style={{ padding: '6px 14px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700 }}>
              Registered
            </span>
          )}
        </div>

        {/* Modern Circular Camera Frame with Curved Directional Indicators */}
        <div style={{ position: 'relative', width: 320, height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          
          {/* Left Curved Directional Indicator Arc */}
          <div style={{
            position: 'absolute',
            left: -32,
            width: 50,
            height: 180,
            borderLeft: `4px solid ${captureStep === 2 ? '#38bdf8' : 'rgba(255,255,255,0.15)'}`,
            borderRadius: '120px 0 0 120px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
            boxShadow: captureStep === 2 ? '-10px 0 25px rgba(56, 189, 248, 0.5)' : 'none',
            animation: captureStep === 2 ? 'pulse 1.5s infinite' : 'none'
          }}>
            <span style={{ fontSize: '1.6rem', color: captureStep === 2 ? '#38bdf8' : 'rgba(255,255,255,0.3)', fontWeight: 900 }}>‹</span>
          </div>

          {/* Right Curved Directional Indicator Arc */}
          <div style={{
            position: 'absolute',
            right: -32,
            width: 50,
            height: 180,
            borderRight: `4px solid ${captureStep === 3 ? '#38bdf8' : 'rgba(255,255,255,0.15)'}`,
            borderRadius: '0 120px 120px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
            boxShadow: captureStep === 3 ? '10px 0 25px rgba(56, 189, 248, 0.5)' : 'none',
            animation: captureStep === 3 ? 'pulse 1.5s infinite' : 'none'
          }}>
            <span style={{ fontSize: '1.6rem', color: captureStep === 3 ? '#38bdf8' : 'rgba(255,255,255,0.3)', fontWeight: 900 }}>›</span>
          </div>

          {/* Main 3D Circular Camera Container */}
          <div style={{ 
            width: 290, 
            height: 290, 
            borderRadius: '50%', 
            overflow: 'hidden', 
            background: '#0a0a16', 
            position: 'relative',
            border: `4px solid ${complete ? '#22c55e' : captureStep === 2 || captureStep === 3 ? '#38bdf8' : 'var(--primary)'}`,
            boxShadow: complete ? '0 0 35px rgba(34, 197, 94, 0.4)' : '0 0 35px rgba(108, 99, 255, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {complete ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#22c55e' }}>
                <div style={{ fontSize: '4.5rem' }}>✅</div>
                <p style={{ fontSize: '1.05rem', fontWeight: 700 }}>Profile Enrolled!</p>
              </div>
            ) : !cameraActive ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', gap: 10, padding: 20, textAlign: 'center' }}>
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--primary)' }}>
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Click Start Scan Below</p>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                />
                <canvas
                  ref={canvasRef}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'scaleX(-1)', pointerEvents: 'none' }}
                />
                {/* Circular Target Ring Overlay */}
                <div style={{
                  position: 'absolute',
                  inset: 20,
                  border: '2px dashed rgba(255,255,255,0.4)',
                  borderRadius: '50%',
                  pointerEvents: 'none',
                  animation: 'spin 12s linear infinite'
                }} />
              </>
            )}
          </div>
        </div>

        {/* 3 Step Pose Indicator Pills */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: captureStep >= 1 ? 1 : 0.4 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: capturedPoses.length >= 1 ? '#22c55e' : captureStep === 1 ? '#6c63ff' : 'var(--border)' }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>1. Frontal</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: captureStep >= 2 ? 1 : 0.4 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: capturedPoses.length >= 2 ? '#22c55e' : captureStep === 2 ? '#38bdf8' : 'var(--border)' }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>2. Left Turn</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: captureStep >= 3 ? 1 : 0.4 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: capturedPoses.length >= 3 ? '#22c55e' : captureStep === 3 ? '#38bdf8' : 'var(--border)' }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>3. Right Turn</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ width: '100%', height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #6c63ff, #38bdf8, #22c55e)', transition: 'width 0.3s ease' }} />
        </div>

        {/* Dynamic Status Message Banner */}
        <div style={{ 
          fontSize: '14px', 
          fontWeight: 700, 
          color: currentColor, 
          marginBottom: 24, 
          textAlign: 'center',
          minHeight: '1.5em',
          transition: 'color 0.2s ease'
        }}>
          {statusMessage}
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: 12, width: '100%' }}>
          {complete ? (
            <Button fullWidth onClick={handleNext}>
              Proceed to Voice Registry →
            </Button>
          ) : !cameraActive ? (
            <Button fullWidth onClick={startFaceEnroll}>
              ▶ Start Automated Face Scan
            </Button>
          ) : (
            <Button variant="outline" fullWidth onClick={handleRetry}>
              ↺ Reset Scan
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
