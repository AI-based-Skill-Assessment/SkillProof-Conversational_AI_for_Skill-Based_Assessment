import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../core/auth/AuthContext';
import { useToast } from '../../components/common/Toast';
import client from '../../core/api/client';
import Button from '../../components/common/Button';
import ROUTES from '../../core/routes';
import '../../styles/pages/biometrics-premium.css';

export default function VoiceRegistration() {
  const { user, updateUserCache } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const canvasRef = useRef(null);

  const [recording, setRecording] = useState(false);
  const [complete, setComplete] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const [statusMessage, setStatusMessage] = useState('Click "Start Recording" to begin voice enrollment.');
  const [statusClass, setStatusClass] = useState('');
  const [progress, setProgress] = useState(0);

  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const mediaRecRef = useRef(null);
  const speechRecRef = useRef(null);
  const chunksRef = useRef([]);
  const animFrameRef = useRef(null);
  const stoppingRef = useRef(false);
  const recordingRef = useRef(false);

  const voicePhrase = 'my voice is my unique identity and my password';

  // Onboarding warning check
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('pending') === 'true') {
      toast.warning('Onboarding Required', 'Please complete your registration setup to access the dashboard.');
      navigate(location.pathname, { replace: true });
    }
  }, [location.pathname, location.search, navigate, toast]);

  // Clean up audio context and stream on unmount
  useEffect(() => {
    return () => {
      stopVoiceMic();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  async function startVoiceEnroll() {
    recordingRef.current = true;
    setRecording(true);
    setBlocked(false);
    setStatusMessage('Requesting microphone permission…');
    setStatusClass('info');
    setProgress(10);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start drawing waveform
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        canvas.width = canvas.offsetWidth || 400;
        canvas.height = canvas.offsetHeight || 240;
        drawWaveform(canvas, analyser);
      }

      // MediaRecorder setup
      const mediaRec = new MediaRecorder(stream);
      mediaRec.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRec.start();
      mediaRecRef.current = mediaRec;

      startPhraseRecognition();

      setStatusMessage('Recording… read the passphrase aloud. It will save automatically when recognized.');
      setStatusClass('info');
      setProgress(30);
    } catch (err) {
      console.error(err);
      setStatusMessage('Microphone access denied: ' + err.message);
      setStatusClass('err');
      setRecording(false);
      recordingRef.current = false;
      setProgress(0);
      toast.error('Microphone Access Denied', 'Please allow microphone permissions to complete voice enrollment.');
    }
  }

  function startPhraseRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = event => {
      const transcript = Array.from(event.results)
        .map(result => result[0]?.transcript || '')
        .join(' ')
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (transcript.includes(voicePhrase) && !stoppingRef.current) {
        setStatusMessage('Passphrase recognized. Saving voice fingerprint…');
        stopVoiceEnroll();
      }
    };
    recognition.onerror = event => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('Passphrase recognition unavailable:', event.error);
      }
    };
    recognition.onend = () => {
      if (recordingRef.current && !stoppingRef.current) {
        try { recognition.start(); } catch (_) { }
      }
    };

    speechRecRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      console.warn('Could not start passphrase recognition:', err);
      speechRecRef.current = null;
    }
  }

  function drawWaveform(canvas, analyser) {
    const ctx = canvas.getContext('2d');
    const bufLen = analyser.frequencyBinCount;
    const data = new Uint8Array(bufLen);

    function render() {
      animFrameRef.current = requestAnimationFrame(render);
      analyser.getByteTimeDomainData(data);
      
      // Clear canvas with deep dark background matching theme
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Gradient waveform line
      const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
      grad.addColorStop(0, '#6c63ff');
      grad.addColorStop(0.5, '#a78bfa');
      grad.addColorStop(1, '#6c63ff');

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = grad;
      ctx.beginPath();

      const sliceW = canvas.width / bufLen;
      let x = 0;
      for (let i = 0; i < bufLen; i++) {
        const v = data[i] / 128.0;
        const y = (v / 2) * canvas.height;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceW;
      }
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      // Draw frequency spectrum at the bottom for premium visual feedback
      const freqData = new Uint8Array(bufLen);
      analyser.getByteFrequencyData(freqData);
      const barW = (canvas.width / bufLen) * 2.5;
      let bx = 0;
      for (let i = 0; i < bufLen; i++) {
        const barH = (freqData[i] / 255) * (canvas.height * 0.3);
        const alpha = 0.3 + (freqData[i] / 255) * 0.5;
        ctx.fillStyle = `rgba(108,99,255,${alpha})`;
        ctx.fillRect(bx, canvas.height - barH, barW, barH);
        bx += barW + 1;
      }
    }
    render();
  }

  async function checkDuplicate(voiceEmbedding) {
    try {
      const res = await client.post('/biometric/check-duplicate', {
        session_id: user?.id || user?.user_id,
        voice_embedding: voiceEmbedding
      }, { timeout: 8000 });
      return res.data;
    } catch (err) {
      console.warn('Duplicate check failed or timed out:', err.message);
      return null;
    }
  }

  async function stopVoiceEnroll() {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    setRegistering(true);
    setStatusMessage('Processing voice fingerprint…');
    setStatusClass('info');
    setProgress(60);

    if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') {
      mediaRecRef.current.stop();
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    // Wait slightly to guarantee the last chunks are received
    await new Promise(r => setTimeout(r, 400));

    try {
      const embedding = await extractVoiceEmbedding(chunksRef.current);
      if (!embedding || embedding.length === 0) {
        throw new Error('Empty audio captured — please record longer.');
      }

      setProgress(70);
      setStatusMessage('Checking for duplicate voice registrations…');
      setStatusClass('info');

      const dupResult = await checkDuplicate(embedding);
      if (dupResult && dupResult.voice_is_duplicate) {
        stopVoiceMic();
        setRegistering(false);
        setBlocked(true);
        setStatusMessage(dupResult.message || 'Duplicate voice detected');
        setStatusClass('err');
        setProgress(0);
        toast.error('Duplicate Voice Detected', dupResult.message || 'This voice is already registered under a different account.');
        return;
      }

      setProgress(85);
      setStatusMessage('Saving voice fingerprint to database profile…');
      setStatusClass('info');

      await client.post('/biometric/register', {
        session_id: user?.id || user?.user_id,
        voice_embedding: embedding
      });

      if (updateUserCache) {
        updateUserCache({ 
          voice_registered: true,
          onboarding_step: 'completed'
        });
      }
      stopVoiceMic();
      setComplete(true);
      setProgress(100);
      setStatusMessage('✓ Voice fingerprint registered successfully!');
      setStatusClass('ok');
      toast.success('Onboarding Complete', 'Voice fingerprint registered successfully!');
    } catch (err) {
      console.error(err);
      setRegistering(false);
      const errMsg = formatApiError(err);
      setStatusMessage('Error: ' + errMsg);
      setStatusClass('err');
      toast.error('Registration Failed', errMsg);
    } finally {
      stopVoiceMic();
    }
  }

  function formatApiError(err, fallback = 'Failed to process voice fingerprint.') {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return detail.map(d => d.msg || JSON.stringify(d)).join(' | ');
    if (typeof detail === 'object' && detail !== null) return detail.msg || JSON.stringify(detail);
    return err.message || fallback;
  }

  // FFT and Spectral Feature Vector extraction math matching biometric_enroll.html
  async function extractVoiceEmbedding(chunks) {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    const arrayBuf = await blob.arrayBuffer();
    const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuf = await tempCtx.decodeAudioData(arrayBuf);
    await tempCtx.close();

    const channelData = audioBuf.getChannelData(0); // Float32Array
    const duration = audioBuf.duration;

    // Speech recognition confirms the phrase; keep only a short audio sanity check for fallback browsers.
    if (duration < 1.5) {
      throw new Error("Incomplete recording: You missed words in the sentence. Please read the entire sentence clearly: 'My voice is my unique identity and my password'.");
    }

    // 1. High-pass filter to remove low-frequency room noise (background hum / noise suppression)
    const sampleRate = audioBuf.sampleRate;
    const rc = 1.0 / (2 * Math.PI * 150); // 150Hz cutoff frequency
    const dt = 1.0 / sampleRate;
    const alpha = rc / (rc + dt);

    const filteredData = new Float32Array(channelData.length);
    filteredData[0] = channelData[0];
    for (let i = 1; i < channelData.length; i++) {
      filteredData[i] = alpha * (filteredData[i - 1] + channelData[i] - channelData[i - 1]);
    }

    // 2. Calculate RMS energy (signal amplitude) on noise-filtered audio
    let sumSquares = 0;
    for (let i = 0; i < filteredData.length; i++) {
      sumSquares += filteredData[i] * filteredData[i];
    }
    const rms = Math.sqrt(sumSquares / filteredData.length);
    console.log('[DEBUG] Audio signal RMS energy (after noise filtering):', rms);

    // If signal amplitude is extremely low (silence)
    if (rms < 0.005) {
      throw new Error("No voice detected. Please check your microphone and read the sentence: 'My voice is my unique identity and my password'.");
    }

    // If signal is present but too soft/quiet for reliable biometric extraction
    if (rms < 0.025) {
      throw new Error("The recording is not clear or missing words. Please read every word of the sentence clearly: 'My voice is my unique identity and my password'.");
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
    // Average feature values across frames & Min-Max normalize to [0, 1] range
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

  // Exact FFT implementation from biometric_enroll.html
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

  function stopVoiceMic() {
    recordingRef.current = false;
    if (speechRecRef.current) {
      speechRecRef.current.onend = null;
      speechRecRef.current.stop();
      speechRecRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }

  function handleRetry() {
    stopVoiceMic();
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setRecording(false);
    setComplete(false);
    setRegistering(false);
    setBlocked(false);
    setProgress(0);
    setStatusMessage('Click "Start Recording" to begin voice enrollment.');
    setStatusClass('');
    stoppingRef.current = false;
  }

  function handleFinish() {
    if (updateUserCache) {
      updateUserCache({ 
        voice_registered: true,
        onboarding_step: 'completed'
      });
    }
    navigate(ROUTES.USER.DASHBOARD);
  }

  return (
    <div className="biometric-page" style={{ background: 'var(--background)' }}>
      <div className={`biometric-card anim-scale-in ${recording ? 'capturing' : ''} ${complete ? 'registered' : ''}`} 
           style={{ 
             maxWidth: 540,
             background: 'var(--surface)',
             border: '1px solid var(--border)',
             boxShadow: 'var(--shadow-lg)',
             color: 'var(--text-primary)'
           }}>
        
        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 className="biometric-card__title" style={{ margin: 0, color: 'var(--text-primary)' }}>Voice Profile Registry</h2>
          <span className={`badge ${complete ? 'badge-done' : blocked ? 'badge-error' : recording ? 'badge-active' : 'badge-pending'}`}>
            {complete ? 'Registered' : blocked ? 'Blocked' : recording ? 'Recording' : 'Pending'}
          </span>
        </div>

        <p className="biometric-card__subtitle" style={{ textAlign: 'left', alignSelf: 'flex-start', marginBottom: 20, color: 'var(--text-secondary)' }}>
          Read the security phrase clearly into your microphone. This template will protect against voice spoofing and deepfakes during verification.
        </p>

        {/* 4:3 Rectangular Waveform media panel matching biometric_enroll.html */}
        <div className="media-panel" style={{ width: '100%', position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#09090f', border: '1px solid var(--border)', aspectRatio: '4/3', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {complete ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--success)' }}>
              <div style={{ fontSize: '5rem' }}>✅</div>
              <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>Voice registered successfully!</p>
            </div>
          ) : blocked ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--error)', padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: '5rem' }}>❌</div>
              <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>Biometric duplicate registration blocked.</p>
            </div>
          ) : !recording ? (
            <div className="media-placeholder" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--text-secondary)', gap: 12 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--primary)', opacity: 0.8 }}>
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
              <p style={{ fontSize: '0.9rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Waveform visualizer will appear here.<br />Click Start Recording below.</p>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              style={{ width: '100%', height: '100%', display: 'block' }}
            />
          )}
        </div>

        {/* Passphrase Box */}
        {(recording || complete) && (
          <div style={{
            background: 'var(--surface-elevated)',
            padding: '16px 20px',
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: 600,
            textAlign: 'center',
            color: 'var(--primary)',
            border: '1px solid var(--border)',
            width: '100%',
            marginBottom: 20,
            lineHeight: '1.5'
          }}>
            "My voice is my unique identity and my password"
          </div>
        )}

        {/* Progress Bar */}
        <div style={{ width: '100%', height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), #a78bfa)', transition: 'width 0.3s ease' }} />
        </div>

        {/* Status Text Banner */}
        <div className={`bio-status ${statusClass}`} style={{ fontSize: 13, marginBottom: 24, fontWeight: 500, alignSelf: 'flex-start' }}>
          {statusMessage}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 12, width: '100%' }}>
          {complete ? (
            <Button fullWidth onClick={handleFinish} shimmer>
              Go to Dashboard →
            </Button>
          ) : !recording ? (
            <Button fullWidth onClick={startVoiceEnroll} shimmer>
              🎙 Start Recording
            </Button>
          ) : (
            <>
              <Button variant="danger" onClick={stopVoiceEnroll} loading={registering} disabled={blocked}>
                ⏹ Stop & Save
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
