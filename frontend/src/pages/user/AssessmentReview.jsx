import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../components/common/Toast';
import client from '../../core/api/client';
import Button from '../../components/common/Button';
import ROUTES from '../../core/routes';
import '../../styles/pages/portal.css';

export default function AssessmentReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await client.get(`/verify/${id}`);
        setSession(res.data);
      } catch (err) {
        toast.error('Load Failed', 'Failed to retrieve assessment details.');
        navigate(ROUTES.USER.DASHBOARD);
      } finally {
        setLoading(false);
      }
    }
    fetchSession();
  }, [id, navigate, toast]);

  async function handleVerify() {
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
      setVerifying(false);
    }
  }

  function handleStartInterview() {
    navigate(ROUTES.USER.INTERVIEW_CHECK(id));
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading review details...</div>;

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
          <div className="common-card__header">
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Extracted Profile Scope</h3>
          </div>
          <div className="common-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Intake Mode:</div>
              <div style={{ textTransform: 'capitalize' }}>{session.intake_mode.replace('_', ' ')}</div>

              {session.extracted_company && (
                <>
                  <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Company / Issuer:</div>
                  <div>{session.extracted_company}</div>
                </>
              )}

              <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Target Role:</div>
              <div>{session.extracted_role || 'Not parsed / declared'}</div>

              <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Target Skills:</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {session.extracted_skills && session.extracted_skills.length > 0 ? (
                  session.extracted_skills.map(s => (
                    <span key={s} style={{ background: 'var(--surface-hover)', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>
                      {s}
                    </span>
                  ))
                ) : (
                  <span>None declared</span>
                )}
              </div>

              {session.extracted_verify_url && (
                <>
                  <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Verify URL:</div>
                  <div style={{ wordBreak: 'break-all' }}>
                    <a href={session.extracted_verify_url} target="_blank" rel="noopener noreferrer">
                      {session.extracted_verify_url}
                    </a>
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
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Crawler Document Verification</h3>
            </div>
            <div className="common-card__body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    Crawl State: {session.status === 'pending' ? 'Not Run' : 'Crawl Completed'}
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
                  <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Verified at Source</span>
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
