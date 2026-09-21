import React from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../../core/theme';

/**
 * AmbientHudRings
 * Renders futuristic concentric HUD radar rings stacked one above another,
 * rotating in opposing clockwise and counter-clockwise directions.
 * Positioned in the bottom-right corner of pages as an ambient sci-fi visual.
 * Automatically hidden on test/exam and camera/audio active screens.
 * Exclusively active only on DARK THEME.
 */
export default function AmbientHudRings({
  size = 'clamp(220px, 26vw, 360px)',
  opacity = 'var(--hud-opacity, 0.75)',
  style = {}
}) {
  const location = useLocation();
  const { isDark } = useTheme();
  const path = location?.pathname || '';

  // Only render on Dark Theme
  if (!isDark) {
    return null;
  }

  // Suppress rings during live exams, camera/audio sessions, registrations, and auth (login/signup) pages
  const isExcludedScreen =
    (path.includes('/interview/') && !path.endsWith('/processing')) ||
    path.includes('/biometric') ||
    path.includes('/face-registration') ||
    path.includes('/voice-registration') ||
    path.includes('/signin') ||
    path.includes('/signup') ||
    path.includes('/login') ||
    path.includes('/forgot-password') ||
    path.includes('/verify-email') ||
    path.includes('/2fa') ||
    path.includes('/account-type') ||
    path.includes('/pending') ||
    path.includes('/google-onboard');

  if (isExcludedScreen) {
    return null;
  }

  return (
    <div
      className="ambient-hud-container"
      style={{
        position: 'fixed',
        bottom: 'clamp(20px, 3vh, 36px)',
        right: 'clamp(20px, 2.5vw, 36px)',
        width: size,
        height: size,
        pointerEvents: 'none',
        userSelect: 'none',
        zIndex: 25,
        overflow: 'visible',
        transition: 'opacity 300ms ease, filter 300ms ease',
        ...style
      }}
      aria-hidden="true"
    >
      {/* "Don't get distracted" Callout & Curving Arrow */}
      <div
        className="hud-distraction-callout"
        style={{
          position: 'absolute',
          top: '-180px',
          right: 'clamp(20px, 4vw, 55px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 35,
          pointerEvents: 'none',
          animation: 'hudNoticeFloat 3.5s ease-in-out infinite'
        }}
      >
        <span
          style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '14.5px',
            fontWeight: 800,
            letterSpacing: '0.03em',
            color: 'var(--primary)',
            background: 'var(--surface)',
            padding: '7px 18px',
            borderRadius: '24px',
            border: '2px solid var(--primary)',
            boxShadow: '0 6px 22px rgba(7, 152, 212, 0.32)',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span style={{ fontSize: '17px' }}>👀</span> Don't get distracted
        </span>

        {/* Long sweeping curved arrow travelling distance towards the spinning rings */}
        <svg
          width="90"
          height="135"
          viewBox="0 0 90 135"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            marginTop: '2px',
            filter: 'drop-shadow(0 3px 8px rgba(7, 152, 212, 0.5))'
          }}
        >
          {/* Sweeping S-Curve Trajectory */}
          <path
            d="M 32 4 C 75 22, 86 62, 58 92 C 42 110, 48 122, 56 128"
            stroke="var(--primary)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="6 3.5"
          />
          {/* Arrowhead */}
          <path
            d="M 42 118 L 56 129 L 65 116"
            stroke="var(--primary)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Ambient background glow behind rings */}
      <div
        className="ambient-hud-glow"
        style={{
          position: 'absolute',
          inset: '10%',
          borderRadius: '50%',
          pointerEvents: 'none',
          transition: 'background 300ms ease'
        }}
      />

      {/* Outer Ring 1: Clockwise Rotation */}
      <img
        src="/assets/hud/hud-ring-2.png"
        alt=""
        className="hud-layer hud-layer--cw-slow"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          willChange: 'transform'
        }}
      />

      {/* Middle Ring 2: Counter-Clockwise Rotation */}
      <img
        src="/assets/hud/hud-ring-3.png"
        alt=""
        className="hud-layer hud-layer--ccw"
        style={{
          position: 'absolute',
          inset: '6%',
          width: '88%',
          height: '88%',
          objectFit: 'contain',
          willChange: 'transform'
        }}
      />

      {/* Inner Core Ring 3: Clockwise Rotation */}
      <img
        src="/assets/hud/hud-ring-1.png"
        alt=""
        className="hud-layer hud-layer--cw-fast"
        style={{
          position: 'absolute',
          inset: '12%',
          width: '76%',
          height: '76%',
          objectFit: 'contain',
          willChange: 'transform'
        }}
      />

      <style>{`
        @keyframes hudSpinCW {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes hudSpinCCW {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }

        @keyframes hudNoticeFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }

        .hud-layer--cw-slow {
          animation: hudSpinCW 40s linear infinite;
        }

        .hud-layer--ccw {
          animation: hudSpinCCW 24s linear infinite;
        }

        .hud-layer--cw-fast {
          animation: hudSpinCW 16s linear infinite;
        }

        /* ── Light Theme: Completely Hidden (HUD Rings & Callout are Dark Theme exclusive) ── */
        [data-theme="light"] .ambient-hud-container,
        :root:not([data-theme="dark"]) .ambient-hud-container {
          display: none !important;
        }

        /* ── Dark Theme: Glowing Sci-Fi Hologram ── */
        [data-theme="dark"] .ambient-hud-container {
          display: block !important;
          opacity: 0.78 !important;
          filter: drop-shadow(0 0 28px rgba(7, 152, 212, 0.45)) saturate(1.1) !important;
          mix-blend-mode: screen;
        }

        [data-theme="dark"] .ambient-hud-glow {
          background: radial-gradient(circle, rgba(7, 152, 212, 0.28) 0%, rgba(99, 102, 241, 0.16) 45%, transparent 70%) !important;
        }

        @media (max-width: 768px) {
          .ambient-hud-container {
            bottom: 12px !important;
            right: 12px !important;
            opacity: 0.38 !important;
          }
        }
      `}</style>
    </div>
  );
}
