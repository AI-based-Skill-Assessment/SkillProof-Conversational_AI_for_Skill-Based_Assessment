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

  const [statusMessage, setStatusMessage] = useState('Click "Start Camera" to begin face enrollment.');
  const [statusClass, setStatusClass] = useState('');
  const [progress, setProgress] = useState(0);

  const streamRef = useRef(null);
  const loopActiveRef = useRef(false);

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
    setStatusMessage('Loading face recognition models...');
    setStatusClass('info');
    setProgress(15);
    
    // Official weights from the original justadudewhohacks face-api.js repository
    const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights/';
    
    console.log('Loading tinyFaceDetector model...');
    await window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    console.log('tinyFaceDetector model loaded.');
    setProgress(25);
    
    console.log('Loading faceLandmark68Net model...');
    await window.faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    console.log('faceLandmark68Net model loaded.');
    setProgress(40);

    console.log('Loading faceLandmark68TinyNet model...');
    await window.faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
    console.log('faceLandmark68TinyNet model loaded.');
    setProgress(50);
    
    console.log('Loading faceRecognitionNet model...');
    await window.faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    console.log('faceRecognitionNet model loaded.');
    setProgress(65);
    
    setModelsLoaded(true);
  }

  async function startFaceEnroll() {
    if (!faceApiLoaded) {
      toast.error('Loading Error', 'Biometric face-api library is still loading. Please try again in a moment.');
      return;
    }
    setCameraActive(true);
    setBlocked(false);
    setStatusMessage('Requesting camera permission…');
    setStatusClass('info');
    setProgress(5);

    try {
      await loadFaceModels();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280, min: 320 },
          height: { ideal: 720, min: 240 },
          frameRate: { ideal: 30, max: 60 }
        }
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setStatusMessage('Camera active. Position your face in the oval and click "Capture Face".');
      setStatusClass('info');
      setProgress(30);

      // Start detection loop
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

      // Make sure video metadata is loaded and dimensions are valid
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        if (loopActiveRef.current) {
          requestAnimationFrame(loop);
        }
        return;
      }

      // Dynamic canvas overlay resize to match active feed aspect ratio
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      try {
        const options = new window.faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 });
        const det = await window.faceapi
          .detectSingleFace(video, options)
          .withFaceLandmarks(true);

        if (det) {
          const box = det.detection.box;
          // Draw green face bounding box
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 2;
          ctx.strokeRect(box.x, box.y, box.width, box.height);

          setStatusMessage('✓ Face detected! Click "Capture Face" to register.');
          setStatusClass('ok');
        } else {
          setStatusMessage('No face detected — centre your face in the oval.');
          setStatusClass('warn');
        }
      } catch (err) {
        console.error('[Face detection loop error]', err);
        setStatusMessage('Detection error: ' + err.message);
        setStatusClass('err');
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
        session_id: user?.id,
        face_embedding: faceEmbedding
      });
      return res.data;
    } catch (err) {
      console.warn('Duplicate check failed (non-blocking):', err.message);
      return null;
    }
  }

  async function handleCaptureFace() {
    if (!videoRef.current) return;
    
    // Stop background detection loop to free GPU context
    loopActiveRef.current = false;
    
    setRegistering(true);
    setStatusMessage('Extracting face descriptor…');
    setStatusClass('info');
    setProgress(60);

    try {
      const options = new window.faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 });
      const result = await window.faceapi
        .detectSingleFace(videoRef.current, options)
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      if (!result) {
        setRegistering(false);
        setStatusMessage('Could not extract descriptor. Ensure your face is clearly visible.');
        setStatusClass('err');
        toast.error('Detection Failed', 'Please look directly at the camera in a well-lit area.');
        startFaceDetectionLoop();
        return;
      }

      const faceDescriptor = Array.from(result.descriptor); // 128 float array
      
      setStatusMessage('Checking for duplicate registrations…');
      setStatusClass('info');
      setProgress(75);

      const dupResult = await checkDuplicate(faceDescriptor);
      if (dupResult && dupResult.face_is_duplicate) {
        stopFaceCamera();
        setRegistering(false);
        setBlocked(true);
        setStatusMessage('Registration blocked: ' + dupResult.message);
        setStatusClass('err');
        setProgress(0);
        toast.error('Duplicate Face Detected', 'This face is already registered under a different account.');
        return;
      }

      setStatusMessage('Sending to server…');
      setStatusClass('info');
      setProgress(80);

      const res = await client.post('/auth/me/register-face', {
        face_embedding: faceDescriptor
      });

      updateUserCache(res.data);
      stopFaceCamera();
      setComplete(true);
      setProgress(100);
      setStatusMessage('✓ Face Template Registered Successfully');
      setStatusClass('ok');
      toast.success('Face Registered', 'Biometric face registration completed successfully!');
    } catch (err) {
      console.error(err);
      setRegistering(false);
      setStatusMessage('Error: ' + (err.response?.data?.detail || err.message));
      setStatusClass('err');
      toast.error('Registration Failed', err.response?.data?.detail || err.message);
      startFaceDetectionLoop();
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
    setProgress(0);
    setStatusMessage('Click "Start Camera" to begin face enrollment.');
    setStatusClass('');
  }

  // Dynamic high-contrast theme mapping for status text colors
  const statusColors = {
    ok: 'var(--success, #22c55e)',
    warn: 'var(--warning, #f59e0b)',
    err: 'var(--error, #ef4444)',
    info: 'var(--primary, #6c63ff)'
  };
  const currentColor = statusColors[statusClass] || 'var(--text-secondary)';

  return (
    <div className="biometric-page" style={{ background: 'var(--background)' }}>
      <div className={`biometric-card anim-scale-in ${cameraActive ? 'capturing' : ''} ${complete ? 'registered' : ''}`} 
           style={{ 
             maxWidth: 540, 
             background: 'var(--surface)', 
             border: '1px solid var(--border)', 
             boxShadow: 'var(--shadow-lg)',
             color: 'var(--text-primary)'
           }}>
        
        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 className="biometric-card__title" style={{ margin: 0, color: 'var(--text-primary)' }}>Face Profile Registry</h2>
          <span className={`badge ${complete ? 'badge-done' : blocked ? 'badge-error' : cameraActive ? 'badge-active' : 'badge-pending'}`}>
            {complete ? 'Registered' : blocked ? 'Blocked' : cameraActive ? 'Capturing' : 'Pending'}
          </span>
        </div>

        <p className="biometric-card__subtitle" style={{ textAlign: 'left', alignSelf: 'flex-start', marginBottom: 20, color: 'var(--text-secondary)' }}>
          Align your face within the central oval guide so the AI agent can build your secure biometric identity card.
        </p>

        {/* 4:3 Rectangular Media Panel matching biometric_enroll.html */}
        <div className="media-panel" style={{ width: '100%', position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#000', aspectRatio: '4/3', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {complete ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--success)' }}>
              <div style={{ fontSize: '5rem' }}>✅</div>
              <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>Face template registered!</p>
            </div>
          ) : blocked ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--error)', padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: '5rem' }}>❌</div>
              <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>Biometric duplicate registration blocked.</p>
            </div>
          ) : !cameraActive ? (
            <div className="media-placeholder" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', gap: 12 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--primary)', opacity: 0.8 }}>
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              <p style={{ fontSize: '0.9rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Webcam preview will appear here.<br />Click Start Camera below.</p>
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
                width="640"
                height="480"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'scaleX(-1)', pointerEvents: 'none' }}
              />
              {/* Scanline & Oval Corner Guide Overlay */}
              <div className="scan-line" style={{
                position: 'absolute', left: 0, right: 0, height: 2,
                background: 'linear-gradient(90deg, transparent, var(--primary), transparent)',
                animation: 'scan 2.5s linear infinite'
              }} />
              <div className="face-guide" style={{
                position: 'absolute', inset: '15%', border: '3px solid var(--primary)',
                borderRadius: '50% 50% 45% 45%', animation: 'pulse-border 2s ease-in-out infinite',
                opacity: 0.6
              }} />
            </>
          )}
        </div>

        {/* Progress Bar */}
        <div style={{ width: '100%', height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), #a78bfa)', transition: 'width 0.3s ease' }} />
        </div>

        {/* Status Text Banner styled dynamically with high contrast */}
        <div style={{ 
          fontSize: '14px', 
          fontWeight: 600, 
          color: currentColor, 
          marginBottom: '20px', 
          alignSelf: 'flex-start',
          transition: 'color 0.2s ease',
          minHeight: '1.5em'
        }}>
          {statusMessage}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 12, width: '100%' }}>
          {complete ? (
            <Button fullWidth onClick={handleNext}>
              Proceed to Voice Registry →
            </Button>
          ) : !cameraActive ? (
            <Button fullWidth onClick={startFaceEnroll}>
              ▶ Start Camera
            </Button>
          ) : (
            <>
              <Button onClick={handleCaptureFace} loading={registering} disabled={blocked}>
                📸 Capture Face
              </Button>
              <Button variant="outline" onClick={handleRetry}>
                ↺ Reset
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
