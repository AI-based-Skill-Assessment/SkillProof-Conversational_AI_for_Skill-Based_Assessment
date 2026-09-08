import '../../styles/common/primitives.css';

/**
 * AIOrb — Realistic 3D animated floating/pulsing gradient orb
 * representing the conversational AI interviewer.
 *
 * @param {string} state - 'idle' | 'listening' | 'speaking' | 'processing'
 * @param {string} text - status text to display
 * @param {()=>void} onClick - click handler
 */
export default function AIOrb({ state = 'speaking', text = '', onClick, className = '' }) {
  const stateLabels = {
    idle: 'Idle',
    listening: 'Listening',
    speaking: 'Speaking',
    processing: 'Thinking...',
  };

  const orbText = text || stateLabels[state] || 'AI';

  return (
    <div className={`ai-orb-stage ${className}`} onClick={onClick}>
      {/* Outer 3D Orbit Ring 1 */}
      <div className={`ai-orb-ring ring-1 ring-${state}`} />
      
      {/* Outer 3D Orbit Ring 2 */}
      <div className={`ai-orb-ring ring-2 ring-${state}`} />

      {/* Orbiting micro particles */}
      <div className={`ai-orb-particle p-1 particle-${state}`} />
      <div className={`ai-orb-particle p-2 particle-${state}`} />
      <div className={`ai-orb-particle p-3 particle-${state}`} />

      {/* Main 3D Sphere Core */}
      <div className={`ai-orb-3d sphere-${state}`}>
        {/* Specular Glint Reflection */}
        <div className="ai-orb-glint" />
        
        {/* Inner Core Glow */}
        <div className="ai-orb-inner-glow" />

        {/* Center Label / Icon */}
        <div className="ai-orb-content">
          <span className="ai-orb-status-text">{orbText}</span>
        </div>
      </div>

      {/* Audio Wave Aura Pulse when speaking */}
      {state === 'speaking' && (
        <div className="ai-orb-wave-pulse" />
      )}
    </div>
  );
}
