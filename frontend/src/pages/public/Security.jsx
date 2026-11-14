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
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>1. Face & Voice Matching</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            During registration we store numeric templates, not photos or recordings: a face descriptor computed in your browser (face-api.js) and a voice embedding (SpeechBrain ECAPA-TDNN when installed on the server, otherwise a spectral voice profile). During the interview, live samples are compared with these templates at fixed thresholds. Raw video is never uploaded; answer audio is sent only to be transcribed and is not stored.
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>2. Interview Proctoring</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            In the browser we watch for another person in the camera view, the candidate leaving the frame, the head turning away from the screen for several seconds, tab switches, leaving the window, and copy/paste. Each sustained incident is recorded and lowers the integrity score shown on the report.
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>3. Certificate Checks</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Uploaded certificates are read with OCR. We then check that the details are plausible: we fetch the verification link printed on the certificate (public addresses only) and look the issuing company up in public registries. This confirms the details look consistent; it does not cryptographically prove that the issuer created the document. SkillProof reports themselves are signed (HMAC-SHA256) so a shared report can't be altered.
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>4. Limitations</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            There is no liveness or anti-spoofing detection yet: a photo, a replayed video or a cloned voice is not specifically detected. Biometric matching accuracy can differ across lighting, cameras, microphones and demographic groups, so proctoring flags are signals for human review, never automatic decisions.
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>5. Consent & Your Data</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            You choose to register your face and voice, and joining an organisation's drive shares your results with that organisation only. You can delete your face and voice data at any time from Settings. Per-assessment copies are erased automatically after a retention period (180 days by default). Scores and reports contain no biometric data.
          </p>
        </div>
      </section>
    </div>
  );
}
