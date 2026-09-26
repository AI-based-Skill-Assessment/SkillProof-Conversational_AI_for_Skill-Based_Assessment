import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../components/common/Toast';
import client from '../../core/api/client';
import VoiceWaveform from '../../components/common/VoiceWaveform';
import AIOrb from '../../components/common/AIOrb';
import Button from '../../components/common/Button';
import ThoughtLine from '../../components/common/ThoughtLine';
import TechBackground from '../../components/common/TechBackground';
import soundEffects from '../../core/audio/soundEffects';
import ROUTES from '../../core/routes';
import '../../styles/pages/portal.css';

// ── Developer Flag: Toggle strict lockdown for debugging/console access ──
// Set to `false` during development so developers can right-click / inspect console.
// Set to `true` in production to enforce strict right-click and DevTools block.
const ENABLE_STRICT_LOCKDOWN = false;

export default function InterviewSession() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const socketRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const chatScrollRef = useRef(null);
  const speechRecRef = useRef(null);
  const spokenTranscriptRef = useRef('');
  const lastFaceVerifyTimeRef = useRef(0);
  const DEFAULT_Q1 = "Hello! Welcome to your SkillProof interview. Let's start with a simple introduction — tell me about yourself and your background.";
  const firstQuestionRef = useRef(DEFAULT_Q1);

  const [messages, setMessages] = useState([]);
  const [aiState, setAiState] = useState('speaking'); // speaking | listening | processing | idle
  const [aiText, setAiText] = useState(DEFAULT_Q1);

  // Speaker ON/OFF control state
  const [speakerOn, setSpeakerOn] = useState(true);
  const speakerOnRef = useRef(speakerOn);
  useEffect(() => {
    speakerOnRef.current = speakerOn;
  }, [speakerOn]);

  // Real-time Biometrics & Verification state
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isInterviewStarted, setIsInterviewStarted] = useState(false);
  const isInterviewStartedRef = useRef(false);

  const [faceMatchPct, setFaceMatchPct] = useState(100);
  const [faceMatchStatus, setFaceMatchStatus] = useState('VERIFYING');
  const [detectedFacesCount, setDetectedFacesCount] = useState(0);
  const [voiceMatchPct, setVoiceMatchPct] = useState(94);
  const [voiceMatchStatus, setVoiceMatchStatus] = useState('MATCHING');
  const [voiceErrorMessage, setVoiceErrorMessage] = useState('');
  const [gazeCount, setGazeCount] = useState(0);
  const [cheatingAlert, setCheatingAlert] = useState(false);
  const [alertReason, setAlertReason] = useState('');
  const [cameraError, setCameraError] = useState(null);
  const clearMultipleFacesTimerRef = useRef(null);

  // ── Feature 2: Anti-Cheating & Proctoring Telemetry State ──────────────────
  const [integrityScore, setIntegrityScore] = useState(100.0);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [windowBlurCount, setWindowBlurCount] = useState(0);
  const [copyPasteAttempts, setCopyPasteAttempts] = useState(0);

  // ── Feature 5: Full-Duplex Real-Time Voice & Barge-In State ────────────────
  const [isHandsFree, setIsHandsFree] = useState(false);
  const isHandsFreeRef = useRef(false);
  const [isBargeInActive, setIsBargeInActive] = useState(false);
  const isBargeInActiveRef = useRef(false);
  const handsFreeSilenceTimerRef = useRef(null);

  useEffect(() => {
    isHandsFreeRef.current = isHandsFree;
  }, [isHandsFree]);

  // Missing Face per Question counter (Max 2 questions allowed without face before warning/block prompt)
  const [missingFaceQuestionsCount, setMissingFaceQuestionsCount] = useState(0);
  const [showFacePromptModal, setShowFacePromptModal] = useState(false);

  // Live Mic Audio Spectrum array for Voice Waveform
  const [audioSpectrum, setAudioSpectrum] = useState(new Array(15).fill(0.1));

  // Background Noise Sensing State
  const [bgNoiseDetected, setBgNoiseDetected] = useState(false);
  const audioContextRef = useRef(null);
  const noiseAnalyserRef = useRef(null);
  const noiseHoldTimerRef = useRef(null);

  // Push-to-Talk Voice Recording state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceSecs, setVoiceSecs] = useState(0);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textAnswer, setTextAnswer] = useState('');
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  // ── Conversational Helper & Real-Time Closed Captions ──
  const [thinkTimeLeft, setThinkTimeLeft] = useState(0);
  const thinkTimeTimerRef = useRef(null);
  const [showClosedCaptions, setShowClosedCaptions] = useState(true);
  const [largeCaptions, setLargeCaptions] = useState(false);

  function handleTakeThinkTime() {
    if (thinkTimeLeft > 0) {
      if (thinkTimeTimerRef.current) clearInterval(thinkTimeTimerRef.current);
      setThinkTimeLeft(0);
      toast.info('Think Time Ended', 'Resuming standard session timer.');
      return;
    }
    soundEffects.playClick();
    setThinkTimeLeft(30);
    toast.info('30s Reflection Time', 'Take your time. Silence penalties are paused for 30s.');
    if (thinkTimeTimerRef.current) clearInterval(thinkTimeTimerRef.current);
    thinkTimeTimerRef.current = setInterval(() => {
      setThinkTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(thinkTimeTimerRef.current);
          soundEffects.playBeep();
          toast.success('Think Time Concluded', 'You can now record your response.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function handleRephraseQuestion() {
    soundEffects.playClick();
    toast.info('Requesting Rephrase', 'AI interviewer is simplifying the question...');
    handleSendTextWithMsg('Could you please rephrase or explain that question in simpler terms?');
  }

  function handleRepeatQuestion() {
    soundEffects.playClick();
    if (aiText) {
      speakText(aiText);
      toast.info('Repeating Question', 'Playing question audio again.');
    }
  }

  // Auto-scroll chat transcript to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, aiText]);

  // Strict Female Voice Selector across all browser platforms
  function getFemaleVoice() {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    return voices.find(v =>
      v.lang.startsWith('en') &&
      (
        v.name.includes('Zira') ||
        v.name.includes('Samantha') ||
        v.name.includes('Victoria') ||
        v.name.includes('Karen') ||
        v.name.includes('Google UK English Female') ||
        v.name.includes('Google US English') ||
        v.name.includes('Jenny') ||
        v.name.includes('Aria') ||
        v.name.toLowerCase().includes('female')
      ) &&
      !v.name.includes('David') && !v.name.includes('Mark') && !v.name.includes('George')
    ) || voices.find(v => v.lang.startsWith('en') && !v.name.includes('David') && !v.name.includes('Mark'));
  }

  // Ensure browser speech voices populate on Chrome/Edge
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // ── AI Speech Synthesis Helper ─────────────────────────────────────────────
  function speakText(textToSpeak) {
    if (!speakerOnRef.current || !textToSpeak || !('speechSynthesis' in window)) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setAiState('listening');
      return;
    }

    // Gated: Do not speak AI voice until face detection initializes candidate
    if (!isInterviewStartedRef.current) {
      return;
    }

    try {
      window.speechSynthesis.cancel(); // Cancel previous speech
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const femaleVoice = getFemaleVoice();
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      }

      utterance.onstart = () => setAiState('speaking');
      utterance.onend = () => setAiState('listening');
      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis utterance error:', e);
        setAiState('listening');
      };

      // Watchdog Timer: Protect against Chromium speech synthesis hangs
      const wordCount = textToSpeak.split(/\s+/).length;
      const maxSpeechDurationMs = Math.max(4000, (wordCount / 2.0) * 1000 + 3000);
      setTimeout(() => {
        setAiState(curr => curr === 'speaking' ? 'listening' : curr);
      }, maxSpeechDurationMs);

      // Slight delay to ensure chrome speech synthesis engine is active
      setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 50);
    } catch (err) {
      console.warn('SpeechSynthesis error:', err);
      setAiState('listening');
    }
  }

  // Handle Speaker Toggle Mute/Unmute
  function toggleSpeaker() {
    setSpeakerOn(prev => {
      const next = !prev;
      speakerOnRef.current = next;
      if (!next && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Mute immediately if turned off
        setAiState('listening');
      } else if (next && aiText) {
        speakText(aiText);
      }
      return next;
    });
  }

  // ── 0. Security & Browser Navigation Lockdown (Disabled for Live Telemetry Debugging) ──
  function setupSecurityLockdown() {
    const preventContextMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      toast.warning('Security Lockdown', 'Right-click context menu is strictly disabled.');
      return false;
    };

    const handleKeyDown = (e) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
        (e.ctrlKey && (e.key === 'u' || e.key === 'U' || e.key === 's' || e.key === 'S'))
      ) {
        e.preventDefault();
        toast.error('Security Warning', 'DevTools & Inspect Element are prohibited during interview.');
      }
    };

    document.addEventListener('contextmenu', preventContextMenu, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', preventContextMenu, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }

  useEffect(() => {
    // Prevent Back/Forward Navigation
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
      toast.warning('Locked Navigation', 'Browser navigation is locked during active interview session.');
    };
    window.addEventListener('popstate', handlePopState);

    // ── Toggle Right-Click Lockdown (Set to true to block right-click, false to allow DevTools) ──
    const ENABLE_RIGHT_CLICK_BLOCK = false;

    let cleanupLockdown = null;
    if (ENABLE_RIGHT_CLICK_BLOCK) {
      cleanupLockdown = setupSecurityLockdown();
    }

    // ── Feature 2: Tab Switching & Window Blur Proctoring Listeners ─────────
    const handleVisibilityChange = () => {
      if (document.hidden && isInterviewStartedRef.current) {
        setTabSwitchCount(prev => {
          const next = prev + 1;
          setIntegrityScore(s => Math.max(0, Math.round((s - 6.0) * 10) / 10));
          toast.warning('Proctoring Telemetry Alert', `Tab switch detected (Incident #${next}). This event has been recorded in your audit log.`);
          client.post('/biometric/telemetry-event', {
            session_id: id,
            event_type: 'tab_switch',
            details: `Candidate switched browser tab (Incident #${next})`,
            client_timestamp: new Date().toISOString()
          }).catch(() => {});
          return next;
        });
      }
    };

    const handleWindowBlur = () => {
      if (isInterviewStartedRef.current && !document.hidden) {
        setWindowBlurCount(prev => {
          const next = prev + 1;
          client.post('/biometric/telemetry-event', {
            session_id: id,
            event_type: 'window_blur',
            details: `Browser window focus lost (Incident #${next})`,
            client_timestamp: new Date().toISOString()
          }).catch(() => {});
          return next;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      if (cleanupLockdown) cleanupLockdown();
    };
  }, [id, toast]);

  // ── Feature 5: Real-Time Barge-In Interruption ──────────────────────────────
  function triggerBargeIn() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setAiState('listening');
    setIsBargeInActive(true);
    isBargeInActiveRef.current = true;

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'barge_in' }));
    }

    setTimeout(() => {
      setIsBargeInActive(false);
      isBargeInActiveRef.current = false;
    }, 2200);
  }

  function stopWebcamAndAudio() {
    console.log('📷 [HARDWARE RELEASE] Shutting down camera & microphone tracks...');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
          track.enabled = false;
        } catch (e) {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      if (videoRef.current.srcObject) {
        try {
          const s = videoRef.current.srcObject;
          if (s.getTracks) {
            s.getTracks().forEach(t => {
              try { t.stop(); t.enabled = false; } catch (e) {}
            });
          }
        } catch (e) {}
      }
      videoRef.current.srcObject = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) {}
      audioContextRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) {}
    }
    if (speechRecRef.current) {
      try { speechRecRef.current.stop(); } catch (e) {}
    }
    setIsCameraReady(false);
  }

  // ── 1. Start Webcam & Load face-api.js Models ──────────────────────────────
  useEffect(() => {
    startWebcam();

    // Auto-resume AudioContext on page interaction if browser suspended audio stream on refresh
    const handleUserGesture = () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
    };
    window.addEventListener('click', handleUserGesture);
    window.addEventListener('touchstart', handleUserGesture);
    window.addEventListener('keydown', handleUserGesture);

    // If models are already cached in window memory, launch instantly (0ms)
    if (window.faceapi && window.faceapi.nets && window.faceapi.nets.tinyFaceDetector && window.faceapi.nets.tinyFaceDetector.params) {
      setModelsLoaded(true);
      return () => {
        stopWebcamAndAudio();
        window.removeEventListener('click', handleUserGesture);
        window.removeEventListener('touchstart', handleUserGesture);
        window.removeEventListener('keydown', handleUserGesture);
      };
    }

    if (window.faceapi) {
      loadFaceModels();
      return () => {
        stopWebcamAndAudio();
        window.removeEventListener('click', handleUserGesture);
        window.removeEventListener('touchstart', handleUserGesture);
        window.removeEventListener('keydown', handleUserGesture);
      };
    }

    const script = document.createElement('script');
    script.src = '/face-api.min.js';
    script.async = true;
    script.onload = () => {
      loadFaceModels();
    };
    script.onerror = () => {
      // CDN Fallback if local not found
      const cdnScript = document.createElement('script');
      cdnScript.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
      cdnScript.onload = () => loadFaceModels();
      document.body.appendChild(cdnScript);
    };
    document.body.appendChild(script);

    return () => {
      stopWebcamAndAudio();
      window.removeEventListener('click', handleUserGesture);
      window.removeEventListener('touchstart', handleUserGesture);
      window.removeEventListener('keydown', handleUserGesture);
    };
  }, []);

  async function loadFaceModels() {
    if (modelsLoaded) return;
    const LOCAL_MODEL_URL = '/models';
    const CDN_MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights/';

    try {
      // Prioritize fast tinyFaceDetector from local directory
      try {
        await window.faceapi.nets.tinyFaceDetector.loadFromUri(LOCAL_MODEL_URL);
      } catch (localErr) {
        await window.faceapi.nets.tinyFaceDetector.loadFromUri(CDN_MODEL_URL);
      }
      setModelsLoaded(true);

      // Load landmarks and recognition descriptors in background asynchronously
      Promise.all([
        window.faceapi.nets.faceLandmark68TinyNet.loadFromUri(LOCAL_MODEL_URL).catch(() =>
          window.faceapi.nets.faceLandmark68TinyNet.loadFromUri(CDN_MODEL_URL)
        ),
        window.faceapi.nets.faceRecognitionNet.loadFromUri(LOCAL_MODEL_URL).catch(() =>
          window.faceapi.nets.faceRecognitionNet.loadFromUri(CDN_MODEL_URL)
        )
      ]).catch(err => console.warn('Background model load warning:', err));
    } catch (err) {
      console.warn('Face model load warning:', err);
      setModelsLoaded(true);
    }
  }

  // ── Auto-Start Grace Timer: Ensure candidate is NEVER locked waiting for face detection ──
  useEffect(() => {
    const autoStartTimer = setTimeout(() => {
      if (!isInterviewStartedRef.current) {
        isInterviewStartedRef.current = true;
        setIsInterviewStarted(true);
        const qText = firstQuestionRef.current || DEFAULT_Q1;
        setAiText(qText);
        setMessages(prev => (prev.length === 0 ? [{ sender: 'ai', text: qText }] : prev));
        speakText(qText);
      }
    }, 3500);

    return () => clearTimeout(autoStartTimer);
  }, []);

  async function startWebcam() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(err => {
          if (err.name !== 'AbortError') {
            console.warn('Video stream play warning:', err);
          }
        });
        setIsCameraReady(true);
      }

      // Initialize Ambient Background Noise & Live Mic Spectrum Analyzer
      initBackgroundNoiseAnalyser(stream);
    } catch (err) {
      console.warn('Combined audio/video access error, trying fallback:', err);
      try {
        const videoOnly = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
        });
        streamRef.current = videoOnly;
        if (videoRef.current) {
          videoRef.current.srcObject = videoOnly;
          videoRef.current.play().catch(() => {});
          setIsCameraReady(true);
        }
      } catch (videoErr) {
        console.error('Webcam access fallback error:', videoErr);
        setCameraError('Camera or Microphone access restricted. Session is ready in fail-safe mode.');
        setIsCameraReady(true);
      }
    }
  }

  // ── 2. Real-Time Mic Audio Spectrum & Noise Analyzer ──────────────────────
  function initBackgroundNoiseAnalyser(stream) {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      noiseAnalyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const checkNoise = () => {
        if (!noiseAnalyserRef.current) return;

        // Auto-resume audio context if browser suspended audio stream on refresh
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
        }

        analyser.getByteFrequencyData(dataArray);

        // Update 15-band live mic audio spectrum levels for VoiceWaveform component
        const levels = [];
        const step = Math.floor(dataArray.length / 15);
        let sumSquares = 0;
        for (let i = 0; i < 15; i++) {
          const val = dataArray[i * step] || 0;
          const norm = val / 255.0;
          sumSquares += norm * norm;
          levels.push(Math.max(0.1, norm));
        }
        setAudioSpectrum(levels);

        // RMS Voice Activity & Barge-in Detection
        const rms = Math.sqrt(sumSquares / 15);
        if (rms > 0.22 && speakerOnRef.current && isInterviewStartedRef.current) {
          // If AI is actively speaking, candidate speaking triggers immediate Barge-in
          if (aiState === 'speaking' && !isBargeInActiveRef.current) {
            triggerBargeIn();
          }
        }

        requestAnimationFrame(checkNoise);
      };
      checkNoise();
    } catch (err) {
      console.warn('Background noise analyser initialization error:', err);
    }
  }

  // ── 3. Multi-Face Detection Canvas Overlay & Real-Time Tracking Loop ────────
  useEffect(() => {
    if (!modelsLoaded || !isCameraReady) return;

    let animId = null;
    let lastTrackTime = 0;

    const trackFaces = async (timestamp) => {
      if (!videoRef.current || !canvasRef.current) {
        animId = requestAnimationFrame(trackFaces);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.readyState >= 2 && video.clientWidth > 0 && video.clientHeight > 0) {
        if (canvas.width !== video.clientWidth || canvas.height !== video.clientHeight) {
          canvas.width = video.clientWidth;
          canvas.height = video.clientHeight;
        }

        const displaySize = { width: canvas.width, height: canvas.height };

        if (timestamp - lastTrackTime > 30) { // Ultra-fast 30ms (33 FPS) real-time tracking loop
          lastTrackTime = timestamp;
          try {
            // Enhanced inputSize 320 for backlit/shadowed resolution + scoreThreshold 0.15 for low-light resilience
            const trackOptions = new window.faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.15 });
            const hasNets = window.faceapi.nets.faceRecognitionNet?.isLoaded;

            let detections = [];
            if (hasNets) {
              detections = await window.faceapi
                .detectAllFaces(video, trackOptions)
                .withFaceLandmarks(true)
                .withFaceDescriptors();
            } else {
              detections = await window.faceapi.detectAllFaces(video, trackOptions);
            }

            const resizedDetections = window.faceapi.resizeResults(detections, displaySize);
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            setDetectedFacesCount(detections.length);

            if (resizedDetections.length === 1) {
              const det = resizedDetections[0];
              const origDet = detections[0];
              const box = (det && det.box) || (det && det.detection && det.detection.box) || (origDet && origDet.box) || (origDet && origDet.detection && origDet.detection.box);

              // Auto-dismiss face prompt modal when valid face comes back in camera view
              setShowFacePromptModal(false);
              setMissingFaceQuestionsCount(0);

              // Draw thin 1.5px green bounding box for all detected faces
              if (box && typeof box.x === 'number') {
                ctx.strokeStyle = '#22c55e';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(box.x, box.y, box.width, box.height);
              }

              if (!isInterviewStartedRef.current) {
                isInterviewStartedRef.current = true;
                setIsInterviewStarted(true);
                const qText = firstQuestionRef.current || DEFAULT_Q1;
                setAiText(qText);
                setMessages([{ sender: 'ai', text: qText }]);
                speakText(qText);
              }

              // Periodically verify facial descriptor against registered candidate database profile every 2500ms
              if (timestamp - lastFaceVerifyTimeRef.current > 2500) {
                lastFaceVerifyTimeRef.current = timestamp;

                // Extract descriptor directly from original detections object or compute on demand
                let descriptorArray = null;
                if (origDet && origDet.descriptor) {
                  descriptorArray = Array.from(origDet.descriptor);
                } else if (det && det.descriptor) {
                  descriptorArray = Array.from(det.descriptor);
                } else {
                  try {
                    const fullDet = await window.faceapi
                      .detectSingleFace(video, trackOptions)
                      .withFaceLandmarks(true)
                      .withFaceDescriptor();
                    if (fullDet && fullDet.descriptor) {
                      descriptorArray = Array.from(fullDet.descriptor);
                    }
                  } catch (e) { }
                }

                if (descriptorArray && descriptorArray.length >= 64) {
                  try {
                    const res = await client.post('/biometric/interview-verify', {
                      session_id: id,
                      face_embedding: descriptorArray
                    });

                    if (res.data) {
                      const match = res.data.face_match;
                      const conf = res.data.face_confidence !== undefined ? res.data.face_confidence : (match ? 0.94 : 0.25);
                      const matchPct = Math.min(100, Math.max(10, Math.round(conf * 100)));

                      setFaceMatchPct(matchPct);
                      setFaceMatchStatus(match ? 'MATCHING' : 'MISMATCH');

                      if (!match) {
                        setCheatingAlert(true);
                        setAlertReason('Face ID Mismatch: Person on camera does not match registered candidate profile.');
                      } else {
                        setCheatingAlert(false);
                        setAlertReason('');
                      }
                    }
                  } catch (apiErr) {
                    console.warn('Background face descriptor verification warning:', apiErr);
                  }
                } else {
                  console.warn('⚠️ [FACE VERIFICATION SKIPPED] No 128D descriptor present on detection object.');
                }
              }
            } else if (resizedDetections.length > 1) {
              if (clearMultipleFacesTimerRef.current) {
                clearTimeout(clearMultipleFacesTimerRef.current);
                clearMultipleFacesTimerRef.current = null;
              }

              resizedDetections.forEach((det, i) => {
                const origDet = detections[i];
                const box = (det && det.box) || (det && det.detection && det.detection.box) || (origDet && origDet.box) || (origDet && origDet.detection && origDet.detection.box);

                if (box && typeof box.x === 'number') {
                  ctx.strokeStyle = '#22c55e';
                  ctx.lineWidth = 1.5;
                  ctx.strokeRect(box.x, box.y, box.width, box.height);
                }
              });

              setFaceMatchStatus('MULTIPLE FACES DETECTED');
              setFaceMatchPct(0);
              setCheatingAlert(true);
              setAlertReason('Multiple faces detected in camera view! Ensure you are alone.');
              
              // Periodically run Groq Vision AI proctoring check every 5 seconds
              triggerVisionAICheck();
            } else {
              if (clearMultipleFacesTimerRef.current) {
                clearTimeout(clearMultipleFacesTimerRef.current);
                clearMultipleFacesTimerRef.current = null;
              }
              setFaceMatchStatus('NO FACE DETECTED');
              setFaceMatchPct(null);
              // Suppress "No face detected" cheating alert banner per user request
              setCheatingAlert(false);
              setAlertReason('');
            }

            // Continuous 5-second background Vision AI Proctoring loop during active interview
            triggerVisionAICheck();
          } catch (err) {
            console.warn('Real-time face tracking tick error:', err);
          }
        }
      }

      animId = requestAnimationFrame(trackFaces);
    };

    animId = requestAnimationFrame(trackFaces);

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [modelsLoaded, isCameraReady, id]);

  // ── Helper: Event-Driven Vision AI Proctoring Check ───────────────────────
  const lastVisionCheckTimeRef = useRef(0);
  async function triggerVisionAICheck() {
    // Throttle checks to max 1 call per 5 seconds per candidate
    const now = Date.now();
    if (now - lastVisionCheckTimeRef.current < 5000) return;
    lastVisionCheckTimeRef.current = now;

    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const snapCanvas = document.createElement('canvas');
      snapCanvas.width = 512;
      snapCanvas.height = 384;
      const ctx = snapCanvas.getContext('2d');
      ctx.drawImage(video, 0, 0, 512, 384);

      const imageB64 = snapCanvas.toDataURL('image/jpeg', 0.85);

      const visionRes = await client.post('/interview/analyze-vision-frame', {
        session_id: id,
        image_b64: imageB64
      });

      if (visionRes.data && visionRes.data.suspicious) {
        const aiReason = visionRes.data.reason || 'Suspicious activity detected by Groq Vision AI.';
        
        if (visionRes.data.person_behind) {
          const msg = `Secondary Person Alert: ${aiReason || 'Someone is standing or peeking behind you. Please ensure you are alone.'}`;
          setFaceMatchStatus('MULTIPLE FACES DETECTED');
          setCheatingAlert(true);
          setAlertReason(msg);
          toast.error('Person Behind Detected', msg);
          console.warn('⚠️ [VISION AI ALERT] Person Standing/Peeking Behind Candidate:', aiReason);

        } else if (visionRes.data.multiple_people) {
          const msg = `Multiple People Alert: ${aiReason || 'More than one person detected in room.'}`;
          setFaceMatchStatus('MULTIPLE FACES DETECTED');
          setCheatingAlert(true);
          setAlertReason(msg);
          toast.error('Multiple People Alert', msg);
          console.warn('⚠️ [VISION AI ALERT] Multiple People in Frame:', aiReason);

        } else if (visionRes.data.reading_phone) {
          const msg = `Device/Notes Alert: ${aiReason || 'Candidate reading off mobile phone, notes, or secondary device.'}`;
          setCheatingAlert(true);
          setAlertReason(msg);
          toast.warning('Vision Alert', msg);
          console.warn('⚠️ [VISION AI ALERT] Phone / Notes Reading Detected:', aiReason);

        } else if (visionRes.data.no_person) {
          const msg = `No Candidate Visible: ${aiReason || 'Candidate absent from camera view.'}`;
          setFaceMatchStatus('NO FACE DETECTED');
          setCheatingAlert(true);
          setAlertReason(msg);
          console.warn('⚠️ [VISION AI ALERT] No Person Visible:', aiReason);
        }
      } else {
        console.log('✅ [VISION AI CLEAR] Frame verified normal by Groq Llama-3.2-Vision.');
      }
    } catch (err) {
      console.warn('Vision AI Check warning:', err);
    }
  }

  // ── 4. Voice Recording & Live Speech-to-Text Answers ─────────────────────
  async function startVoiceRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          channelCount: 1,
          sampleRate: { ideal: 48000 }
        }
      });
      audioChunksRef.current = [];
      spokenTranscriptRef.current = '';

      // Initialize Web Speech API SpeechRecognition for live spoken words
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const rec = new SpeechRecognition();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = 'en-US';

          rec.onresult = (e) => {
            let liveText = '';
            for (let i = 0; i < e.results.length; i++) {
              liveText += e.results[i][0].transcript;
            }
            if (liveText.trim()) {
              spokenTranscriptRef.current = liveText.trim();
            }
          };

          rec.start();
          speechRecRef.current = rec;
        } catch (recErr) {
          console.warn('SpeechRecognition start warning:', recErr);
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.start(250);
      setIsRecordingVoice(true);
      setVoiceSecs(0);

      timerRef.current = setInterval(() => {
        setVoiceSecs(s => s + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed starting audio recorder:', err);
      toast.error('Microphone Error', 'Could not access microphone for voice intake.');
    }
  }

  async function stopVoiceRecording() {
    if (mediaRecorderRef.current && isRecordingVoice) {
      mediaRecorderRef.current.stop();

      if (speechRecRef.current) {
        try { speechRecRef.current.stop(); } catch (e) { }
      }

      setIsRecordingVoice(false);
      clearInterval(timerRef.current);

      await new Promise(r => setTimeout(r, 400));
      processVoiceAnswerVerification();
    }
  }

  // Submit candidate's real spoken words to AI
  async function processVoiceAnswerVerification() {
    try {
      const embedding = await extractVoiceEmbedding(audioChunksRef.current);

      if (!embedding || embedding.length === 0) {
        return;
      }

      // Transcribe audio on backend using Groq Whisper API
      let transcribedText = '';
      setIsTranscribing(true);
      try {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'answer.webm');

        const sttRes = await client.post('/interview/transcribe', formData, {
          timeout: 30000,
        });

        if (sttRes.data && sttRes.data.text) {
          transcribedText = sttRes.data.text.trim();
        }
      } catch (sttErr) {
        console.warn('Backend transcription failed, falling back to client-side Web Speech API:', sttErr);
      } finally {
        setIsTranscribing(false);
      }

      // If backend transcription failed or returned empty, fallback to Web Speech API live transcript
      if (!transcribedText && spokenTranscriptRef.current) {
        transcribedText = spokenTranscriptRef.current.trim();
      }

      // Hallucinated Whisper/STT artifacts generated during background microphone silence
      const HALLUCINATED_SILENCE_TEXTS = [
        'thank you.', 'thank you', 'thanks.', 'thanks',
        'thank you for watching.', 'subtitles by', 'amara.org',
        'you', 'applause', 'laughter', 'music', ''
      ];

      const cleanTranscribed = transcribedText.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

      // Check if candidate actually spoke genuine words
      if (!transcribedText || HALLUCINATED_SILENCE_TEXTS.includes(cleanTranscribed) || cleanTranscribed.length < 3) {
        toast.warning('No Speech Detected', 'No voice input was detected. Please click Record Answer and speak your answer clearly into the microphone.');
        return;
      }

      // Event-Driven Vision AI Check upon answer submission
      triggerVisionAICheck();

      // Voice biometric verification with fail-safe fallback
      try {
        const res = await client.post('/biometric/verify', {
          session_id: id,
          voice_embedding: embedding
        });

        if (res.data && res.data.voice_match) {
          setVoiceMatchStatus('MATCHING');
          setVoiceMatchPct(Math.round((res.data.voice_confidence || 0.92) * 100));
          setVoiceErrorMessage('');
        } else {
          setVoiceMatchStatus('MISMATCH');
          setVoiceMatchPct(35);
          const errMsg = res.data?.message || 'Voice signature variation detected under ambient sound.';
          setVoiceErrorMessage(errMsg);
        }
      } catch (bioErr) {
        console.warn('Voice biometric verification ping warning:', bioErr);
      }

      // Always forward the candidate's answer to the AI so the interview flows uninterrupted
      handleSendTextWithMsg(transcribedText);
    } catch (err) {
      console.error('Voice answer verification failed:', err);
    }
  }

  // ── Noise-Resilient FFT Voice Extraction with Adaptive VAD & Spectral Noise Shielding ──
  async function extractVoiceEmbedding(chunks) {
    if (!chunks || chunks.length === 0) return [];
    try {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const arrayBuf = await blob.arrayBuffer();
      const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuf = await tempCtx.decodeAudioData(arrayBuf);
      await tempCtx.close();

      const channelData = audioBuf.getChannelData(0);
      const sampleRate = audioBuf.sampleRate;

      // 1. Dual-pole Bandpass Filter (High-pass 90Hz to strip AC/traffic rumble, Low-pass 7.5kHz to strip hiss)
      const rcHigh = 1.0 / (2 * Math.PI * 90);
      const dt = 1.0 / sampleRate;
      const alphaHigh = rcHigh / (rcHigh + dt);

      const filteredData = new Float32Array(channelData.length);
      filteredData[0] = channelData[0];
      for (let i = 1; i < channelData.length; i++) {
        filteredData[i] = alphaHigh * (filteredData[i - 1] + channelData[i] - channelData[i - 1]);
      }

      // 2. Compute frame-by-frame RMS to calculate adaptive ambient noise floor
      const frameSize = 512;
      const hopSize = 256;
      const numBands = 64;
      const frameEnergies = [];

      for (let start = 0; start + frameSize < filteredData.length; start += hopSize) {
        let frameSum = 0;
        for (let j = 0; j < frameSize; j++) {
          const sample = filteredData[start + j];
          frameSum += sample * sample;
        }
        frameEnergies.push(Math.sqrt(frameSum / frameSize));
      }

      if (frameEnergies.length === 0) return [];

      // Sort energies to find baseline ambient noise floor (20th percentile)
      const sortedEnergies = [...frameEnergies].sort((a, b) => a - b);
      const noiseFloor = sortedEnergies[Math.floor(sortedEnergies.length * 0.20)] || 0.001;
      // Speech threshold: only extract formants from vocal bursts at least 1.6x above noise floor
      const speechThreshold = Math.max(0.003, noiseFloor * 1.6);

      const embedding = new Array(numBands).fill(0);
      let activeSpeechFrames = 0;

      // Hann window function to prevent spectral leakage
      const hannWindow = new Float32Array(frameSize);
      for (let i = 0; i < frameSize; i++) {
        hannWindow[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (frameSize - 1)));
      }

      let frameIdx = 0;
      for (let start = 0; start + frameSize < filteredData.length; start += hopSize) {
        const energy = frameEnergies[frameIdx++] || 0;
        // Ignore ambient room noise frames completely
        if (energy < speechThreshold) continue;

        const windowedFrame = new Float32Array(frameSize);
        for (let j = 0; j < frameSize; j++) {
          windowedFrame[j] = filteredData[start + j] * hannWindow[j];
        }

        const mag = getFFTMagnitude(windowedFrame, frameSize);
        const binPerBand = Math.floor((frameSize / 2) / numBands);
        for (let b = 0; b < numBands; b++) {
          let sum = 0;
          for (let k = 0; k < binPerBand; k++) {
            sum += mag[b * binPerBand + k];
          }
          embedding[b] += sum / Math.max(1, binPerBand);
        }
        activeSpeechFrames++;
      }

      // If no frames passed the speech threshold, fallback to all frames
      if (activeSpeechFrames === 0) {
        for (let start = 0; start + frameSize < filteredData.length; start += hopSize) {
          const frame = filteredData.slice(start, start + frameSize);
          const mag = getFFTMagnitude(frame, frameSize);
          const binPerBand = Math.floor((frameSize / 2) / numBands);
          for (let b = 0; b < numBands; b++) {
            let sum = 0;
            for (let k = 0; k < binPerBand; k++) {
              sum += mag[b * binPerBand + k];
            }
            embedding[b] += sum / Math.max(1, binPerBand);
          }
          activeSpeechFrames++;
        }
      }

      if (activeSpeechFrames === 0) return [];
      const avgEmbedding = embedding.map(v => v / activeSpeechFrames);
      const maxVal = Math.max(...avgEmbedding);
      return avgEmbedding.map(v => maxVal > 0 ? parseFloat((v / maxVal).toFixed(6)) : 0);
    } catch (e) {
      console.warn('extractVoiceEmbedding error:', e);
      return [];
    }
  }

  function getFFTMagnitude(frame, n) {
    const re = new Float32Array(n);
    const im = new Float32Array(n).fill(0);
    re.set(frame);
    fft(re, im);
    const half = n / 2;
    const mag = new Float32Array(half);
    for (let i = 0; i < half; i++) {
      mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]) / n;
    }
    return mag;
  }

  function bitReverse(n, bits) {
    let reversed = 0;
    for (let i = 0; i < bits; i++) {
      if ((n & (1 << i)) !== 0) reversed |= (1 << (bits - 1 - i));
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

  // ── 5. WebSocket Integration ──────────────────────────────────────────────
  const navigateRef = useRef(navigate);
  const toastRef = useRef(toast);
  useEffect(() => {
    navigateRef.current = navigate;
    toastRef.current = toast;
  });

  const [wsStatus, setWsStatus] = useState('connecting');
  const [reconnectCounter, setReconnectCounter] = useState(0);

  useEffect(() => {
    let isComponentMounted = true;
    let socket = null;
    let pingInterval = null;
    let reconnectTimer = null;

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.hostname}:8000/api/v1/interview/${id}/ws`;
      setWsStatus('connecting');

      socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        if (!isComponentMounted) return;
        setWsStatus('connected');
        socket.send(JSON.stringify({ type: 'start' }));

        pingInterval = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
          }
        }, 10000);
      };

      socket.onmessage = (event) => {
        if (!isComponentMounted) return;
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'pong') {
            return;
          }

          if (data.type === 'ready') {
            const qText = data.first_question || data.content || DEFAULT_Q1;
            firstQuestionRef.current = qText;
            setAiText(qText);
            if (isInterviewStartedRef.current) {
              setAiState('speaking');
              speakText(qText);
              setMessages(prev => (prev.length === 0 ? [{ sender: 'ai', text: qText }] : prev));
            }
          } else if (data.type === 'question' || data.role === 'assistant') {
            setAiState('speaking');
            const qText = data.content || data.text || data.first_question;
            if (qText) {
              setAiText(qText);
              speakText(qText);
              setMessages(prev => {
                // Avoid duplicating initial question if already present
                if (prev.length > 0 && prev[prev.length - 1].text === qText) {
                  return prev;
                }
                return [...prev, { sender: 'ai', text: qText }];
              });
            }
          } else if (data.type === 'complete' || (data.role === 'system' && data.content && data.content.includes('Analyzing'))) {
            stopWebcamAndAudio();
            toastRef.current.success('Interview Completed', 'Analyzing your answers now...');
            navigateRef.current(ROUTES.USER.INTERVIEW_PROCESSING(id));
          }
        } catch (err) {
          console.error('Failed parsing WS frame:', err);
        }
      };

      socket.onclose = (e) => {
        if (!isComponentMounted) return;
        if (pingInterval) clearInterval(pingInterval);
        setWsStatus('disconnected');

        if (e.code !== 1000 && e.code !== 1008) {
          reconnectTimer = setTimeout(() => {
            if (isComponentMounted) setReconnectCounter(c => c + 1);
          }, 3000);
        }
      };
    }

    connect();

    return () => {
      isComponentMounted = false;
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        socket.close(1000, 'Component unmounted');
      }
    };
  }, [id, reconnectCounter]);

  function handleSendTextWithMsg(msgText) {
    if (!msgText.trim()) return;

    // Check if face was missing during this question answer submission
    if (faceMatchStatus === 'NO FACE DETECTED') {
      setMissingFaceQuestionsCount(prev => {
        const nextCount = prev + 1;
        if (nextCount >= 2) {
          setShowFacePromptModal(true);
        }
        return nextCount;
      });
    } else {
      setMissingFaceQuestionsCount(0);
      setShowFacePromptModal(false);
    }

    setMessages(prev => [...prev, { sender: 'user', text: msgText }]);
    setAiState('processing');

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'answer', text: msgText }));
    } else {
      toastRef.current.error('Connection Error', 'WebSocket is disconnected. Please wait a moment for connection.');
      setAiState('listening');
    }
  }

  // Check if Record button should be locked when AI is speaking with Speaker ON
  const isRecordLocked = speakerOn && aiState === 'speaking';

  return (
    <div className="anim-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 370px', gap: 24, height: 'calc(100vh - 100px)', overflow: 'hidden' }}>
      {/* Cyber Dot-Matrix & Ambient Vignette Background */}
      <TechBackground />

      {/* Left Column: AI Orb, Active Question, Scrollable Chat Transcript, Voice Record Button */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, background: 'var(--surface)', borderRadius: 'var(--radius-xl)', padding: 24, border: '1px solid var(--border)', position: 'relative', overflow: 'hidden', height: '100%' }}>

        {/* Top Controls: Speaker, Hands-Free Duplex & Proctoring Integrity HUD */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              AI Interviewer
            </span>
            {isBargeInActive && (
              <span
                style={{
                  background: 'rgba(245, 158, 11, 0.2)',
                  color: '#f59e0b',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                ⚡ Barge-In Active
              </span>
            )}
            {tabSwitchCount > 0 && (
              <span
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: 'var(--danger)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 11,
                  fontWeight: 700
                }}
              >
                ⚠️ {tabSwitchCount} Tab Switch{tabSwitchCount > 1 ? 'es' : ''}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* DSP Audio Noise Shield Badge */}
            <div
              style={{
                background: 'rgba(7, 152, 212, 0.12)',
                color: '#38bdf8',
                border: '1px solid rgba(7, 152, 212, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 5
              }}
              title="Real-Time Hardware DSP Acoustic Noise Shielding Active (Room echo & fan noise filtered)"
            >
              <span>🎙️</span> Noise Shield Active
            </div>

            {/* Live Proctoring Integrity HUD */}
            <div
              style={{
                background: integrityScore >= 80 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                color: integrityScore >= 80 ? '#10b981' : '#f59e0b',
                border: `1px solid ${integrityScore >= 80 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 5
              }}
              title="Continuous Anti-Cheating & Biometric Integrity Score"
            >
              🛡️ {integrityScore}% Integrity
            </div>

            {/* Closed Captions Toggle */}
            <button
              type="button"
              onClick={() => {
                soundEffects.playClick();
                setShowClosedCaptions(prev => !prev);
              }}
              title={showClosedCaptions ? "Hide Closed Captions" : "Show Closed Captions"}
              style={{
                background: showClosedCaptions ? 'rgba(7, 152, 212, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                color: showClosedCaptions ? 'var(--primary)' : 'var(--text-secondary)',
                border: showClosedCaptions ? '1px solid rgba(7, 152, 212, 0.3)' : '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 10px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5
              }}
            >
              <span>💬</span> CC {showClosedCaptions ? 'ON' : 'OFF'}
            </button>

            {/* Speaker ON/OFF Button */}
            <button
              type="button"
              onClick={toggleSpeaker}
              title={speakerOn ? "Mute AI Voice (Unlocks Record Button immediately)" : "Turn On AI Voice Output"}
              style={{
                background: speakerOn ? 'rgba(18, 163, 126, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: speakerOn ? 'var(--primary)' : '#ef4444',
                border: speakerOn ? '1px solid rgba(18, 163, 126, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 200ms ease'
              }}
            >
              {speakerOn ? '🔊 Speaker ON' : '🔇 Speaker OFF'}
            </button>
          </div>
        </div>

        {/* Active Question Hero Card with Compact Side AI Orb */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 18,
          padding: '16px 20px',
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(10px)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 25px rgba(0, 0, 0, 0.2)'
        }}>
          <div style={{ flexShrink: 0, width: 50, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'scale(0.48)' }}>
            <AIOrb state={aiState} text={aiState === 'speaking' ? 'Speaking' : aiState === 'listening' ? 'Listening' : 'Thinking'} />
          </div>

          <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5 }}>
            {!isInterviewStarted ? (
              'Please position your face clearly in the camera to begin your interview.'
            ) : aiState === 'processing' ? (
              <ThoughtLine
                working={true}
                steps={['Analyzing your response', 'Evaluating technical accuracy', 'Formulating follow-up question']}
                label="Thinking…"
                glyph="sparkle"
                fontSize={15}
                color="var(--primary)"
              />
            ) : (
              (aiText || 'Preparing your first question...')
            )}
          </div>
        </div>

        {/* Scrollable Conversation History (Everything Below Header is History) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border)', paddingTop: 16, minHeight: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Conversation History
          </span>

          <div ref={chatScrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 6 }}>
            {messages.map((m, idx) => (
              <div
                key={idx}
                style={{
                  alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '82%',
                  padding: '10px 16px',
                  borderRadius: m.sender === 'user' ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                  background: m.sender === 'user' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.04)',
                  color: m.sender === 'user' ? '#ffffff' : 'var(--text-primary)',
                  fontSize: 13,
                  lineHeight: 1.5,
                  border: m.sender === 'user' ? 'none' : '1px solid var(--border)'
                }}
              >
                {m.text}
              </div>
            ))}
          </div>
        </div>

        {/* ── Feature 1: Conversational Helper Actions Pill Bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Helper 1: 30s Think Time */}
            <button
              type="button"
              onClick={handleTakeThinkTime}
              style={{
                background: thinkTimeLeft > 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                color: thinkTimeLeft > 0 ? '#f59e0b' : 'var(--text-secondary)',
                border: thinkTimeLeft > 0 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '5px 10px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 150ms ease'
              }}
              title="Pause silence timer and take 30s to think without penalty"
            >
              <span>⏸️</span> {thinkTimeLeft > 0 ? `Thinking (${thinkTimeLeft}s)` : 'Think Time (30s)'}
            </button>

            {/* Helper 2: Rephrase Question */}
            <button
              type="button"
              onClick={handleRephraseQuestion}
              disabled={aiState === 'processing' || !isInterviewStarted}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '5px 10px',
                fontSize: 12,
                fontWeight: 600,
                cursor: (aiState === 'processing' || !isInterviewStarted) ? 'not-allowed' : 'pointer',
                opacity: (aiState === 'processing' || !isInterviewStarted) ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 150ms ease'
              }}
              title="Ask AI to rephrase the question in simpler or different words"
            >
              <span>🔄</span> Rephrase Question
            </button>

            {/* Helper 3: Repeat Question Audio */}
            <button
              type="button"
              onClick={handleRepeatQuestion}
              disabled={!aiText}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '5px 10px',
                fontSize: 12,
                fontWeight: 600,
                cursor: !aiText ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 150ms ease'
              }}
              title="Replay AI question audio"
            >
              <span>🗣️</span> Repeat Question
            </button>
          </div>

          {/* CC font toggle */}
          {showClosedCaptions && (
            <button
              type="button"
              onClick={() => {
                soundEffects.playClick();
                setLargeCaptions(prev => !prev);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: 11,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
              title="Toggle caption text size"
            >
              Font: {largeCaptions ? 'Large' : 'Normal'}
            </button>
          )}
        </div>

        {/* ── Feature 1: Real-time Closed Captions Overlay Bar ── */}
        {showClosedCaptions && (
          <div
            className="anim-fade-in"
            style={{
              padding: '10px 14px',
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(7, 152, 212, 0.25)',
              borderRadius: 'var(--radius-md)',
              backdropFilter: 'blur(8px)',
              fontSize: largeCaptions ? 15 : 13,
              lineHeight: 1.4,
              color: isRecordingVoice ? '#38bdf8' : 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>
              {isRecordingVoice ? 'You (Live):' : 'AI:'}
            </span>
            <span style={{ fontStyle: isRecordingVoice ? 'italic' : 'normal', flex: 1 }}>
              {isRecordingVoice
                ? (spokenTranscriptRef.current || 'Listening to your microphone...')
                : (aiText || 'Preparing your interview...')}
            </span>
          </div>
        )}

        {/* Answer Action Bar (Voice Push-to-Talk + Keyboard Text Fallback) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          {showTextInput ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && textAnswer.trim()) {
                      handleSendTextWithMsg(textAnswer.trim());
                      setTextAnswer('');
                    }
                  }}
                  placeholder="Type your response and press Enter or Submit..."
                  disabled={aiState === 'processing'}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    background: 'var(--input-bg, rgba(255, 255, 255, 0.05))',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    outline: 'none'
                  }}
                />
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    if (textAnswer.trim()) {
                      handleSendTextWithMsg(textAnswer.trim());
                      setTextAnswer('');
                    }
                  }}
                  disabled={!textAnswer.trim() || aiState === 'processing'}
                  style={{ padding: '0 20px', fontWeight: 700 }}
                >
                  Submit
                </Button>
              </div>
              <button
                type="button"
                onClick={() => setShowTextInput(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: 12,
                  cursor: 'pointer',
                  textAlign: 'center',
                  textDecoration: 'underline'
                }}
              >
                🎙️ Switch back to Voice Recording
              </button>
            </div>
          ) : (
            <>
              <div title={!isInterviewStarted ? "Position your face in the camera frame to start the interview" : isRecordLocked ? "Please wait until AI completes reading the question out loud" : ""}>
                <Button
                  type="button"
                  variant={isRecordingVoice ? "danger" : "primary"}
                  onClick={isRecordingVoice ? stopVoiceRecording : startVoiceRecording}
                  disabled={!isInterviewStarted || aiState === 'processing' || isRecordLocked || isTranscribing}
                  style={{
                    width: '100%',
                    padding: '14px 20px',
                    fontSize: 15,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    opacity: (!isInterviewStarted || isRecordLocked || isTranscribing) ? 0.6 : 1,
                    cursor: (!isInterviewStarted || isRecordLocked || isTranscribing) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isRecordingVoice ? `Stop & Submit Answer (${voiceSecs}s)` : isTranscribing ? 'Transcribing...' : !isInterviewStarted ? 'Awaiting Face Detection...' : 'Record Answer'}
                </Button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setShowTextInput(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: 12,
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  ⌨️ Mic having issues? Type answer instead
                </button>

                {isRecordLocked && (
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    ℹ Mute Speaker or wait for AI to finish speaking
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right Column: Camera feed, Organic Voice Waveform, alerts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}>
        <div className="common-card" style={{ overflow: 'hidden' }}>
          <div className="common-card__header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Continuous Identity Verification</h4>
          </div>

          <div className="common-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 20 }}>
            {/* Real-time Video Stream + Bounding Box Canvas Overlay */}
            <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', background: '#09090b', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
              {cameraError ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--error)', padding: 20, textAlign: 'center' }}>
                  <span style={{ fontSize: 12 }}>{cameraError}</span>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {/* Bounding Box Canvas Overlay */}
                  <canvas
                    ref={canvasRef}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                  />

                  {/* Video Overlay Alert: Only visual camera/face/person alerts inside frame */}
                  {cheatingAlert && !alertReason.toLowerCase().includes('voice') && (
                    <div style={{
                      position: 'absolute',
                      bottom: 10,
                      left: 10,
                      right: 10,
                      background: 'rgba(239, 68, 68, 0.92)',
                      backdropFilter: 'blur(8px)',
                      color: '#ffffff',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '7px 12px',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                      zIndex: 10
                    }}>
                      {alertReason || 'Continuous matching validation failed. Face the camera directly.'}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Organic Canvas Waveform Visualizer */}
            <VoiceWaveform active={true} audioLevels={audioSpectrum} style={{ height: 32 }} />

            {/* Voice Mismatch Error Banner (Below video feed) */}
            {voiceErrorMessage && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                fontSize: 12,
                color: '#ef4444',
                lineHeight: 1.4
              }}>
                <strong>Voice Mismatch Error:</strong> {voiceErrorMessage}
              </div>
            )}

            {/* Face Required Banner (Below video feed) */}
            {showFacePromptModal && (
              <div className="common-alert common-alert--warning" style={{
                margin: 0,
                background: 'rgba(234, 179, 8, 0.15)',
                border: '1px solid rgba(234, 179, 8, 0.4)',
                color: '#facc15',
                fontSize: 12,
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)'
              }}>
                <strong>Face Required:</strong> No face detected for {missingFaceQuestionsCount} questions. Position face in camera to continue.
              </div>
            )}

            {/* Real-time Identity Metrics */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Face Match Status:</span>
                <span style={{
                  color: faceMatchStatus === 'MATCHING' ? 'var(--success)' : faceMatchStatus === 'VERIFYING' ? 'var(--warning)' : 'var(--error)',
                  fontWeight: 700,
                  fontSize: 12
                }}>
                  {faceMatchStatus}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Voice Match Status:</span>
                <span style={{
                  color: voiceMatchStatus === 'MATCHING' ? 'var(--success)' : 'var(--error)',
                  fontWeight: 700,
                  fontSize: 12
                }}>
                  {voiceMatchStatus}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Gaze Deviations:</span>
                <span style={{ color: gazeCount >= 3 ? 'var(--error)' : 'var(--text-primary)', fontWeight: 700 }}>
                  {gazeCount} times
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
