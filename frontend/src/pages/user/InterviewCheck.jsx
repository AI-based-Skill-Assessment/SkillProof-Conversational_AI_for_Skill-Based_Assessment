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
  const timerRef = useRef(null);
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
    script.src = '/face-api.min.js';
    script.async = true;
    script.onload = () => {
      console.log('face-api.js script loaded successfully.');
      setFaceApiLoaded(true);
    };
    script.onerror = () => {
      const cdnScript = document.createElement('script');
      cdnScript.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
      cdnScript.onload = () => setFaceApiLoaded(true);
      document.body.appendChild(cdnScript);
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
    
    const LOCAL_MODEL_URL = '/models';
    const CDN_MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights/';
    try {
      try {
        await window.faceapi.nets.tinyFaceDetector.loadFromUri(LOCAL_MODEL_URL);
        await window.faceapi.nets.faceLandmark68TinyNet.loadFromUri(LOCAL_MODEL_URL);
        await window.faceapi.nets.faceRecognitionNet.loadFromUri(LOCAL_MODEL_URL);
      } catch (localErr) {
        await window.faceapi.nets.tinyFaceDetector.loadFromUri(CDN_MODEL_URL);
        await window.faceapi.nets.faceLandmark68TinyNet.loadFromUri(CDN_MODEL_URL);
        await window.faceapi.nets.faceRecognitionNet.loadFromUri(CDN_MODEL_URL);
      }
      setModelsLoaded(true);
    } catch (err) {
      console.error(err);
      setFaceStatus('Failed to load recognition models. Please reload the page.');
      setFaceStatusClass('err');
      toast.error('Model Load Failed', 'Could not fetch face-api weights.');
      throw err;
    }
  }

  // Face detection loop reference
  const loopActiveRef = useRef(false);
  const [faceDetected, setFaceDetected] = useState(false);

  async function startFaceCamera() {
    try {
      await loadFaceModels();
      setFaceChecking(true);
      setFaceStatus('Accessing camera permission...');
      setFaceStatusClass('info');

      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640, min: 320 },
          height: { ideal: 480, min: 240 },
          frameRate: { ideal: 30, max: 60 }
        }
      });
      streamRef.current = videoStream;

      if (videoRef.current) {
        videoRef.current.srcObject = videoStream;
        await videoRef.current.play();
        setFaceStatus('Looking for face... position your face in the oval.');
        startFaceDetectionLoop();
      }
    } catch (err) {
      console.error(err);
      setFaceChecking(false);
      setFaceStatus('Camera access denied. Please allow camera permissions.');
      setFaceStatusClass('err');
      toast.error('Camera Error', 'Could not start video feed.');
    }
  }

  const faceCanvasRef = useRef(null);

  function startFaceDetectionLoop() {
    loopActiveRef.current = true;

    async function loop() {
      if (!loopActiveRef.current || !videoRef.current) return;
      const video = videoRef.current;
      const canvas = faceCanvasRef.current;

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        if (loopActiveRef.current) requestAnimationFrame(loop);
        return;
      }

      if (canvas && (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight)) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const ctx = canvas?.getContext('2d');
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      try {
        const options = new window.faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.15 });
        const det = await window.faceapi.detectSingleFace(video, options);

        if (det) {
          setFaceDetected(true);
          setFaceStatus('✓ Face detected! Click "Capture & Verify Face" to proceed.');
          setFaceStatusClass('success');

          if (ctx) {
            const box = det.box;
            // Draw neon green face bounding box with corner brackets
            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 3;
            ctx.strokeRect(box.x, box.y, box.width, box.height);

            // Draw glowing box corners
            const cornerLen = 16;
            ctx.strokeStyle = '#4ade80';
            ctx.lineWidth = 4;
            // Top-left
            ctx.beginPath(); ctx.moveTo(box.x, box.y + cornerLen); ctx.lineTo(box.x, box.y); ctx.lineTo(box.x + cornerLen, box.y); ctx.stroke();
            // Top-right
            ctx.beginPath(); ctx.moveTo(box.x + box.width - cornerLen, box.y); ctx.lineTo(box.x + box.width, box.y); ctx.lineTo(box.x + box.width, box.y + cornerLen); ctx.stroke();
            // Bottom-left
            ctx.beginPath(); ctx.moveTo(box.x, box.y + box.height - cornerLen); ctx.lineTo(box.x, box.y + box.height); ctx.lineTo(box.x + cornerLen, box.y + box.height); ctx.stroke();
            // Bottom-right
            ctx.beginPath(); ctx.moveTo(box.x + box.width - cornerLen, box.y + box.height); ctx.lineTo(box.x + box.width, box.y + box.height); ctx.lineTo(box.x + box.width, box.y + box.height - cornerLen); ctx.stroke();
          }
        } else {
          setFaceDetected(false);
          setFaceStatus('No face detected — centre your face in the frame.');
          setFaceStatusClass('info');
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

  async function captureAndVerifyFace() {
    if (!videoRef.current) return;
    loopActiveRef.current = false;
    setCapturingFace(true);
    setFaceStatus('Capturing face image & extracting biometric footprint...');
    setFaceStatusClass('info');

    try {
      // Try inputSizes from fast to standard if detection fails
      let result = null;
      for (const inputSize of [320, 224, 160, 416]) {
        const options = new window.faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold: 0.15 });
        result = await window.faceapi
          .detectSingleFace(videoRef.current, options)
          .withFaceLandmarks(true)
          .withFaceDescriptor();
        if (result) break;
      }

      if (!result) {
        throw new Error('No face detected during capture. Please ensure good lighting and face directly forward.');
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
        throw new Error('Face ID mismatch. Ensure you match the registered candidate profile.');
      }
    } catch (err) {
      console.error(err);
      setFaceStatus(err.message || 'Face verification failed. Please try again.');
      setFaceStatusClass('err');
      toast.error('Face ID Check Failed', err.message || 'Please look directly at the camera.');
      startFaceDetectionLoop();
    } finally {
      setCapturingFace(false);
    }
  }

  function stopCamera() {
    loopActiveRef.current = false;
    setFaceDetected(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => {
        try { t.stop(); t.enabled = false; } catch (e) {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      if (videoRef.current.srcObject && videoRef.current.srcObject.getTracks) {
        try {
          videoRef.current.srcObject.getTracks().forEach(t => {
            try { t.stop(); t.enabled = false; } catch (e) {}
          });
        } catch (e) {}
      }
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

      // Start 5-second recording countdown (or candidate can click Stop & Verify anytime)
      setVoiceStatus('Read aloud clearly: "My voice is my unique identity and my password"');
      let sec = 0;
      setRecordingSeconds(0);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        sec++;
        setRecordingSeconds(sec);
        if (sec >= 5) {
          if (timerRef.current) clearInterval(timerRef.current);
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
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
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
        const errMsg = res.data.message || 'Voice ID mismatch: Speaker voice pattern does not match the registered candidate profile.';
        setVoiceStatus(errMsg);
        setVoiceStatusClass('err');
        toast.error('Voice ID Check Failed', errMsg);
      }
    } catch (err) {
      setVoiceChecking(false);
      const msg = err.response?.data?.detail || err.message || 'Verification failed. Try again.';
      setVoiceStatus(msg);
      setVoiceStatusClass('err');
      toast.error('Voice Check Issue', msg);
    }
  }

  function stopVoiceRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
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

    if (duration < 1.8) {
      throw new Error("Please speak clearly: 'My voice is my unique identity and my password'.");
    }

    const sampleRate = audioBuf.sampleRate;
    const rc = 1.0 / (2 * Math.PI * 150); // 150Hz cutoff frequency
    const dt = 1.0 / sampleRate;
    const alpha = rc / (rc + dt);

    const filteredData = new Float32Array(channelData.length);
    filteredData[0] = channelData[0];
    for (let i = 1; i < channelData.length; i++) {
      filteredData[i] = alpha * (filteredData[i - 1] + channelData[i] - channelData[i - 1]);
    }

    let sumSquares = 0;
    for (let i = 0; i < filteredData.length; i++) {
      sumSquares += filteredData[i] * filteredData[i];
    }
    const rms = Math.sqrt(sumSquares / filteredData.length);
    console.log('[DEBUG] Audio signal RMS energy:', rms);

    // 1. Silent or no voice captured
    if (rms < 0.003) {
      throw new Error("No voice detected. Please check your microphone and speak clearly.");
    }

    const frameSize = 512;
    const numBands = 64;
    const totalSamples = filteredData.length;
    const numTargetFrames = 64;
    const hopSize = Math.max(256, Math.floor((totalSamples - frameSize) / numTargetFrames));
    const embedding = new Array(numBands).fill(0);
    let frames = 0;

    for (let start = 0; start + frameSize < filteredData.length; start += hopSize) {
      const frame = filteredData.slice(start, start + frameSize);
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
    return avgEmbedding.map(v => maxVal > 0 ? parseFloat((v / maxVal).toFixed(6)) : 0);
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
                <canvas
                  ref={faceCanvasRef}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: 'scaleX(-1)',
                    pointerEvents: 'none'
                  }}
                />
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '60%',
                  height: '70%',
                  border: `2px dashed ${faceDetected ? '#22c55e' : 'var(--primary)'}`,
                  borderRadius: '50%',
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                  pointerEvents: 'none',
                  transition: 'border-color 0.3s ease'
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
            <Button onClick={captureAndVerifyFace} loading={capturingFace} disabled={!faceDetected && !capturingFace} fullWidth>
              {faceDetected ? 'Capture & Verify Face' : 'Detecting Face...'}
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

          {(voiceChecking || voiceVerified) && (
            <div style={{
              background: 'var(--surface-hover)',
              padding: '14px 18px',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 600,
              textAlign: 'center',
              color: 'var(--primary)',
              border: '1px solid var(--border)',
              lineHeight: '1.4'
            }}>
              "My voice is my unique identity and my password"
            </div>
          )}

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

          {voiceChecking && !voiceVerified && (
            <Button
              onClick={processVoiceVerification}
              variant="secondary"
              fullWidth
              style={{
                background: 'rgba(99, 102, 241, 0.15)',
                borderColor: '#6366f1',
                color: '#818cf8',
                fontWeight: 600
              }}
            >
              Done Speaking — Stop & Verify
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
