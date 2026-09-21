import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  BiometricScanLoader,
  NeuralOrbitLoader,
  HoloCardLoader,
  VoiceSynapseLoader,
  HexMatrixLoader
} from '../../components/common/LoadingAnimations';
import AmbientHudRings from '../../components/common/AmbientHudRings';
import ThemeToggle from '../../components/common/ThemeToggle';
import Button from '../../components/common/Button';
import ROUTES from '../../core/routes';
import '../../styles/common/loaders.css';

// Dedicated standalone wrapper for DEMO display
function HudRingsDemoWrapper({ label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ position: 'relative', width: 220, height: 220 }}>
        <AmbientHudRings size="220px" opacity="0.9" style={{ position: 'absolute', bottom: 0, right: 0 }} />
      </div>
      {label && <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</div>}
    </div>
  );
}

const DEMOS = [
  {
    id: 'biometric-scan',
    title: '1. Biometric Laser Scanner & Concentric Radar Ring',
    category: 'Biometrics & Anti-Spoofing',
    bestFor: 'Face/Voice Registration, Liveness Checks, OCR Validation',
    Component: BiometricScanLoader,
  },
  {
    id: 'neural-orbit',
    title: '2. Neural Orbit & AI Constellation',
    category: 'Generative AI & LLM Engine',
    bestFor: 'Adaptive Question Generation, Skill Scoring Calculations',
    Component: NeuralOrbitLoader,
  },
  {
    id: 'holo-card',
    title: '3. 3D Holographic Card Shimmer',
    category: 'Credentials & Verifications',
    bestFor: 'Public Audit Verification, Certificate Credential Loading',
    Component: HoloCardLoader,
  },
  {
    id: 'voice-synapse',
    title: '4. Fluid Voice Synapse Waveform',
    category: 'Audio & Speech Recognition',
    bestFor: 'Voiceprint Matching, Audio Stream Buffering in Interview',
    Component: VoiceSynapseLoader,
  },
  {
    id: 'hex-matrix',
    title: '5. Glowing Hexagon Matrix & Ledger Proof',
    category: 'Integrity & Security Ledger',
    bestFor: 'QR Audit Verification, Ledger Transactions, Admin Approvals',
    Component: HexMatrixLoader,
  },
  {
    id: 'hud-rings',
    title: '6. Ambient Holographic HUD Rings (Opposing Dual-Spin)',
    category: 'Page Ambience & Sci-Fi Background',
    bestFor: 'Bottom-Right Ambient Hologram across all workspace pages',
    Component: HudRingsDemoWrapper,
  },
];

export default function LoadingDemosPage() {
  const { animId } = useParams();
  const [selectedId, setSelectedId] = useState(animId || 'all');
  const [customLabel, setCustomLabel] = useState('');

  const activeDemo = DEMOS.find(d => d.id === selectedId);

  return (
    <div className="loader-demos-page anim-fade-in">
      {/* Header */}
      <div className="loader-demos-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', width: '100%' }}>
          <Link to={ROUTES.HOME} className="common-button common-button--secondary common-button--sm">
            ← Back to Home
          </Link>
          <div className="loader-demos-badge">Design Lab • Loading Animations Suite</div>
          <ThemeToggle />
        </div>

        <h1 className="loader-demos-title">
          SkillProof <span>Loading & Transition Animations</span>
        </h1>
        <p className="loader-demos-desc">
          Interactive showcase of the 5 custom animation concepts crafted specifically for AI interviews, biometric scanning, and cryptographic credentials.
        </p>
      </div>

      {/* Navigation Filter Tabs */}
      <div className="loader-nav-tabs">
        <button
          type="button"
          className={`loader-nav-tab ${selectedId === 'all' ? 'loader-nav-tab--active' : ''}`}
          onClick={() => setSelectedId('all')}
        >
          👁 All Animations
        </button>
        {DEMOS.map(d => (
          <button
            key={d.id}
            type="button"
            className={`loader-nav-tab ${selectedId === d.id ? 'loader-nav-tab--active' : ''}`}
            onClick={() => setSelectedId(d.id)}
          >
            {d.title.split('.')[1].trim()}
          </button>
        ))}
      </div>

      {/* Single Isolated Focus Stage View */}
      {selectedId !== 'all' && activeDemo && (
        <div className="loader-preview-stage anim-scale-in" style={{ paddingBottom: 80, minHeight: 520 }}>
          <div style={{ position: 'absolute', top: 20, left: 24, textAlign: 'left' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {activeDemo.category}
            </span>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
              {activeDemo.title}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Recommended: {activeDemo.bestFor}
            </p>
          </div>

          <div style={{ margin: '70px 0 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <activeDemo.Component label={customLabel || undefined} />
          </div>

          {/* Quick Route Links to See Real in App */}
          <div style={{ position: 'absolute', bottom: 18, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            <input
              type="text"
              placeholder="Type custom loading text..."
              value={customLabel}
              onChange={e => setCustomLabel(e.target.value)}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--surface-elevated)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                width: '240px'
              }}
            />
            {customLabel && (
              <Button size="sm" variant="secondary" onClick={() => setCustomLabel('')}>
                Reset Text
              </Button>
            )}
            {selectedId === 'neural-orbit' && (
              <Link
                to="/user/interview/demo/processing"
                className="common-button common-button--primary common-button--sm"
                style={{ textDecoration: 'none' }}
              >
                Launch Live Scoring Simulation Page ⚡
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Grid Showcase of All 5 */}
      {selectedId === 'all' && (
        <div className="loader-card-grid">
          {DEMOS.map(demo => {
            const Comp = demo.Component;
            return (
              <div key={demo.id} className="loader-demo-box">
                <div className="loader-demo-box__header">
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>
                    {demo.category}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedId(demo.id)}
                    style={{
                      fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
                      background: 'var(--surface-hover)', padding: '3px 8px', borderRadius: 6,
                      border: '1px solid var(--border)', cursor: 'pointer'
                    }}
                  >
                    Focus Stage ↗
                  </button>
                </div>

                <div className="loader-demo-box__body">
                  <Comp />
                </div>

                <div className="loader-demo-box__footer">
                  <strong>Best for:</strong> {demo.bestFor}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
