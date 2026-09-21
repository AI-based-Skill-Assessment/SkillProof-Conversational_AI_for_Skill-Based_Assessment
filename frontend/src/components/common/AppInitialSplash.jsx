import { useEffect, useState } from 'react';
import Logo from './Logo';
import { NeuralOrbitLoader } from './LoadingAnimations';

const INITIAL_LOAD_KEY = 'skillproof_app_initial_loaded';

export default function AppInitialSplash() {
  const [showSplash, setShowSplash] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [statusText, setStatusText] = useState('Initializing AI Neural Engine...');

  useEffect(() => {
    // Check if the app has already loaded in this browsing session
    const hasLoaded = sessionStorage.getItem(INITIAL_LOAD_KEY);

    if (!hasLoaded) {
      setShowSplash(true);

      // Status text progression during initial launch
      const t1 = setTimeout(() => {
        setStatusText('Loading Verification Ledger & Biometric Modules...');
      }, 800);

      const t2 = setTimeout(() => {
        setStatusText('System Ready • Launching Workspace...');
      }, 1600);

      // Begin fade out after 2.2s
      const t3 = setTimeout(() => {
        setIsFadingOut(true);
      }, 2200);

      // Fully unmount and save session flag after 2.6s
      const t4 = setTimeout(() => {
        sessionStorage.setItem(INITIAL_LOAD_KEY, 'true');
        setShowSplash(false);
      }, 2600);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
      };
    }
  }, []);

  if (!showSplash) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'var(--background)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        padding: 24,
        opacity: isFadingOut ? 0 : 1,
        transform: isFadingOut ? 'scale(1.02)' : 'scale(1)',
        transition: 'opacity 400ms ease, transform 400ms ease',
        pointerEvents: isFadingOut ? 'none' : 'auto'
      }}
    >
      {/* Ambient background glow */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '420px',
          height: '420px',
          background: 'radial-gradient(circle, rgba(7, 152, 212, 0.16) 0%, transparent 70%)',
          borderRadius: '50%',
          pointerEvents: 'none'
        }}
      />

      {/* Central Neural Orbit Animation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
          transform: 'scale(1.15)',
          margin: 0
        }}
      >
        <NeuralOrbitLoader label="" />
      </div>

      {/* Dynamic Status Text & Progress Shimmer */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          zIndex: 2,
          width: '100%',
          maxWidth: '380px',
          textAlign: 'center'
        }}
      >
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '0.02em',
            textAlign: 'center',
            minHeight: 22,
            lineHeight: 1.4
          }}
        >
          {statusText}
        </div>

        {/* Linear Ambient Progress Bar */}
        <div
          style={{
            width: 220,
            height: 3.5,
            background: 'var(--border)',
            borderRadius: 4,
            overflow: 'hidden',
            position: 'relative',
            margin: '0 auto'
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: '100%',
              background: 'linear-gradient(90deg, #0798D4, #818CF8)',
              borderRadius: 4,
              animation: 'splashBarFill 2.2s cubic-bezier(0.4, 0, 0.2, 1) forwards'
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes splashBarFill {
          0% { width: 0%; }
          40% { width: 45%; }
          75% { width: 85%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
}
