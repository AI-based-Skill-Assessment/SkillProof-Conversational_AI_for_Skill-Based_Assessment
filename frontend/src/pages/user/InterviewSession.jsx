import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../components/common/Toast';
import client from '../../core/api/client';
import VoiceWaveform from '../../components/common/VoiceWaveform';
import AIOrb from '../../components/common/AIOrb';
import Button from '../../components/common/Button';
import ThoughtLine from '../../components/common/ThoughtLine';
import Grainient from '../../components/common/Grainient';
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
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

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

      const voices = window.speechSynthesis.getVoices();
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

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (cleanupLockdown) cleanupLockdown();
    };
  }, [toast]);

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
    script.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
    script.async = true;
    script.onload = () => {
      loadFaceModels();
    };
    script.onerror = () => {
      console.warn('face-api.js script failed to load. Camera active without local detection.');
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
    const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights/';

    try {
      // Prioritize tinyFaceDetector for instant camera face detection
      await window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      setModelsLoaded(true);

      // Load landmarks and recognition descriptors in background asynchronously
      Promise.all([
        window.faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        window.faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]).catch(err => console.warn('Background model load warning:', err));
    } catch (err) {
      console.warn('Fast face model load warning:', err);
      setModelsLoaded(true);
    }
  }

  async function startWebcam() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: true
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
      console.error('Webcam / Audio access error:', err);
      setCameraError('Camera or Microphone access denied.');
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
        for (let i = 0; i < 15; i++) {
          const val = dataArray[i * step] || 0;
          levels.push(Math.max(0.1, val / 255));
        }
        setAudioSpectrum(levels);

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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000,
        });

        if (sttRes.data && sttRes.data.text) {
          transcribedText = sttRes.data.text.trim();
        }
      } catch (sttErr) {
        console.warn('Backend transcription failed, falling back to client-side:', sttErr);
      } finally {
        setIsTranscribing(false);
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

      // Voice biometric verification
      const res = await client.post('/biometric/verify', {
        session_id: id,
        voice_embedding: embedding
      });

      if (res.data && res.data.voice_match) {
        setVoiceMatchStatus('MATCHING');
        setVoiceMatchPct(Math.round((res.data.voice_confidence || 0.92) * 100));
        setVoiceErrorMessage('');

        handleSendTextWithMsg(transcribedText);
      } else {
        setVoiceMatchStatus('MISMATCH');
        setVoiceMatchPct(35);
        const errMsg = res.data?.message || 'Voice ID mismatch: Speaker voice pattern does not match registered candidate profile.';
        setVoiceErrorMessage(errMsg);
        toast.error('Voice ID Mismatch Detected', errMsg);
        setCheatingAlert(true);
        setAlertReason(errMsg);
      }
    } catch (err) {
      console.error('Voice answer verification failed:', err);
    }
  }

  // FFT Voice Extraction Helper
  async function extractVoiceEmbedding(chunks) {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    const arrayBuf = await blob.arrayBuffer();
    const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuf = await tempCtx.decodeAudioData(arrayBuf);
    await tempCtx.close();

    const channelData = audioBuf.getChannelData(0);
    const sampleRate = audioBuf.sampleRate;
    const rc = 1.0 / (2 * Math.PI * 150);
    const dt = 1.0 / sampleRate;
    const alpha = rc / (rc + dt);

    const filteredData = new Float32Array(channelData.length);
    filteredData[0] = channelData[0];
    for (let i = 1; i < channelData.length; i++) {
      filteredData[i] = alpha * (filteredData[i - 1] + channelData[i] - channelData[i - 1]);
    }

    // Filter silence / room noise floor before extracting formants
    let sumSquares = 0;
    for (let i = 0; i < filteredData.length; i++) {
      sumSquares += filteredData[i] * filteredData[i];
    }
    const rms = Math.sqrt(sumSquares / filteredData.length);
    if (rms < 0.003) {
      console.warn('⚠️ [VOICE EXTRACTION] Audio signal energy too low or silent.');
      return [];
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
      {/* Grainy Gradient Background */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1, opacity: 0.15 }}>
        <Grainient
          color1="#4CC9F0"
          color2="#7209B7"
          color3="#0D1B2A"
          grainAmount={0.06}
          grainScale={1.5}
          warpSpeed={0.5}
          zoom={1.5}
        />
      </div>

      {/* Left Column: AI Orb, Active Question, Scrollable Chat Transcript, Voice Record Button */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, background: 'var(--surface)', borderRadius: 'var(--radius-xl)', padding: 24, border: '1px solid var(--border)', position: 'relative', overflow: 'hidden', height: '100%' }}>

        {/* Top Controls: Speaker Toggle Button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            AI Interviewer
          </span>

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

        {/* Voice-Only Answer Action Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div title={!isInterviewStarted ? "Position your face in the camera frame to start the interview" : isRecordLocked ? "Please wait until AI completes reading the question out loud" : ""}>
            <Button
              type="button"
              variant={isRecordingVoice ? "danger" : "primary"}
              onClick={isRecordingVoice ? stopVoiceRecording : startVoiceRecording}
              disabled={!isInterviewStarted || aiState === 'processing' || isRecordLocked || isTranscribing || showFacePromptModal}
              style={{
                width: '100%',
                padding: '14px 20px',
                fontSize: 15,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: (!isInterviewStarted || isRecordLocked || isTranscribing || showFacePromptModal) ? 0.6 : 1,
                cursor: (!isInterviewStarted || isRecordLocked || isTranscribing || showFacePromptModal) ? 'not-allowed' : 'pointer'
              }}
            >
              {isRecordingVoice ? `Stop & Submit Answer (${voiceSecs}s)` : isTranscribing ? 'Transcribing...' : showFacePromptModal ? 'Please Show Your Face to Continue' : !isInterviewStarted ? 'Awaiting Face Detection...' : 'Record Answer'}
            </Button>
          </div>

          {isRecordLocked && (
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>
              ℹ Please wait until AI completes reading the question out loud (or turn Speaker OFF to answer immediately)
            </span>
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
