import { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import client from '../../core/api/client';
import StatusBadge from '../../components/common/StatusBadge';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/common/Card';
import QRDisplay from '../../components/common/QRDisplay';
import { formatDate } from '../../utils/formatDate';
import { formatScore, scoreColor } from '../../utils/formatScore';
import Button from '../../components/common/Button';
import ROUTES from '../../core/routes';
import { MOCK_CERTIFICATES } from '../../core/mockData/user.mock';

export default function Certificates() {
  const { setIsDemo } = useOutletContext() || {};
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lanIp, setLanIp] = useState('localhost');

  useEffect(() => {
    // Fetch LAN IP for accurate QR codes
    fetch('/server-info')
      .then(r => r.ok ? r.json() : null)
      .then(info => {
        if (info?.lan_ip) setLanIp(info.lan_ip);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    async function fetchAssessments() {
      try {
        setLoading(true);
        const res = await client.get('/sessions');
        if (res.data && res.data.length > 0) {
          setSessions(res.data);
          if (setIsDemo) setIsDemo(false);
        } else {
          setSessions([]);
          if (setIsDemo) setIsDemo(true);
        }
      } catch (err) {
        console.warn('Could not load sessions from backend:', err);
        setSessions([]);
        if (setIsDemo) setIsDemo(true);
      } finally {
        setLoading(false);
      }
    }

    fetchAssessments();
  }, [setIsDemo]);

  // Construct QR URL helper
  const getVerifyUrl = (sessionId) => {
    const isExternal = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    const host = isExternal ? window.location.hostname : lanIp;
    return `http://${host}:5173/verify/${sessionId}`;
  };

  return (
    <div className="anim-fade-in">
      <div className="page-header page-header--row">
        <div>
          <h2 className="page-header__title">Verifiable Credentials & Certificates</h2>
          <p className="page-header__subtitle">
            Secure cryptographic credentials and public verification QR codes for your completed assessments
          </p>
        </div>
        <div className="page-header__actions">
          <Link to={ROUTES.USER.NEW_ASSESSMENT} className="common-button common-button--primary common-button--shimmer common-button--shimmer-slow">
            New Assessment
          </Link>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
          <p>Loading verifiable credentials...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M6 3h9l3 3v15H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" />
            </svg>
          </div>
          <h3 className="empty-state__title">No Assessments Found</h3>
          <p className="empty-state__text">
            Take your first assessment or upload a certificate to generate verifiable cryptographic credentials and QR codes.
          </p>
          <Link to={ROUTES.USER.NEW_ASSESSMENT} className="common-button common-button--primary common-button--shimmer common-button--shimmer-slow">
            Start Assessment
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 24 }}>
          {sessions.map(s => {
            const sc = (s.scores && s.scores[0]) || {};
            const scoreVal = sc.overall_skill_score ?? 0;
            const qrId = `SP-${s.id.slice(0, 8).toUpperCase()}`;
            const verifyUrl = getVerifyUrl(s.id);
            const isVerified = s.status === 'scored' || s.document?.fetch_status === 'verified';

            return (
              <Card key={s.id} style={{ display: 'flex', flexDirection: 'column' }}>
                <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <CardTitle style={{ fontSize: 16, fontWeight: 700 }}>
                    {s.extracted_role || s.intake_mode === 'certificate' ? (s.extracted_role || 'Certificate Verification') : 'Skill Assessment'}
                  </CardTitle>
                  <StatusBadge variant={isVerified ? 'success' : 'warning'}>
                    {isVerified ? 'VERIFIED' : s.status.toUpperCase()}
                  </StatusBadge>
                </CardHeader>
                <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 13, width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Candidate:</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.candidate_name || 'Candidate'}</span>
                    </div>
                    {s.extracted_company && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Organization:</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.extracted_company}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Assessment Score:</span>
                      <span style={{ fontWeight: 700, color: scoreColor(scoreVal) }}>
                        {formatScore(scoreVal)}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Assessment Date:</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatDate(s.created_at)}</span>
                    </div>
                    {s.certificate_filename && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Document:</span>
                        <span style={{ fontWeight: 500, color: 'var(--text-secondary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.certificate_filename}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Verifiable QR Code connected to live session */}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <QRDisplay value={verifyUrl} label={qrId} />
                    <div style={{ marginTop: 14, width: '100%', display: 'flex', gap: 10 }}>
                      <Link
                        to={ROUTES.USER.REPORT_DETAIL(s.id)}
                        className="common-button common-button--secondary"
                        style={{ flex: 1, textAlign: 'center', textDecoration: 'none', justifyContent: 'center' }}
                      >
                        View Report
                      </Link>
                      <a
                        href={verifyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="common-button common-button--ghost"
                        style={{ flex: 1, textAlign: 'center', textDecoration: 'none', justifyContent: 'center' }}
                      >
                        Public Link ↗
                      </a>
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
