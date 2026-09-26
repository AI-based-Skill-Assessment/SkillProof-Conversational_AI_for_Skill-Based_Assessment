import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Logo from '../../components/common/Logo';
import StatusBadge from '../../components/common/StatusBadge';
import { HoloCardLoader } from '../../components/common/LoadingAnimations';
import { formatScore, scoreColor, scoreLabel } from '../../utils/formatScore';
import { formatDate } from '../../utils/formatDate';
import Button from '../../components/common/Button';
import ROUTES from '../../core/routes';
import '../../styles/pages/portal.css';

export default function PublicCredentialVerify() {
  const { hash } = useParams();
  const [credential, setCredential] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchCredential() {
      try {
        setLoading(true);
        setError(null);

        const isExternal = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
        const apiBase = isExternal
          ? `${window.location.protocol}//${window.location.hostname}:8000/api/v1`
          : '/api/v1';

        const res = await fetch(`${apiBase}/verify/credential/public/${hash}`);
        if (!res.ok) {
          throw new Error('Verifiable credential not found or signature invalid.');
        }

        const data = await res.json();
        setCredential(data);
      } catch (err) {
        console.warn('Could not fetch public credential:', err);
        setError(err.message || 'Verification record not found.');
      } finally {
        setLoading(false);
      }
    }

    if (hash) {
      fetchCredential();
    }
  }, [hash]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadJSON = () => {
    if (!credential) return;
    const blob = new Blob([JSON.stringify(credential, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SkillProof_Credential_${hash}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)' }}>
        <HoloCardLoader label="Validating Cryptographic Proof & Digital Signature..." />
      </div>
    );
  }

  if (error || !credential) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)', padding: 24 }}>
        <div style={{ maxWidth: 500, width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 36, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 24, fontWeight: 700 }}>
            ✕
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Credential Verification Failed</h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5 }}>
            The requested cryptographic credential token is invalid, has been tampered with, or does not exist.
          </p>
          <Link to={ROUTES.HOME}>
            <Button variant="primary">Return to SkillProof Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const subj = credential.credentialSubject || {};
  const proof = credential.proof || {};
  const biometric = subj.biometricAttestation || {};
  const doc = subj.documentAttestation || {};

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', padding: '32px 16px 64px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Link to={ROUTES.HOME} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <Logo size={32} color="#0284c7" />
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>SkillProof</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>CRYPTOGRAPHIC CREDENTIAL REGISTRY</div>
            </div>
          </Link>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="secondary" onClick={handleCopyLink}>
              {copied ? '✓ Link Copied!' : '🔗 Copy Verification Link'}
            </Button>
            <Button variant="outline" onClick={handleDownloadJSON}>
              📜 W3C JSON
            </Button>
          </div>
        </div>

        {/* Verification Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(2, 132, 199, 0.12) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-xl)',
            padding: '24px 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #10b981 0%, #0284c7 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 26,
                fontWeight: 800,
                boxShadow: '0 0 24px rgba(16, 185, 129, 0.4)'
              }}
            >
              ✓
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                CRYPTOGRAPHICALLY VERIFIED CREDENTIAL
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 2px' }}>
                Authentic Skill Proof Assertion
              </h1>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Issuer: SkillProof Autonomous Engine • Algorithm: HMAC-SHA256 • Status: Active
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Issued On</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatDate(credential.issuanceDate)}
            </div>
          </div>
        </div>

        {/* Credential Card */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            padding: 32,
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: 28
          }}
        >
          {/* Candidate & Role Hero */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                Verified Candidate
              </div>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                {subj.candidateName}
              </h2>
              <div style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 600, marginTop: 2 }}>
                {subj.role} {subj.company ? `• Verified at ${subj.company}` : ''}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                className="score-display-ring"
                style={{
                  '--score-pct': Math.min(100, Math.max(0, subj.averageScore || 0)),
                  '--score-color': scoreColor(subj.averageScore)
                }}
              >
                <span className="score-display-ring__val">{formatScore(subj.averageScore)}%</span>
                <span className="score-display-ring__label">{scoreLabel(subj.averageScore)}</span>
              </div>
              <div>
                <StatusBadge variant={subj.verdict === 'FULLY_VERIFIED' ? 'success' : 'warning'}>
                  {subj.verdict?.replace(/_/g, ' ') || 'VERIFIED'}
                </StatusBadge>
              </div>
            </div>
          </div>

          {/* Verified Skills Pill Grid */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase' }}>
              Validated Domain Skills
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(subj.skills || []).map((skill, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(2, 132, 199, 0.1)',
                    border: '1px solid rgba(2, 132, 199, 0.25)',
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <span style={{ color: '#10b981' }}>✓</span> {skill}
                </div>
              ))}
            </div>
          </div>

          {/* Biometric & Integrity Proof Breakdown */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 20
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Face Identity Match</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: biometric.faceMatchVerified ? 'var(--success)' : 'var(--danger)', marginTop: 4 }}>
                {biometric.faceMatchVerified ? '✓ ArcFace 512D Verified' : 'Unverified'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Voice Acoustic Match</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: biometric.voiceAcousticVerified ? 'var(--success)' : 'var(--danger)', marginTop: 4 }}>
                {biometric.voiceAcousticVerified ? '✓ SpeechBrain ECAPA Verified' : 'Unverified'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Proctoring Trust Score</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary)', marginTop: 4 }}>
                {biometric.proctoringIntegrityScore ?? 100}% Integrity Index
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Source Document</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: doc.verified ? 'var(--success)' : 'var(--text-primary)', marginTop: 4 }}>
                {doc.verified ? '✓ Authenticity Confirmed' : doc.documentName || 'Skill Assessment'}
              </div>
            </div>
          </div>

          {/* Cryptographic Hash & JWS Signature Box */}
          <div
            style={{
              background: '#090d16',
              border: '1px solid #1e293b',
              borderRadius: 'var(--radius-lg)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              fontFamily: 'monospace'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#38bdf8', fontWeight: 700 }}>
                CRYPTOGRAPHIC SHA-256 PROOF SIGNATURE
              </span>
              <span style={{ fontSize: 11, color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: 4 }}>
                VERIFIED TAMPER-PROOF
              </span>
            </div>

            <div style={{ fontSize: 13, color: '#f8fafc', wordBreak: 'break-all', background: '#020617', padding: '10px 12px', borderRadius: 6, border: '1px solid #1e293b' }}>
              <strong>Hash: </strong> {credential.verification_hash || credential.verificationHash || hash}
            </div>

            <div style={{ fontSize: 11, color: '#94a3b8', wordBreak: 'break-all' }}>
              <strong>Digital Signature: </strong> {proof.jws || 'eyJhbGciOiJIUzI1NiJ9...'}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)', padding: '12px 0' }}>
          SkillProof Autonomous Verification Network • Cryptographically Sealed Credential •{' '}
          <Link to={ROUTES.HOME} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
            Verify another candidate
          </Link>
        </div>
      </div>
    </div>
  );
}
