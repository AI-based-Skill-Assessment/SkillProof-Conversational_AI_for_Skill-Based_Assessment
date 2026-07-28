import '../../styles/common/primitives.css';

/**
 * AIOrb — animated floating/pulsing gradient orb representing the conversational AI interviewer.
 *
 * @param {string} state - 'idle' | 'listening' | 'speaking' | 'processing'
 * @param {string} text - text to display inside or below the orb
 * @param {()=>void} onClick - click handler
 */
export default function AIOrb({ state = 'idle', text = 'AI', onClick, className = '' }) {
  // Map state to a label or indicator inside the orb
  const stateLabels = {
    idle: 'Idle',
    listening: 'Listening',
    speaking: 'Speaking',
    processing: 'Thinking',
  };

  const orbText = text || stateLabels[state] || 'AI';

  return (
    <div className={`ai-orb-container ${className}`}>
      <button
        type="button"
        className="ai-orb"
        onClick={onClick}
        aria-label={`AI Interviewer is ${state}`}
        style={{
          // Apply custom styles based on state
          animationDuration: state === 'listening' ? '2s' : state === 'speaking' ? '3s' : '4s',
          filter: state === 'processing' ? 'saturate(0.5) blur(1px)' : 'none',
        }}
      >
        <span style={{ animation: state === 'listening' ? 'pulse 1s infinite' : 'none' }}>
          {orbText}
        </span>
      </button>
      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {stateLabels[state] || state}
      </span>
    </div>
  );
}
