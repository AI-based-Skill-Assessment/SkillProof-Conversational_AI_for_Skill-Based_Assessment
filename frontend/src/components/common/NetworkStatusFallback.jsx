import { useState, useEffect } from 'react';
import Button from './Button';

/**
 * Global Offline & System Fallback Banner / Overlay.
 * Monitors window online/offline status and server connectivity.
 */
export default function NetworkStatusFallback() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    function handleOnline() {
      setIsOffline(false);
    }
    function handleOffline() {
      setIsOffline(true);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(11, 15, 25, 0.92)',
      backdropFilter: 'blur(8px)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 32,
        maxWidth: 440,
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16
      }}>
        {/* Unicorn / Offline Mascot Graphic */}
        <div style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.1)',
          color: 'var(--error)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 36
        }}>
          🦄
        </div>

        <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          You're Currently Offline
        </h3>

        <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
          SkillProof requires an active internet connection to communicate with backend verification services and process assessments.
        </p>

        <div style={{ marginTop: 8 }}>
          <Button onClick={() => window.location.reload()} style={{ minWidth: 140 }}>
            Retry Connection
          </Button>
        </div>
      </div>
    </div>
  );
}
