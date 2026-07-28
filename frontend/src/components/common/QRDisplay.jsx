import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import '../../styles/common/primitives.css';

/**
 * QRDisplay — renders a high-quality secure QR code linked to a verification URL.
 *
 * @param {string} value - url or code to encode in the QR
 * @param {string} label - optional title/subtitle under the QR code
 */
export default function QRDisplay({ value, label, className = '' }) {
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!value || !canvasRef.current) return;

    QRCode.toCanvas(
      canvasRef.current,
      value,
      {
        width: 200,
        margin: 2,
        color: {
          dark: '#142A24',  // Dark green brand color for clean scan contrast
          light: '#FFFFFF'
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
  }, [value]);

  return (
    <div className={`qr-display-card ${className}`}>
      {error ? (
        <div style={{ color: 'var(--error)', fontSize: 13, textAlign: 'center' }}>{error}</div>
      ) : (
        <canvas ref={canvasRef} className="qr-display-card__code" />
      )}
      {label && (
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)', marginTop: 8 }}>
          {label}
        </span>
      )}
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Secure QR Verification
      </span>
    </div>
  );
}
