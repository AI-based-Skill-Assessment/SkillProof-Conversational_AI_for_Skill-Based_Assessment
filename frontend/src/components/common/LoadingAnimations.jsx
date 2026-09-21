import React from 'react';
import '../../styles/common/loaders.css';

/**
 * 1. Biometric Laser Scanner Loader
 */
export function BiometricScanLoader({ label = "Scanning Biometric Signature...", size = 180 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="bio-scan-container" style={{ width: size, height: size }}>
        <div className="bio-scan-ring-outer" />
        <div className="bio-scan-ring-inner" />
        <div className="bio-scan-pulse" />
        <div className="bio-scan-pulse" />
        <div className="bio-scan-grid">
          <div className="bio-scan-laser" />
          <svg className="bio-scan-icon" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 8V6a2 2 0 0 1 2-2h2" />
            <path d="M4 16v2a2 2 0 0 0 2 2h2" />
            <path d="M16 4h2a2 2 0 0 1 2 2v2" />
            <path d="M16 20h2a2 2 0 0 0 2-2v-2" />
            <circle cx="12" cy="11" r="3" />
            <path d="M8 17a4 4 0 0 1 8 0" />
          </svg>
        </div>
      </div>
      {label && <div className="bio-scan-status">{label}</div>}
    </div>
  );
}

/**
 * 2. Neural Orbit / AI Constellation Loader
 */
export function NeuralOrbitLoader({ label = "Synchronizing AI Neural Engine..." }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div className="neural-orbit-wrapper">
        <div className="neural-core" />
        <div className="neural-ring neural-ring--1">
          <div className="neural-particle" />
        </div>
        <div className="neural-ring neural-ring--2">
          <div className="neural-particle" />
        </div>
        <div className="neural-ring neural-ring--3">
          <div className="neural-particle" />
        </div>
      </div>
      {label && (
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
          {label}
        </div>
      )}
    </div>
  );
}

/**
 * 3. 3D Holographic Card Shimmer Loader
 */
export function HoloCardLoader({ label = "Generating Cryptographic Credential..." }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <div className="holo-card-wrap">
        <div className="holo-shimmer-sweep" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="holo-card-chip" />
          <div className="holo-card-stamp">SKILLPROOF • SECURE</div>
        </div>
        <div className="holo-card-lines">
          <div className="holo-line holo-line--wide" />
          <div className="holo-line holo-line--narrow" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div className="holo-line" style={{ width: '45%' }} />
          <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid var(--primary)', opacity: 0.6 }} />
        </div>
      </div>
      {label && (
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
          {label}
        </div>
      )}
    </div>
  );
}

/**
 * 4. Fluid Voice Synapse Waveform Loader
 */
export function VoiceSynapseLoader({ label = "Analyzing Voice Frequencies & Acoustic Liveness..." }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div className="voice-synapse-box">
        <div className="voice-synapse-bar" />
        <div className="voice-synapse-bar" />
        <div className="voice-synapse-bar" />
        <div className="voice-synapse-bar" />
        <div className="voice-synapse-bar" />
        <div className="voice-synapse-bar" />
        <div className="voice-synapse-bar" />
      </div>
      {label && (
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', letterSpacing: '0.03em' }}>
          {label}
        </div>
      )}
    </div>
  );
}

/**
 * 5. Glowing Hexagon Matrix Loader
 */
export function HexMatrixLoader({ label = "Verifying Cryptographic Ledger Proof..." }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div className="hex-matrix-wrap">
        <svg className="hex-svg" viewBox="0 0 100 100">
          {/* Center */}
          <polygon className="hex-cell" points="50,38 60,44 60,56 50,62 40,56 40,44" />
          {/* Top */}
          <polygon className="hex-cell" points="50,14 60,20 60,32 50,38 40,32 40,20" />
          {/* Top Right */}
          <polygon className="hex-cell" points="72,26 82,32 82,44 72,50 62,44 62,32" />
          {/* Bottom Right */}
          <polygon className="hex-cell" points="72,50 82,56 82,68 72,74 62,68 62,56" />
          {/* Bottom */}
          <polygon className="hex-cell" points="50,62 60,68 60,80 50,86 40,80 40,68" />
          {/* Bottom Left */}
          <polygon className="hex-cell" points="28,50 38,56 38,68 28,74 18,68 18,56" />
          {/* Top Left */}
          <polygon className="hex-cell" points="28,26 38,32 38,44 28,50 18,44 18,32" />
        </svg>
      </div>
      {label && (
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
          {label}
        </div>
      )}
    </div>
  );
}
