import '../../styles/pages/public.css';

export default function Security() {
  return (
    <div className="anim-fade-in">
      <section className="public-hero">
        <span className="public-hero__tagline">Security & Biometric Privacy</span>
        <h1 className="public-hero__title">
          Built on Trust and <span>Rigorous Anti-Fraud</span>
        </h1>
        <p className="public-hero__desc">
          How we protect candidate identity, handle biometric templates, and detect integrity violations during assessments.
        </p>
      </section>

      <section className="public-section" style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 40 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>1. Face & Voice Verification (ArcFace & SpeechBrain)</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            We extract face embeddings using ArcFace configurations (DeepFace) and speaker identities via SpeechBrain ECAPA-TDNN models. We do not store raw videos or audio files on the backend. Only raw vector embeddings are processed for distance-checks during dynamic checkpoints.
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>2. Eye & Head-Pose Integrity (MediaPipe)</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            To prevent browser splits or tab-switching, our face mesh model continuously monitors gaze coordinates and head rotation. If a candidate shifts their gaze away from the camera continuously or head pose deviates significantly, violations are flagged on the final report.
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>3. Cryptographic Verification Links</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Every credential certificate is verified at source (querying digital URLs and registry records). If verified, the final report is signed in the database and tied to a unique verification ID. Sharing the report generates a secure, read-only dashboard for potential employers.
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>4. GDPR & Data Consent</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Candidates maintain 100% ownership of their data. Biometric profiles can be purged from dashboard settings instantly. Certificates can be retracted, and institutional sharing permissions can be revoked at any time.
          </p>
        </div>
      </section>
    </div>
  );
}
