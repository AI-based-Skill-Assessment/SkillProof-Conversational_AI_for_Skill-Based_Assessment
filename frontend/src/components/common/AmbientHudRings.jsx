import React from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../../core/theme';
import ROUTES from '../../core/routes';

/**
 * AmbientHudRings
 * Renders subtle futuristic HUD radar rings exclusively on the public Landing Page.
 * Positioned in the bottom-right corner behind content with reduced, non-intrusive opacity.
 */
export default function AmbientHudRings({
  size = 'clamp(220px, 26vw, 360px)',
  style = {}
}) {
  const location = useLocation();
  const { isDark } = useTheme();
  const path = location?.pathname || '';

  // Only render on the main Landing Page ('/' or ROUTES.HOME) and dark theme
  const isLandingPage = path === '/' || path === ROUTES.HOME;

  if (!isLandingPage || !isDark) {
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
        zIndex: 0,
        overflow: 'visible',
        transition: 'opacity 300ms ease, filter 300ms ease',
        opacity: 0.28,
        ...style
      }}
      aria-hidden="true"
    >
      {/* Ambient background glow behind rings */}
      <div
        className="ambient-hud-glow"
        style={{
          position: 'absolute',
          inset: '10%',
          borderRadius: '50%',
          pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(7, 152, 212, 0.18) 0%, rgba(99, 102, 241, 0.08) 45%, transparent 70%)'
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

        .hud-layer--cw-slow {
          animation: hudSpinCW 40s linear infinite;
        }

        .hud-layer--ccw {
          animation: hudSpinCCW 24s linear infinite;
        }

        .hud-layer--cw-fast {
          animation: hudSpinCW 16s linear infinite;
        }

        [data-theme="dark"] .ambient-hud-container {
          display: block !important;
          mix-blend-mode: screen;
          filter: drop-shadow(0 0 16px rgba(7, 152, 212, 0.25));
        }

        @media (max-width: 768px) {
          .ambient-hud-container {
            bottom: 12px !important;
            right: 12px !important;
            opacity: 0.18 !important;
          }
        }
      `}</style>
    </div>
  );
}
