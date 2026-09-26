import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../core/theme';
import ThemeToggle from '../../components/common/ThemeToggle';
import AmbientHudRings from '../../components/common/AmbientHudRings';
import soundEffects from '../../core/audio/soundEffects';
import Button from '../../components/common/Button';
import ROUTES from '../../core/routes';

export default function AmbientEffectsDemoPage() {
  const { isDark } = useTheme();
  const [activeEffect, setActiveEffect] = useState('telemetry-spine');
  const [opacity, setOpacity] = useState(25);
  const [colorScheme, setColorScheme] = useState('cyan'); // cyan | indigo | emerald | amber | violet
  const [showRightHud, setShowRightHud] = useState(true);
  const [speed, setSpeed] = useState('normal'); // slow | normal | fast

  // Color map
  const colors = {
    cyan: { primary: '#0798d4', secondary: '#38bdf8', glow: 'rgba(7, 152, 212, ' },
    indigo: { primary: '#6366f1', secondary: '#818cf8', glow: 'rgba(99, 102, 241, ' },
    emerald: { primary: '#10b981', secondary: '#34d399', glow: 'rgba(16, 185, 129, ' },
    amber: { primary: '#f59e0b', secondary: '#fbbf24', glow: 'rgba(245, 158, 11, ' },
    violet: { primary: '#8b5cf6', secondary: '#a78bfa', glow: 'rgba(139, 92, 246, ' },
  };

  const curColor = colors[colorScheme] || colors.cyan;
  const alpha = opacity / 100;

  const durationMap = {
    slow: '45s',
    normal: '25s',
    fast: '12s'
  };

  const EFFECTS = [
    {
      id: 'telemetry-spine',
      title: '1. Holographic Telemetry Spine',
      tag: 'Recommended for Dashboards',
      desc: 'Sleek vertical telemetry rail with micro-coordinate ticks, scanning pulse, and cyber circuit nodes running along the left margin.',
      icon: '🌌'
    },
    {
      id: 'orbital-compass',
      title: '2. Top-Left Orbital Compass',
      tag: 'Diagonal Symmetry',
      desc: 'Elegant concentric counter-rotating ring node positioned in the top-left corner to balance the bottom-right HUD rings.',
      icon: '🪐'
    },
    {
      id: 'cyber-vector-grid',
      title: '3. Cyber Vector Wave Grid',
      tag: 'Voice & Waveform Match',
      desc: 'Subtle 3D undulating vector wave mesh in the bottom-left corner that breathes like acoustic AI soundwaves.',
      icon: '🌊'
    },
    {
      id: 'aurora-nebula',
      title: '4. Morphing Aurora Nebula Glow',
      tag: 'Glassmorphism Aesthetic',
      desc: 'Soft, luminous morphing gradient orb that adds warmth, depth, and luxury lighting behind left-hand cards.',
      icon: '🔮'
    },
    {
      id: 'crypto-waterfall',
      title: '5. Cryptographic Glyph Waterfall',
      tag: 'Security & Verification',
      desc: 'Ultra-dim vertical stream of cryptographic proof hashes and verification tokens in monospace typography.',
      icon: '🔐'
    },
    {
      id: 'dual-hybrid',
      title: '6. Dual Hybrid (Spine + Compass)',
      tag: 'Full Cyber Synergy',
      desc: 'Combines the top-left orbital compass with the left-edge telemetry rail for maximum futuristic atmosphere.',
      icon: '⚡'
    }
  ];

  return (
    <div
      className="ambient-demo-page"
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        position: 'relative',
        overflow: 'hidden',
        paddingBottom: 60
      }}
    >
      {/* ── LIVE LEFT AMBIENT EFFECT RENDERING ────────────────────────────────── */}

      {/* Effect 1: Telemetry Spine (or part of Hybrid) */}
      {(activeEffect === 'telemetry-spine' || activeEffect === 'dual-hybrid') && (
        <div
          className="telemetry-spine-layer"
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            width: 72,
            pointerEvents: 'none',
            zIndex: 0,
            opacity: alpha,
            transition: 'opacity 300ms ease',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '24px 0',
            userSelect: 'none'
          }}
        >
          {/* Main vertical glowing trace line */}
          <div
            style={{
              position: 'absolute',
              left: 28,
              top: '5%',
              bottom: '5%',
              width: 1.5,
              background: `linear-gradient(to bottom, transparent, ${curColor.primary} 15%, ${curColor.secondary} 85%, transparent)`,
              boxShadow: `0 0 12px ${curColor.glow}0.6)`
            }}
          />

          {/* Traveling energy pulse */}
          <div
            className="spine-pulse"
            style={{
              position: 'absolute',
              left: 26,
              width: 5,
              height: 48,
              borderRadius: 4,
              background: `linear-gradient(to bottom, transparent, #ffffff 50%, transparent)`,
              boxShadow: `0 0 16px ${curColor.primary}`,
              animation: `spineTravel ${speed === 'slow' ? '8s' : speed === 'fast' ? '2.5s' : '4.5s'} ease-in-out infinite`
            }}
          />

          {/* Micro Telemetry Ticks & Coordinates */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 36, paddingLeft: 8, marginTop: 40 }}>
            {['01 // SYS_READY', '02 // PROCTOR_NET', '03 // BIOMETRIC_L2', '04 // W3C_VC', '05 // DSP_AUDIO', '06 // INTEGRITY_SCAN'].map((txt, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 1.5, background: curColor.secondary }} />
                <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: curColor.secondary, letterSpacing: '0.05em' }}>
                  {txt}
                </span>
              </div>
            ))}
          </div>

          <div style={{ paddingLeft: 12, marginBottom: 20 }}>
            <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
              SKILLPROOF // v2.4
            </span>
          </div>
        </div>
      )}

      {/* Effect 2: Top-Left Orbital Compass (or part of Hybrid) */}
      {(activeEffect === 'orbital-compass' || activeEffect === 'dual-hybrid') && (
        <div
          className="orbital-compass-layer"
          style={{
            position: 'fixed',
            top: -140,
            left: -140,
            width: 480,
            height: 480,
            pointerEvents: 'none',
            zIndex: 0,
            opacity: alpha,
            transition: 'opacity 300ms ease',
            userSelect: 'none'
          }}
        >
          {/* Radial center glow */}
          <div
            style={{
              position: 'absolute',
              inset: '15%',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${curColor.glow}0.3) 0%, ${curColor.glow}0.08) 55%, transparent 75%)`
            }}
          />
          {/* Outer Ring */}
          <img
            src="/assets/hud/hud-ring-1.png"
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              animation: `hudSpinCW ${durationMap[speed]} linear infinite`,
              filter: `drop-shadow(0 0 14px ${curColor.glow}0.4))`
            }}
          />
          {/* Inner Counter Ring */}
          <img
            src="/assets/hud/hud-ring-3.png"
            alt=""
            style={{
              position: 'absolute',
              inset: '12%',
              width: '76%',
              height: '76%',
              objectFit: 'contain',
              animation: `hudSpinCCW ${speed === 'slow' ? '30s' : speed === 'fast' ? '9s' : '18s'} linear infinite`,
              filter: `drop-shadow(0 0 10px ${curColor.glow}0.3))`
            }}
          />
        </div>
      )}

      {/* Effect 3: Cyber Vector Wave Grid */}
      {activeEffect === 'cyber-vector-grid' && (
        <div
          className="cyber-vector-layer"
          style={{
            position: 'fixed',
            bottom: -50,
            left: -50,
            width: 580,
            height: 420,
            pointerEvents: 'none',
            zIndex: 0,
            opacity: alpha,
            transition: 'opacity 300ms ease',
            userSelect: 'none'
          }}
        >
          <svg viewBox="0 0 500 350" fill="none" style={{ width: '100%', height: '100%' }}>
            {[...Array(9)].map((_, i) => (
              <path
                key={i}
                d={`M 0 ${120 + i * 24} Q 120 ${80 + (i % 3) * 35}, 260 ${130 + (i % 2) * 20} T 500 ${100 + i * 22}`}
                stroke={curColor.primary}
                strokeWidth={i === 4 ? 2 : 1.2}
                strokeOpacity={0.4 + (i * 0.06)}
                fill="none"
                style={{
                  animation: `waveUndulate ${speed === 'slow' ? '12s' : speed === 'fast' ? '4s' : '7s'} ease-in-out infinite alternate`,
                  animationDelay: `${i * 0.3}s`
                }}
              />
            ))}
          </svg>
        </div>
      )}

      {/* Effect 4: Morphing Aurora Nebula Glow */}
      {activeEffect === 'aurora-nebula' && (
        <div
          className="aurora-nebula-layer"
          style={{
            position: 'fixed',
            top: '25%',
            left: -180,
            width: 560,
            height: 560,
            borderRadius: '50%',
            pointerEvents: 'none',
            zIndex: 0,
            opacity: alpha * 1.4,
            filter: 'blur(75px)',
            background: `radial-gradient(circle, ${curColor.primary} 0%, ${curColor.secondary} 40%, transparent 70%)`,
            animation: `nebulaMorph ${speed === 'slow' ? '16s' : speed === 'fast' ? '5s' : '9s'} ease-in-out infinite alternate`,
            userSelect: 'none'
          }}
        />
      )}

      {/* Effect 5: Cryptographic Glyph Waterfall */}
      {activeEffect === 'crypto-waterfall' && (
        <div
          className="crypto-waterfall-layer"
          style={{
            position: 'fixed',
            left: 14,
            top: 60,
            bottom: 60,
            width: 140,
            pointerEvents: 'none',
            zIndex: 0,
            opacity: alpha * 1.1,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            fontFamily: 'monospace',
            fontSize: 10,
            fontWeight: 600,
            color: curColor.secondary,
            lineHeight: 1.6,
            userSelect: 'none',
            overflow: 'hidden'
          }}
        >
          {[
            '0x7F9A..B4E1',
            'SHA256:VERIFIED',
            'W3C_VC//PASS',
            'INTEGRITY:99.8%',
            'BIOMETRIC:LOCK',
            'ED25519:SIG_OK',
            'NODE_AUTH:MATCH',
            'LATENCY:38MS',
            '0x992C..F012',
            'PROOF_GEN:ACTIVE',
            'MCA21:RESOLVED',
            'VC_HASH:0x41AD',
            'VOICE_DSP:FILTER',
            '0x10BE..3389'
          ].map((item, i) => (
            <div
              key={i}
              style={{
                animation: `glyphScroll ${speed === 'slow' ? '15s' : speed === 'fast' ? '4s' : '8s'} linear infinite`,
                animationDelay: `${i * 0.5}s`
              }}
            >
              ▶ {item}
            </div>
          ))}
        </div>
      )}

      {/* Bottom Right HUD Rings (Standard) */}
      {showRightHud && <AmbientHudRings />}

      {/* ── TOP HEADER & NAVIGATION BAR ───────────────────────────────────────── */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 28px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          backdropFilter: 'blur(10px)',
          position: 'sticky',
          top: 0,
          zIndex: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to={ROUTES.USER.DASHBOARD} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🌌</span>
            <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>SkillProof Visual Lab</span>
          </Link>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 6,
              background: 'rgba(7, 152, 212, 0.12)',
              color: 'var(--primary)',
              border: '1px solid rgba(7, 152, 212, 0.25)'
            }}
          >
            LEFT-SIDE AMBIENT PREVIEW
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ThemeToggle />
          <Button variant="secondary" onClick={() => soundEffects.playClick()} style={{ padding: '6px 14px', fontSize: 13 }}>
            <Link to={ROUTES.USER.DASHBOARD} style={{ textDecoration: 'none', color: 'inherit' }}>
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </header>

      {/* ── MAIN CONTENT & INTERACTIVE SHOWCASE ────────────────────────────────── */}
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 28, position: 'relative', zIndex: 1 }}>

        {/* Hero title */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>
            Left-Side Ambient Visual Concepts
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--text-secondary)', maxWidth: 680 }}>
            Test each proposed left-side ambient animation live. Adjust the opacity, color palette, and animation speed in real time to find the perfect visual balance.
          </p>
        </div>

        {/* ── CONTROLS TOOLBAR ── */}
        <div
          className="common-card"
          style={{
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 16
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
            {/* Opacity Slider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
                Brightness / Opacity:
              </span>
              <input
                type="range"
                min="5"
                max="80"
                value={opacity}
                onChange={e => setOpacity(Number(e.target.value))}
                style={{ width: 140, cursor: 'pointer' }}
              />
              <span style={{ fontSize: 13, fontWeight: 700, minWidth: 36, color: curColor.primary }}>
                {opacity}%
              </span>
            </div>

            {/* Color Palette Picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Color Scheme:</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { id: 'cyan', bg: '#0798d4', name: 'Cyber Cyan' },
                  { id: 'indigo', bg: '#6366f1', name: 'Electric Indigo' },
                  { id: 'emerald', bg: '#10b981', name: 'Matrix Emerald' },
                  { id: 'violet', bg: '#8b5cf6', name: 'Quantum Violet' },
                  { id: 'amber', bg: '#f59e0b', name: 'Solar Amber' }
                ].map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      soundEffects.playClick();
                      setColorScheme(c.id);
                    }}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: c.bg,
                      border: colorScheme === c.id ? '2px solid #ffffff' : '2px solid transparent',
                      boxShadow: colorScheme === c.id ? `0 0 10px ${c.bg}` : 'none',
                      cursor: 'pointer',
                      transition: 'transform 150ms ease'
                    }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            {/* Right HUD Rings Toggle */}
            <button
              type="button"
              onClick={() => {
                soundEffects.playClick();
                setShowRightHud(prev => !prev);
              }}
              style={{
                background: showRightHud ? 'rgba(7, 152, 212, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                color: showRightHud ? 'var(--primary)' : 'var(--text-secondary)',
                border: showRightHud ? '1px solid rgba(7, 152, 212, 0.3)' : '1px solid var(--border)',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Bottom-Right Rings: {showRightHud ? 'VISIBLE (ON)' : 'HIDDEN (OFF)'}
            </button>
          </div>
        </div>

        {/* ── EFFECT SELECTION CARDS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {EFFECTS.map(effect => {
            const isSelected = activeEffect === effect.id;
            return (
              <div
                key={effect.id}
                onClick={() => {
                  soundEffects.playClick();
                  setActiveEffect(effect.id);
                }}
                className="common-card"
                style={{
                  padding: 20,
                  cursor: 'pointer',
                  borderRadius: 14,
                  transition: 'all 200ms ease',
                  background: isSelected ? 'var(--surface-hover)' : 'var(--surface)',
                  border: isSelected ? `2px solid ${curColor.primary}` : '1px solid var(--border)',
                  boxShadow: isSelected ? `0 0 20px ${curColor.glow}0.2)` : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 22 }}>{effect.icon}</span>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: isSelected ? curColor.primary : 'var(--text-primary)' }}>
                      {effect.title}
                    </h3>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: isSelected ? `${curColor.glow}0.15)` : 'rgba(255, 255, 255, 0.05)',
                      color: isSelected ? curColor.primary : 'var(--text-secondary)',
                      border: isSelected ? `1px solid ${curColor.glow}0.3)` : '1px solid var(--border)'
                    }}
                  >
                    {effect.tag}
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {effect.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* ── LIVE CONTENT PREVIEW BENCHMARK ── */}
        <div
          className="common-card"
          style={{
            padding: 28,
            borderRadius: 16,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 20
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              Live Sample Page Content Preview
            </h3>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Active Effect: <strong style={{ color: curColor.primary }}>{activeEffect.toUpperCase()}</strong>
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <div style={{ padding: 16, background: 'var(--surface-hover)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Technical Fluency</span>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>94% • Advanced</div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Demonstrated master-level system design depth</p>
            </div>

            <div style={{ padding: 16, background: 'var(--surface-hover)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Proctoring Integrity</span>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981', marginTop: 4 }}>100% Clean</div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Zero secondary voices or tab switches detected</p>
            </div>

            <div style={{ padding: 16, background: 'var(--surface-hover)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Verifiable Credential</span>
              <div style={{ fontSize: 24, fontWeight: 800, color: curColor.primary, marginTop: 4 }}>W3C Signed</div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Cryptographic HMAC-SHA256 digital proof</p>
            </div>
          </div>
        </div>

      </div>

      {/* ── CSS KEYFRAME ANIMATIONS ── */}
      <style>{`
        @keyframes spineTravel {
          0% { top: 10%; opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { top: 85%; opacity: 0; }
        }

        @keyframes hudSpinCW {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes hudSpinCCW {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }

        @keyframes waveUndulate {
          0% { transform: translateY(0) scaleY(1); }
          100% { transform: translateY(-16px) scaleY(1.08); }
        }

        @keyframes nebulaMorph {
          0% { transform: scale(1) translate(0, 0); }
          50% { transform: scale(1.15) translate(20px, -20px); }
          100% { transform: scale(0.95) translate(-10px, 15px); }
        }

        @keyframes glyphScroll {
          0% { transform: translateY(0); opacity: 0.2; }
          50% { opacity: 1; }
          100% { transform: translateY(-30px); opacity: 0.1; }
        }
      `}</style>
    </div>
  );
}
