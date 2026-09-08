import { useEffect, useRef } from 'react';
import '../../styles/common/primitives.css';

/**
 * VoiceWaveform — renders an organic gradient canvas oscilloscope sine wave matching VoiceRegistration.jsx.
 */
export default function VoiceWaveform({ active = true, audioLevels = [], style, className = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animId = null;
    let phase = 0;

    const ctx = canvas.getContext('2d');

    const render = () => {
      const w = (canvas.width = canvas.parentElement?.clientWidth || 320);
      const h = (canvas.height = canvas.parentElement?.clientHeight || 65);

      ctx.clearRect(0, 0, w, h);

      // Render clean vertical audio bars jumping with mic amplitude (NO top lines)
      const numBars = Math.max(16, audioLevels.length || 20);
      const padding = 4;
      const barW = (w - (numBars - 1) * padding) / numBars;

      phase += active ? 0.08 : 0.02;

      for (let i = 0; i < numBars; i++) {
        const lvl = audioLevels.length > 0 ? audioLevels[i % audioLevels.length] : 0.2;
        const waveOffset = Math.sin(i * 0.4 + phase) * 0.15;
        const normalizedVal = active ? Math.max(0.12, Math.min(1.0, (lvl || 0.15) * 2.4 + waveOffset)) : 0.1;

        const barH = normalizedVal * (h * 0.85);
        const x = i * (barW + padding);
        const y = (h - barH) / 2; // Center vertically for clean visual

        const grad = ctx.createLinearGradient(0, y, 0, y + barH);
        grad.addColorStop(0, '#12a37e');
        grad.addColorStop(0.6, '#6c63ff');
        grad.addColorStop(1, '#00d2ff');

        ctx.fillStyle = grad;

        // Draw rounded bar
        ctx.beginPath();
        const r = Math.min(barW / 2, 4);
        ctx.roundRect(x, y, barW, barH, r);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [active, audioLevels]);

  return (
    <div className={`voice-waveform ${className}`} style={{ width: '100%', height: 65, overflow: 'hidden', ...style }} aria-hidden="true">
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}
