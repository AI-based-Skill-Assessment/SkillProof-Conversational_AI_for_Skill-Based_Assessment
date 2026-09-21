import { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { useToast } from '../../components/common/Toast';
import client from '../../core/api/client';
import Button from '../../components/common/Button';
import { NeuralOrbitLoader } from '../../components/common/LoadingAnimations';
import ROUTES from '../../core/routes';
import '../../styles/pages/portal.css';

export default function AssessmentReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { setIsDemo } = useOutletContext() || {};

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await client.get(`/verify/${id}`);
        setSession(res.data);
        if (res.data && setIsDemo) {
          setIsDemo(false);
        }
      } catch (err) {
        toast.error('Load Failed', 'Failed to retrieve assessment details.');
        navigate(ROUTES.USER.DASHBOARD);
      } finally {
        setLoading(false);
      }
    }
    fetchSession();
  }, [id, navigate, toast, setIsDemo]);

  async function handleVerify() {
    const startTime = Date.now();
    try {
      setVerifying(true);
      // Run certificate lookupcrawler checks (POST /verify/{session_id})
      await client.post(`/verify/${id}`);
      toast.success('Verification Triggered', 'Completed document verification crawl.');
      
      // Load details again
      const res = await client.get(`/verify/${id}`);
      setSession(res.data);
    } catch (err) {
      console.error(err);
      toast.warning('Crawl Unresolved', 'Document verification complete but site was unverifiable. Proceed to interview.');
      
      // Set status ready for next step
      const res = await client.get(`/verify/${id}`);
      setSession(res.data);
    } finally {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 1800 - elapsed);
      setTimeout(() => {
        setVerifying(false);
      }, remaining);
    }
  }

  function handleStartInterview() {
    navigate(ROUTES.USER.INTERVIEW_CHECK(id));
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '36px 40px', boxShadow: 'var(--shadow-lg)' }}>
          <NeuralOrbitLoader label="Analyzing Ingested Credential Matrix..." />
        </div>
      </div>
    );
  }

  const isCert = session.intake_mode === 'certificate';
  const isCrawlComplete = session.status !== 'pending';

  return (
    <div className="anim-fade-in" style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="page-header">
        <h2 className="page-header__title">Review Ingested Assessment</h2>
        <p className="page-header__subtitle">Review parsed credentials and verify authenticity before starting the AI interview</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Certificate Parsed Metadata Card */}
        <div className="common-card">
          <div className="common-card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Extracted Profile Scope</h3>
            {session.certificate_filename && (
              <span style={{ fontSize: 12, background: 'rgba(18, 163, 126, 0.1)', color: 'var(--primary)', border: '1px solid rgba(18, 163, 126, 0.25)', padding: '2px 10px', borderRadius: 12, fontWeight: 600 }}>
                {session.certificate_filename.split(',').length} Certificate(s) Ingested
              </span>
            )}
          </div>
          <div className="common-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Intake Mode:</div>
              <div style={{ textTransform: 'capitalize' }}>{session.intake_mode.replace('_', ' ')}</div>

              {session.certificate_filename && (
                <>
                  <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Uploaded File(s):</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {session.certificate_filename.split(',').map((fileItem, idx) => (
                      <span key={idx} style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                        {fileItem.trim()}
                      </span>
                    ))}
                  </div>
                </>
              )}

              {session.extracted_company && (
                <>
                  <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Company / Issuers:</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {session.extracted_company.split(',').map((comp, idx) => (
                      <span key={idx} style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}>
                        {comp.trim()}
                      </span>
                    ))}
                  </div>
                </>
              )}

              <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Extracted Role(s):</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {session.extracted_role ? (
                  session.extracted_role.split(',').map((r, idx) => (
                    <span key={idx} style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
                      {r.trim()}
                    </span>
                  ))
                ) : (
                  <span>Not parsed / declared</span>
                )}
              </div>

              <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>All Consolidated Skills:</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {session.extracted_skills && session.extracted_skills.length > 0 ? (
                  session.extracted_skills.map(s => (
                    <span key={s} style={{ background: 'rgba(18, 163, 126, 0.1)', color: 'var(--primary)', border: '1px solid rgba(18, 163, 126, 0.25)', padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                      {s}
                    </span>
                  ))
                ) : (
                  <span>None declared</span>
                )}
              </div>

              {session.extracted_verify_url && (
                <>
                  <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Verify URL(s):</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, wordBreak: 'break-all' }}>
                    {session.extracted_verify_url.split('|').map((urlItem, idx) => (
                      <a key={idx} href={urlItem.trim()} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--primary)', textDecoration: 'underline' }}>
                        {urlItem.trim()}
                      </a>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Certificate Crawler status card */}
        {isCert && (
          <div className="common-card">
            <div className="common-card__header">
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Document Verification</h3>
            </div>
            <div className="common-card__body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    Verification State: {session.status === 'pending' ? 'Not Run' : 'Document is Verified'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Runs URL verification and MCA corporate checks to confirm issuer details.
                  </div>
                </div>

                {!isCrawlComplete ? (
                  <Button onClick={handleVerify} loading={verifying}>
                    Verify Certificate
                  </Button>
                ) : (
                  <span style={{ color: 'var(--success)', fontWeight: 600 }}>Verified at Source</span>
                )}
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
          <Button variant="secondary" onClick={() => navigate(ROUTES.USER.DASHBOARD)}>
            Back to Dashboard
          </Button>

          {(!isCert || isCrawlComplete) ? (
            <Button onClick={handleStartInterview}>
              Start AI Interview
            </Button>
          ) : (
            <Button disabled>
              Wait for Verification
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
