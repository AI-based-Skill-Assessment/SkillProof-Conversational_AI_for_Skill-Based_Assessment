import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/auth/AuthContext';
import { useToast } from '../../components/common/Toast';
import client from '../../core/api/client';
import Button from '../../components/common/Button';
import ROUTES from '../../core/routes';
import '../../styles/pages/portal.css';

export default function InterviewCheck() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  // Face API Load State
  const [faceApiLoaded, setFaceApiLoaded] = useState(!!window.faceapi);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  // Sequential Verification State
  const [faceChecking, setFaceChecking] = useState(false);
  const [capturingFace, setCapturingFace] = useState(false);
  const [faceVerified, setFaceVerified] = useState(false);
  const [faceStatus, setFaceStatus] = useState('Face ID check pending.');
  const [faceStatusClass, setFaceStatusClass] = useState('info'); // info, success, err

  const [voiceChecking, setVoiceChecking] = useState(false);
  const [voiceVerified, setVoiceVerified] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('Complete Face ID Check to unlock Voice ID Check.');
  const [voiceStatusClass, setVoiceStatusClass] = useState('info');
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // References
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const audioStreamRef = useRef(null);
  const mediaRecRef = useRef(null);
  const canvasRef = useRef(null);
  const chunksRef = useRef([]);
  const animFrameRef = useRef(null);
  const audioCtxRef = useRef(null);

  // Inject face-api.js script if not present
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
      setFaceStatus('Error: Failed to load face-api.js script from CDN.');
      setFaceStatusClass('err');
    };
    document.body.appendChild(script);
  }, []);

  // Clean up media tracks on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      stopVoiceRecording();
    };
  }, []);

  // Auto-start Face Camera Feed on mount when library loads
  useEffect(() => {
    if (faceApiLoaded && !faceVerified && !faceChecking) {
      startFaceCamera();
    }
  }, [faceApiLoaded]);

  // ── Face Verification Logic ───────────────────────────────────────────────

  async function loadFaceModels() {
    if (modelsLoaded) return;
    setFaceStatus('Loading face verification models...');
    setFaceStatusClass('info');
    
    const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights/';
    try {
      await window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await window.faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
      await window.faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
      setModelsLoaded(true);
    } catch (err) {
      console.error(err);
      setFaceStatus('Failed to load recognition models. Please reload the page.');
      setFaceStatusClass('err');
      toast.error('Model Load Failed', 'Could not fetch face-api weights.');
      throw err;
    }
  }

  async function startFaceCamera() {
    try {
      await loadFaceModels();
      setFaceChecking(true);
      setFaceStatus('Accessing camera permission...');
      setFaceStatusClass('info');

      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280, min: 320 },
          height: { ideal: 720, min: 240 },
          frameRate: { ideal: 30, max: 60 }
        }
      });
      streamRef.current = videoStream;

      if (videoRef.current) {
        videoRef.current.srcObject = videoStream;
        videoRef.current.play();
        setFaceStatus('Look directly at the camera and click Capture Face below.');
      }
    } catch (err) {
      console.error(err);
      setFaceChecking(false);
      setFaceStatus('Camera access denied. Please allow camera permissions.');
      setFaceStatusClass('err');
      toast.error('Camera Error', 'Could not start video feed.');
    }
  }

  async function captureAndVerifyFace() {
    if (!videoRef.current) return;
    setCapturingFace(true);
    setFaceStatus('Capturing face image...');
    setFaceStatusClass('info');

    try {
      const options = new window.faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.35 });
      const result = await window.faceapi
        .detectSingleFace(videoRef.current, options)
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      if (!result) {
        throw new Error('No face detected. Please ensure your face is fully visible inside the camera frame.');
      }

      setFaceStatus('Comparing face credentials with server database...');
      const descriptor = Array.from(result.descriptor);
      
      const res = await client.post('/biometric/verify', {
        session_id: id,
        face_embedding: descriptor
      });

      if (res.data.face_match) {
        setFaceVerified(true);
        setFaceChecking(false);
        setFaceStatus('✓ Face identity verified successfully.');
        setFaceStatusClass('success');
        toast.success('Face Verified', 'Your face matched your registered credentials.');
        stopCamera();
        setVoiceStatus('Click "Start Voice Verification" and read the text.');
      } else {
        setFaceStatusClass('err');
        throw new Error('Face ID mismatch. Ensure you match the registered profile.');
      }
    } catch (err) {
      console.error(err);
      setFaceStatus(err.message || 'Face verification failed. Please try again.');
      setFaceStatusClass('err');
      toast.error('Face ID Check Failed', err.message || 'Please look directly at the camera.');
    } finally {
      setCapturingFace(false);
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  // ── Voice Verification Logic ───────────────────────────────────────────────

  async function startVoiceVerification() {
    setVoiceVerified(false);
    setVoiceChecking(true);
    setVoiceStatus('Accessing microphone...');
    setVoiceStatusClass('info');
    chunksRef.current = [];

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = audioStream;

      // Sound visualization canvas
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(audioStream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const freqData = new Uint8Array(analyser.frequencyBinCount);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');

      function drawWave() {
        if (!canvas) return;
        analyser.getByteFrequencyData(freqData);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barW = (canvas.width / freqData.length) * 1.5;
        let bx = 0;

        for (let i = 0; i < freqData.length; i++) {
          const barH = (freqData[i] / 255) * (canvas.height * 0.4);
          const alpha = 0.3 + (freqData[i] / 255) * 0.5;
          ctx.fillStyle = `rgba(18, 163, 126, ${alpha})`;
          ctx.fillRect(bx, canvas.height - barH, barW, barH);
          bx += barW + 1;
        }
        animFrameRef.current = requestAnimationFrame(drawWave);
      }
      drawWave();

      // Start Media Recorder
      const mediaRec = new MediaRecorder(audioStream, { mimeType: 'audio/webm' });
      mediaRecRef.current = mediaRec;
      mediaRec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRec.start(250);

      // Start 3-second recording countdown
      setVoiceStatus('Speak: "I verify my identity to proceed with SkillProof verification."');
      let sec = 0;
      setRecordingSeconds(0);
      const timer = setInterval(() => {
        sec++;
        setRecordingSeconds(sec);
        if (sec >= 4) {
          clearInterval(timer);
          processVoiceVerification();
        }
      }, 1000);

    } catch (err) {
      console.error(err);
      setVoiceChecking(false);
      setVoiceStatus('Microphone access denied. Please allow microphone permissions.');
      setVoiceStatusClass('err');
      toast.error('Mic Error', 'Could not access voice recording device.');
    }
  }

  async function processVoiceVerification() {
    setVoiceStatus('Processing voice fingerprint...');
    setVoiceStatusClass('info');

    if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') {
      mediaRecRef.current.stop();
    }
    stopVoiceRecording();

    await new Promise(r => setTimeout(r, 400));

    try {
      const embedding = await extractVoiceEmbedding(chunksRef.current);
      if (!embedding || embedding.length === 0) {
        throw new Error('Capture failed. Please record voice clearly.');
      }

      setVoiceStatus('Comparing voice credentials...');
      const res = await client.post('/biometric/verify', {
        session_id: id,
        voice_embedding: embedding
      });

      if (res.data.voice_match) {
        setVoiceVerified(true);
        setVoiceChecking(false);
        setVoiceStatus('✓ Voice verified successfully.');
        setVoiceStatusClass('success');
        toast.success('Voice Match Successful', 'Your voice footprint matched your registered profile.');
      } else {
        setVoiceChecking(false);
        setVoiceStatus('Voice mismatch. Speak clearly into the microphone.');
        setVoiceStatusClass('err');
        toast.error('Voice Mismatch', 'Verification failed. Try again in a quiet environment.');
      }
    } catch (err) {
      setVoiceChecking(false);
      setVoiceStatus(err.message || 'Verification failed. Try again.');
      setVoiceStatusClass('err');
      toast.error('Voice Match Failed', err.message || 'Recording issues.');
    }
  }

  function stopVoiceRecording() {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop());
      audioStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
  }

  // ── FFT Voice Feature Extraction ──────────────────────────────────────────

  async function extractVoiceEmbedding(chunks) {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    const arrayBuf = await blob.arrayBuffer();
    const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuf = await tempCtx.decodeAudioData(arrayBuf);
    await tempCtx.close();

    const channelData = audioBuf.getChannelData(0);
    const duration = audioBuf.duration;

    if (duration < 3.0) {
      throw new Error(`Voice capture too short (${duration.toFixed(1)}s). Speak the full sentence.`);
    }

    let sumSquares = 0;
    for (let i = 0; i < channelData.length; i++) {
      sumSquares += channelData[i] * channelData[i];
    }
    const rms = Math.sqrt(sumSquares / channelData.length);
    if (rms < 0.02) {
      throw new Error("No voice detected. Please speak clearly into your mic.");
    }

    const frameSize = 512;
    const hopSize = 256;
    const numBands = 64;
    const embedding = new Array(numBands).fill(0);
    let frames = 0;

    for (let start = 0; start + frameSize < channelData.length; start += hopSize) {
      const frame = channelData.slice(start, start + frameSize);
      const mag = getFFTMagnitude(frame, frameSize);
      const binPerBand = Math.floor((frameSize / 2) / numBands);
      for (let b = 0; b < numBands; b++) {
        let sum = 0;
        for (let k = 0; k < binPerBand; k++) {
          sum += mag[b * binPerBand + k];
        }
        embedding[b] += sum / binPerBand;
      }
      frames++;
    }

    if (frames === 0) return [];
    const avgEmbedding = embedding.map(v => v / frames);
    const maxVal = Math.max(...avgEmbedding);
    return avgEmbedding.map(v => maxVal > 0 ? v / maxVal : 0);
  }

  function bitReverse(n, bits) {
    let reversed = 0;
    for (let i = 0; i < bits; i++) {
      if ((n & (1 << i)) !== 0) {
        reversed |= (1 << (bits - 1 - i));
      }
    }
    return reversed;
  }

  function fft(re, im) {
    const n = re.length;
    const bits = Math.round(Math.log2(n));
    for (let i = 0; i < n; i++) {
      const j = bitReverse(i, bits);
      if (i < j) {
        let temp = re[i]; re[i] = re[j]; re[j] = temp;
        temp = im[i]; im[i] = im[j]; im[j] = temp;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const angle = -2 * Math.PI / len;
      const wlenRe = Math.cos(angle);
      const wlenIm = Math.sin(angle);
      for (let i = 0; i < n; i += len) {
        let wRe = 1, wIm = 0;
        for (let j = 0; j < len / 2; j++) {
          const uRe = re[i + j];
          const uIm = im[i + j];
          const vRe = re[i + j + len / 2] * wRe - im[i + j + len / 2] * wIm;
          const vIm = re[i + j + len / 2] * wIm + im[i + j + len / 2] * wRe;
          re[i + j] = uRe + vRe;
          im[i + j] = uIm + vIm;
          re[i + j + len / 2] = uRe - vRe;
          im[i + j + len / 2] = uIm - vIm;
          const nextWRe = wRe * wlenRe - wIm * wlenIm;
          wIm = wRe * wlenIm + wIm * wlenRe;
          wRe = nextWRe;
        }
      }
    }
  }

  function getFFTMagnitude(frame, N) {
    const re = new Float32Array(N);
    const im = new Float32Array(N);
    re.set(frame);
    fft(re, im);
    const half = N / 2;
    const mag = new Float32Array(half);
    for (let k = 0; k < half; k++) {
      mag[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]) / N;
    }
    return mag;
  }

  return (
    <div className="anim-fade-in" style={{ maxWidth: 840, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="page-header" style={{ textAlign: 'center' }}>
        <h2 className="page-header__title">Biometric & Hardware Verification</h2>
        <p className="page-header__subtitle">
          Confirm your registered Face and Voice ID credentials sequentially to enter the interview room
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
        {/* Step 1: Face ID Verification */}
        <div className="common-card" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24, border: faceVerified ? '2px solid var(--success)' : '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Step 1: Face ID Check</h3>
            <span style={{
              fontSize: 12,
              fontWeight: 600,
              padding: '4px 8px',
              borderRadius: 12,
              background: faceVerified ? 'rgba(18, 163, 126, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: faceVerified ? 'var(--success)' : 'var(--error)'
            }}>
              {faceVerified ? 'Verified' : 'Pending'}
            </span>
          </div>

          <div style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '4/3',
            background: '#1a1a2e',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {faceChecking ? (
              <>
                <video
                  ref={videoRef}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                  muted
                  playsInline
                />
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '60%',
                  height: '70%',
                  border: '2px dashed var(--primary)',
                  borderRadius: '50%',
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                  pointerEvents: 'none'
                }} />
              </>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                <span style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>📷</span>
                {faceVerified ? '✓ Face verified successfully' : 'Camera is inactive'}
              </div>
            )}
          </div>

          <div style={{
            fontSize: 13,
            padding: 12,
            borderRadius: 'var(--radius-md)',
            background: faceStatusClass === 'success' ? 'rgba(18, 163, 126, 0.05)' : faceStatusClass === 'err' ? 'rgba(239, 68, 68, 0.05)' : 'var(--surface-hover)',
            color: faceStatusClass === 'success' ? 'var(--success)' : faceStatusClass === 'err' ? 'var(--error)' : 'var(--text-secondary)',
            fontWeight: 500,
            textAlign: 'center',
            minHeight: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {faceStatus}
          </div>

          {!faceVerified && faceChecking && (
            <Button onClick={captureAndVerifyFace} loading={capturingFace} fullWidth>
              Capture & Verify Face
            </Button>
          )}

          {!faceVerified && !faceChecking && (
            <Button onClick={startFaceCamera} fullWidth>
              Start Face Camera
            </Button>
          )}
        </div>

        {/* Step 2: Voice ID Verification */}
        <div className="common-card" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24, opacity: faceVerified ? 1 : 0.6, border: voiceVerified ? '2px solid var(--success)' : '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Step 2: Voice ID Check</h3>
            <span style={{
              fontSize: 12,
              fontWeight: 600,
              padding: '4px 8px',
              borderRadius: 12,
              background: voiceVerified ? 'rgba(18, 163, 126, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: voiceVerified ? 'var(--success)' : 'var(--error)'
            }}>
              {voiceVerified ? 'Verified' : 'Locked'}
            </span>
          </div>

          <div style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '4/3',
            background: '#1a1a2e',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {voiceChecking && !voiceVerified ? (
              <>
                <canvas
                  ref={canvasRef}
                  width={320}
                  height={140}
                  style={{ width: '100%', height: 140 }}
                />
                <div style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  background: 'rgba(239, 68, 68, 0.9)',
                  color: 'white',
                  padding: '4px 10px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                }}>
                  REC: 0:0{recordingSeconds}s
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                <span style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>🎙️</span>
                {voiceVerified ? '✓ Voice matched successfully' : 'Microphone is inactive'}
              </div>
            )}
          </div>

          <div style={{
            fontSize: 13,
            padding: 12,
            borderRadius: 'var(--radius-md)',
            background: voiceStatusClass === 'success' ? 'rgba(18, 163, 126, 0.05)' : voiceStatusClass === 'err' ? 'rgba(239, 68, 68, 0.05)' : 'var(--surface-hover)',
            color: voiceStatusClass === 'success' ? 'var(--success)' : voiceStatusClass === 'err' ? 'var(--error)' : 'var(--text-secondary)',
            fontWeight: 500,
            textAlign: 'center',
            minHeight: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {voiceStatus}
          </div>

          {faceVerified && !voiceVerified && !voiceChecking && (
            <Button onClick={startVoiceVerification} fullWidth>
              Start Voice Verification
            </Button>
          )}
        </div>
      </div>

      {/* Bottom Actions */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
        <Button variant="secondary" onClick={() => navigate(ROUTES.USER.DASHBOARD)} style={{ minWidth: 160 }}>
          Cancel
        </Button>
        <Button
          onClick={() => navigate(ROUTES.USER.INTERVIEW_SESSION(id))}
          disabled={!(faceVerified && voiceVerified)}
          style={{ minWidth: 200 }}
        >
          Enter Interview Room
        </Button>
      </div>
    </div>
  );
}
