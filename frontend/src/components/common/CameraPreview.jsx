import { useEffect, useRef, useState } from 'react';
import '../../styles/common/primitives.css';

/**
 * CameraPreview — hooks up local webcam feed.
 * Shows active pulse overlay and animated scanline.
 */
export default function CameraPreview({ active = true, onStreamReady, className = '' }) {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!active) {
      stopCamera();
      return;
    }

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        onStreamReady?.(stream);
        setError(null);
      } catch (err) {
        console.error('Camera access failed:', err);
        setError('Could not access camera. Please check your permissions.');
      }
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [active, onStreamReady]);

  function stopCamera() {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }

  return (
    <div className={`biometric-scanner ${className}`}>
      {error ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100%', padding: '20px', color: 'var(--error)', textAlign: 'center', background: '#111'
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: 8 }}>
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{error}</span>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="biometric-scanner__preview"
          />
          <div className={`biometric-scanner__overlay${active ? ' biometric-scanner__overlay--active' : ''}`}>
            <div className="biometric-scanner__scanline" />
          </div>
        </>
      )}
    </div>
  );
}
