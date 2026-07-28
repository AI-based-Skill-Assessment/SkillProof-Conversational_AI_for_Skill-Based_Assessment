import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../components/common/Toast';
import CameraPreview from '../../components/common/CameraPreview';
import VoiceWaveform from '../../components/common/VoiceWaveform';
import AIOrb from '../../components/common/AIOrb';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import ROUTES from '../../core/routes';
import '../../styles/pages/portal.css';

export default function InterviewSession() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const socketRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [aiState, setAiState] = useState('speaking'); // speaking | listening | processing | idle
  const [aiText, setAiText] = useState('Hello! I am your SkillProof assessor. Are you ready to begin?');
  
  // Biometrics violation simulators
  const [gazeCount, setGazeCount] = useState(0);
  const [cheatingAlert, setCheatingAlert] = useState(false);

  // Connect to live WebSocket or fallback mock
  useEffect(() => {
    const wsUrl = `ws://${window.location.hostname}:8000/api/v1/interview/${id}/ws`;
    console.log(`Connecting to Interview WebSocket: ${wsUrl}`);
    
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log('Interview WS Connection opened.');
      // Send greeting initiation
      socket.send(JSON.stringify({ type: 'start' }));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WS Message received:', data);
        
        if (data.type === 'question' || data.type === 'response') {
          setAiState('speaking');
          setAiText(data.text);
          setMessages(prev => [...prev, { sender: 'ai', text: data.text }]);
        }
      } catch (err) {
        console.error('Failed parsing WS frame:', err);
      }
    };

    socket.onerror = (err) => {
      console.error('WS Error:', err);
      toast.warning('WebSocket Unreachable', 'Running interview in simulated mode.');
      setupSimulatedInterview();
    };

    socket.onclose = () => {
      console.log('WS Connection closed.');
    };

    return () => {
      socket.close();
    };
  }, [id, toast]);

  // Simulated flow fallback on error / demo runs
  function setupSimulatedInterview() {
    setMessages([
      { sender: 'ai', text: 'Hello Arjun! Let\'s verify your React and Node.js skills.' },
      { sender: 'ai', text: 'Can you describe how you managed PostgreSQL connections in your Node/Express backend?' }
    ]);
    setAiText('Can you describe how you managed PostgreSQL connections in your Node/Express backend?');
    setAiState('listening');
  }

  function handleSendText(e) {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const userMsg = inputText.trim();
    setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setInputText('');
    setAiState('processing');

    // Send via socket if alive
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'answer', text: userMsg }));
    } else {
      // Simulated AI response loops
      setTimeout(() => {
        setAiState('speaking');
        const replies = [
          'Excellent explanation. Now, how did you handle state synchronization across React components?',
          'That makes sense. Can you explain how you secured API routes using JWT?',
          'Great technical depth. That completes the evaluation portion. I am generating your report now!'
        ];
        const nextReply = replies[messages.filter(m => m.sender === 'user').length] || 'Assessment complete!';
        setAiText(nextReply);
        setMessages(prev => [...prev, { sender: 'ai', text: nextReply }]);
        setAiState('listening');
        
        if (nextReply.includes('completes')) {
          setTimeout(() => {
            navigate(ROUTES.USER.INTERVIEW_PROCESSING(id));
          }, 2000);
        }
      }, 1500);
    }
  }

  // Simulate gaze deviation detection (biometric check mock)
  function simulateGazeViolation() {
    setGazeCount(g => {
      const next = g + 1;
      if (next >= 3) {
        setCheatingAlert(true);
        toast.warning('Biometric Warning', 'Continuous eye/headpose mismatch detected. Please face the screen.');
      }
      return next;
    });
  }

  return (
    <div className="anim-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, height: 'calc(100vh - 120px)' }}>
      {/* Left: Chat, prompt, orb */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, background: 'var(--surface)', borderRadius: 'var(--radius-xl)', padding: 24, border: '1px solid var(--border)' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <AIOrb state={aiState} text={aiState === 'speaking' ? 'Speaking' : aiState === 'listening' ? 'Listening' : 'Thinking'} />
          
          <div style={{
            fontSize: 16,
            fontWeight: 500,
            textAlign: 'center',
            color: 'var(--text-primary)',
            maxWidth: 520,
            lineHeight: 1.5,
            marginTop: 24,
            padding: 16,
            background: 'var(--surface-hover)',
            borderRadius: 'var(--radius-md)'
          }}>
            {aiText}
          </div>
        </div>

        {/* Input area */}
        <form onSubmit={handleSendText} style={{ display: 'flex', gap: 12 }}>
          <Input
            id="chat-input"
            placeholder="Type your response here or speak..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <Button type="submit" disabled={aiState === 'processing'}>
            Send
          </Button>
        </form>
      </div>

      {/* Right: Camera biometrics preview, alerts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="common-card">
          <div className="common-card__header">
            <h4 style={{ fontSize: 14, fontWeight: 700 }}>Continuous Identity Verification</h4>
          </div>
          <div className="common-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <CameraPreview active={true} style={{ maxWidth: '100%' }} />
            <VoiceWaveform active={aiState === 'listening'} barCount={15} style={{ height: 32 }} />
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Face Match status:</span>
                <span style={{ color: 'var(--success)', fontWeight: 600 }}>MATCHING (98%)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Voice Match:</span>
                <span style={{ color: 'var(--success)', fontWeight: 600 }}>MATCHING (94%)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Gaze Deviations:</span>
                <span style={{ color: gazeCount >= 3 ? 'var(--error)' : 'var(--text-secondary)', fontWeight: 600 }}>
                  {gazeCount} times
                </span>
              </div>
            </div>

            <Button size="sm" variant="ghost" onClick={simulateGazeViolation} style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
              (Debug: Simulate Gaze Deviation)
            </Button>
          </div>
        </div>

        {cheatingAlert && (
          <div className="common-alert common-alert--warning">
            <strong>Cheating Warning:</strong> Offscreen head rotation patterns flagged. Please maintain eye contact.
          </div>
        )}
      </div>
    </div>
  );
}
