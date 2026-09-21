import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../../core/api/client';
import { NeuralOrbitLoader } from '../../components/common/LoadingAnimations';
import ROUTES from '../../core/routes';
import '../../styles/pages/portal.css';

const STAGES = [
  { label: 'Synthesizing verbal responses & interview transcript...', minPct: 0, maxPct: 25 },
  { label: 'Evaluating technical depth & reasoning via LLM...', minPct: 25, maxPct: 55 },
  { label: 'Computing skill proficiency matrix & integrity vectors...', minPct: 55, maxPct: 85 },
  { label: 'Compiling cryptographic verification report...', minPct: 85, maxPct: 100 }
];

export default function InterviewProcessing() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const isScoredRef = useRef(false);

  useEffect(() => {
    // 1. Kick off backend scoring in the background
    async function triggerScoring() {
      try {
        await client.post(`/score/${id}`);
        isScoredRef.current = true;
      } catch (err) {
        console.error('Scoring calculation triggered or already completed:', err);
        isScoredRef.current = true;
      }
    }
    triggerScoring();

    // 2. Smooth, unhurried progress timer (~6.5s total experience)
    const startTime = Date.now();
    const TOTAL_DURATION = 6200; // 6.2 seconds for full animation cycle

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const rawPct = Math.min(100, Math.floor((elapsed / TOTAL_DURATION) * 100));

      // Natural ease-out pacing with a slight tensor calculation slowdown around 65-80%
      let smoothedPct;
      if (rawPct < 50) {
        smoothedPct = Math.floor(rawPct * 1.1);
      } else if (rawPct < 85) {
        smoothedPct = Math.floor(55 + (rawPct - 50) * 0.7);
      } else {
        smoothedPct = rawPct;
      }

      smoothedPct = Math.min(100, Math.max(0, smoothedPct));
      setProgress(smoothedPct);

      if (smoothedPct >= 100) {
        clearInterval(interval);
        setIsCompleted(true);
        // Brief 900ms pause at 100% so user registers full verification before redirect
        setTimeout(() => {
          navigate(ROUTES.USER.REPORT_DETAIL(id));
        }, 900);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [id, navigate]);

  // Determine active stage index
  const currentStageIdx = progress >= 100
    ? STAGES.length - 1
    : STAGES.findIndex(s => progress >= s.minPct && progress < s.maxPct);

  return (
    <div
      className="auth-container"
      style={{
        textAlign: 'center',
        minHeight: '88vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px'
      }}
    >
      <div
        className="auth-card anim-scale-in"
        style={{
          maxWidth: 520,
          width: '100%',
          padding: '38px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 22,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-2xl)',
          boxShadow: 'var(--shadow-xl)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Top ambient glow */}
        <div
          style={{
            position: 'absolute',
            top: -60,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 260,
            height: 120,
            background: 'radial-gradient(ellipse, rgba(7, 152, 212, 0.18) 0%, transparent 70%)',
            pointerEvents: 'none'
          }}
        />

        {/* Neural Orbit & AI Constellation Animation */}
        <div style={{ margin: '8px 0 4px', transform: 'scale(1.05)' }}>
          <NeuralOrbitLoader label="" />
        </div>

        {/* Header & Percentage */}
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--primary)',
                background: 'rgba(7, 152, 212, 0.1)',
                padding: '3px 10px',
                borderRadius: 20,
                border: '1px solid rgba(7, 152, 212, 0.25)'
              }}
            >
              Neural Scoring Engine
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
              {progress}%
            </span>
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em', margin: '0 0 6px' }}>
            {isCompleted ? '✓ Evaluation Complete' : 'Analyzing Assessment'}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            {isCompleted
              ? 'Cryptographic report generated successfully. Redirecting...'
              : 'SkillProof neural models are validating responses and calculating score matrix...'}
          </p>
        </div>

        {/* Glowing Progress Bar */}
        <div
          style={{
            width: '100%',
            height: 8,
            background: 'rgba(7, 152, 212, 0.12)',
            borderRadius: 8,
            overflow: 'hidden',
            border: '1px solid var(--border)',
            position: 'relative'
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #0798D4 0%, #38BDF8 50%, #818CF8 100%)',
              borderRadius: 8,
              transition: 'width 80ms ease-out',
              boxShadow: '0 0 12px rgba(7, 152, 212, 0.6)'
            }}
          />
        </div>

        {/* Dynamic Stage Checklist */}
        <div
          style={{
            width: '100%',
            background: 'var(--surface-hover)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            textAlign: 'left',
            border: '1px solid var(--border)'
          }}
        >
          {STAGES.map((stage, idx) => {
            const isDone = progress >= stage.maxPct || isCompleted;
            const isCurrent = !isDone && idx === currentStageIdx;
            return (
              <div
                key={stage.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontSize: 12.5,
                  fontWeight: isCurrent ? 700 : isDone ? 600 : 500,
                  color: isDone ? '#10B981' : isCurrent ? 'var(--primary)' : 'var(--text-secondary)',
                  opacity: idx > currentStageIdx && !isCompleted ? 0.45 : 1,
                  transition: 'all 250ms ease'
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: isDone ? 11 : 10,
                    fontWeight: 800,
                    background: isDone
                      ? 'rgba(16, 185, 129, 0.15)'
                      : isCurrent
                      ? 'rgba(7, 152, 212, 0.18)'
                      : 'transparent',
                    border: `1px solid ${isDone ? '#10B981' : isCurrent ? 'var(--primary)' : 'var(--border)'}`,
                    flexShrink: 0
                  }}
                >
                  {isDone ? '✓' : isCurrent ? '⚡' : idx + 1}
                </span>
                <span style={{ flex: 1, lineHeight: 1.35 }}>{stage.label}</span>
              </div>
            );
          })}
        </div>

        {/* Skip / Bypass Option for rapid testing */}
        <button
          type="button"
          onClick={() => navigate(ROUTES.USER.REPORT_DETAIL(id))}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: 11.5,
            cursor: 'pointer',
            padding: '4px 8px',
            textDecoration: 'underline',
            opacity: 0.7,
            transition: 'opacity 150ms ease'
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
        >
          Skip animation & view report →
        </button>
      </div>
    </div>
  );
}

