import '../../styles/common/primitives.css';

/**
 * VoiceWaveform — shows animated audio levels.
 *
 * @param {boolean} active - toggles animation state
 * @param {number} barCount - number of bars to render
 */
export default function VoiceWaveform({ active = false, barCount = 12, className = '' }) {
  const bars = Array.from({ length: barCount }, (_, i) => i);

  return (
    <div className={`voice-waveform${active ? ' voice-waveform--active' : ''} ${className}`} aria-hidden="true">
      {bars.map(i => {
        // Randomize base animation speed/delay slightly for organic look
        const delay = active ? `${(i * 0.1).toFixed(1)}s` : '0s';
        const heightPct = active ? undefined : `${20 + (i % 3) * 15}%`;

        return (
          <div
            key={i}
            className="voice-waveform__bar"
            style={{
              animationDelay: delay,
              height: heightPct
            }}
          />
        );
      })}
    </div>
  );
}
