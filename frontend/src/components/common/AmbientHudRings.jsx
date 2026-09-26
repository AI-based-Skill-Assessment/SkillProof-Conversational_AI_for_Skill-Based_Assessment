import React from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../../core/theme';
import ROUTES from '../../core/routes';

/**
 * AmbientHudRings
 * Renders futuristic HUD radar rings positioned in the bottom-right corner,
 * covering approximately 1/3 of the page with half or less extending beyond the viewport.
 * 
 * Excluded pages:
 * - Login & Sign In pages (/signin, /login, /forgot-password, /2fa)
 * - Sign Up & Onboarding pages (/signup, /account-type, /face-registration, /voice-registration, /pending, /google-onboard)
 * - Live Assessment & Interview pages (/assessment, /interview, /biometric-check)
 * 
 * Included on all other pages (Dashboards, Reports, Lists, Profile, Settings, Landing pages, etc.)
 */
export default function AmbientHudRings({
  size = 'clamp(850px, 75vw, 1350px)',
  style = {}
}) {
  const location = useLocation();
  const { isDark } = useTheme();
  const path = (location?.pathname || '').toLowerCase();

  // ── Route Filtering Logic ──────────────────────────────────────────────────
  const isExcluded = () => {
    // 1. Auth pages (Sign In, Sign Up, Login, Forgot Password, 2FA)
    if (
      path.includes('/signin') ||
      path.includes('/login') ||
      path.includes('/forgot-password') ||
      path.includes('/signup') ||
      path.includes('/2fa')
    ) {
      return true;
    }

    // 2. Active Live Interview Room with Mic & Video (/user/interview/:id)
    // Matches live room like /user/interview/uuid, but NOT /check or /processing
    const isLiveInterviewSession = /^\/user\/interview\/[^/]+$/.test(path);
    if (isLiveInterviewSession) {
      return true;
    }

    // 3. Live Biometric Video & Mic Camera Check
    if (path.includes('/user/biometric-check') || path.includes('/user/face-registration') || path.includes('/user/voice-registration')) {
      return true;
    }

    return false;
  };

  if (isExcluded()) {
    return null;
  }

  return (
    <>
      {/* ── 1. CONCEPT 2: TOP-LEFT ORBITAL COMPASS ───────────────────────────── */}
      <div
        className="ambient-orbital-compass"
        style={{
          position: 'fixed',
          top: 'clamp(-240px, -18vw, -130px)',
          left: 'clamp(-240px, -18vw, -130px)',
          width: 'clamp(480px, 42vw, 700px)',
          height: 'clamp(480px, 42vw, 700px)',
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 0,
          overflow: 'visible',
          transition: 'opacity 350ms ease',
          opacity: isDark ? 0.16 : 0.08,
          mixBlendMode: 'screen',
          filter: 'drop-shadow(0 0 14px rgba(7, 152, 212, 0.2))'
        }}
        aria-hidden="true"
      >
        {/* Soft center ambient glow */}
        <div
          style={{
            position: 'absolute',
            inset: '12%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(7, 152, 212, 0.16) 0%, rgba(99, 102, 241, 0.08) 50%, transparent 72%)'
          }}
        />

        {/* Outer Ring Clockwise */}
        <img
          src="/assets/hud/hud-ring-1.png"
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

        {/* Inner Ring Counter-Clockwise */}
        <img
          src="/assets/hud/hud-ring-3.png"
          alt=""
          className="hud-layer hud-layer--ccw"
          style={{
            position: 'absolute',
            inset: '14%',
            width: '72%',
            height: '72%',
            objectFit: 'contain',
            willChange: 'transform'
          }}
        />
      </div>

      {/* ── 2. CONCEPT 3: BOTTOM-LEFT CYBER VECTOR WAVE GRID ─────────────────── */}
      <div
        className="ambient-cyber-wave-grid"
        style={{
          position: 'fixed',
          bottom: 'clamp(-40px, -3vw, 0px)',
          left: 'clamp(-40px, -3vw, 0px)',
          width: 'clamp(420px, 35vw, 620px)',
          height: 'clamp(260px, 22vw, 380px)',
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 0,
          overflow: 'visible',
          transition: 'opacity 350ms ease',
          opacity: isDark ? 0.20 : 0.10,
          mixBlendMode: 'screen'
        }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 500 350" fill="none" style={{ width: '100%', height: '100%' }}>
          {[...Array(8)].map((_, i) => (
            <path
              key={i}
              d={`M 0 ${130 + i * 22} Q 130 ${90 + (i % 3) * 30}, 270 ${140 + (i % 2) * 18} T 500 ${110 + i * 20}`}
              stroke={i % 2 === 0 ? '#0798d4' : '#38bdf8'}
              strokeWidth={i === 3 ? 1.8 : 1.1}
              strokeOpacity={0.35 + (i * 0.07)}
              fill="none"
              style={{
                animation: `waveUndulate 8s ease-in-out infinite alternate`,
                animationDelay: `${i * 0.35}s`
              }}
            />
          ))}
        </svg>
      </div>

      {/* ── 3. BOTTOM-RIGHT HUD RINGS ────────────────────────────────────────── */}
      <div
        className="ambient-hud-container"
        style={{
          position: 'fixed',
          bottom: 'clamp(-420px, -36vw, -240px)',
          right: 'clamp(-420px, -36vw, -240px)',
          width: size,
          height: size,
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 0,
          overflow: 'visible',
          transition: 'opacity 350ms ease, filter 350ms ease',
          opacity: isDark ? 0.20 : 0.10,
          ...style
        }}
        aria-hidden="true"
      >
        {/* Ambient background glow behind rings */}
        <div
          className="ambient-hud-glow"
          style={{
            position: 'absolute',
            inset: '8%',
            borderRadius: '50%',
            pointerEvents: 'none',
            background: 'radial-gradient(circle, rgba(7, 152, 212, 0.15) 0%, rgba(99, 102, 241, 0.08) 48%, transparent 72%)'
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
      </div>

      <style>{`
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
          100% { transform: translateY(-15px) scaleY(1.08); }
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

        .ambient-hud-container {
          display: block !important;
          mix-blend-mode: screen;
          filter: drop-shadow(0 0 18px rgba(7, 152, 212, 0.22));
        }

        @media (max-width: 768px) {
          .ambient-orbital-compass {
            display: none !important;
          }
          .ambient-cyber-wave-grid {
            opacity: 0.12 !important;
            width: 300px !important;
          }
          .ambient-hud-container {
            bottom: -260px !important;
            right: -260px !important;
            width: 580px !important;
            height: 580px !important;
            opacity: 0.14 !important;
          }
        }
      `}</style>
    </>
  );
}
