import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useTheme } from '../../core/theme';
import '../../styles/common/primitives.css';

/**
 * QRDisplay — renders a high-quality secure QR code linked to a verification URL.
 * Automatically adapts QR code colors and background to Light/Dark themes.
 */
export default function QRDisplay({ value, label, className = '', darkColor, lightColor }) {
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);
  const { isDark } = useTheme();

  useEffect(() => {
    if (!value || !canvasRef.current) return;

    const qrDark = darkColor || (isDark ? '#ffffff' : '#000000');
    const qrLight = lightColor || (isDark ? '#1e2840' : '#ffffff');

    QRCode.toCanvas(
      canvasRef.current,
      value,
      {
        width: 190,
        margin: 2,
        color: {
          dark: qrDark,
          light: qrLight
        }
      },
      (err) => {
        if (err) {
          console.error('Failed to generate QR Code:', err);
          setError('Failed to generate QR code.');
        } else {
          setError(null);
        }
      }
    );
  }, [value, isDark, darkColor, lightColor]);

  return (
    <div className={`qr-display-card ${className}`} style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-xl)',
      padding: '24px 20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      boxShadow: 'var(--shadow-md)'
    }}>
      {error ? (
        <div style={{ color: 'var(--error)', fontSize: 13, textAlign: 'center' }}>{error}</div>
      ) : (
        <div style={{
          background: 'var(--surface-elevated)',
          padding: 12,
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <canvas ref={canvasRef} style={{ borderRadius: 'var(--radius-md)', display: 'block' }} />
        </div>
      )}
      {label && (
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 14, letterSpacing: '0.02em' }}>
          {label}
        </span>
      )}
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        SECURE QR VERIFICATION
      </span>
    </div>
  );
}
