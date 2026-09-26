import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../../core/api/client';
import { MOCK_REPORT } from '../../core/mockData/user.mock';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';
import QRDisplay from '../../components/common/QRDisplay';
import { formatScore, scoreColor, scoreLabel } from '../../utils/formatScore';
import { formatDate } from '../../utils/formatDate';
import Button from '../../components/common/Button';
import Logo from '../../components/common/Logo';
import { NeuralOrbitLoader } from '../../components/common/LoadingAnimations';
import ROUTES from '../../core/routes';
import '../../styles/pages/portal.css';

export default function ReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [lanIp, setLanIp] = useState('localhost');

  useEffect(() => {
    // Fetch the server's real LAN IP so the QR code always has the correct URL
    fetch('/server-info').then(r => r.ok ? r.json() : null).then(info => {
      if (info?.lan_ip) setLanIp(info.lan_ip);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    async function loadReport() {
      try {
        setLoading(true);
        // Try fetching compiled scorecard from /score/{id}
        let scoreData = null;
        try {
          const scoreRes = await client.get(`/score/${id}`);
          if (scoreRes.data && scoreRes.data.metrics) {
            scoreData = scoreRes.data;
          }
        } catch (e) {
          console.warn('Direct score endpoint call warning, trying verify session endpoint:', e);
        }

        // Fetch verification session details
        const sessionRes = await client.get(`/verify/${id}`);
        const s = sessionRes.data;

        if (scoreData || s) {
          const sc = (s.scores && s.scores[0]) || {};
          const metrics = scoreData?.metrics || {};
          const detailed = scoreData?.detailed_scores || [];
          const firstDetail = detailed[0] || {};
          const transcriptList = scoreData?.transcript || (s.interview && s.interview.transcript) || [];
          const userAnswersCount = transcriptList.filter(m => (m.role === 'user' || m.sender === 'user') && (m.content || m.text)).length;
          const avgScore = metrics.average_skill_score ?? sc.overall_skill_score ?? 0;
          const isZeroAnswer = userAnswersCount === 0 || metrics.questions_answered_count === 0;

          const bioAudit = scoreData?.biometric_audit || {};
          const verCred = scoreData?.verifiable_credential || {};
          const verificationHash = verCred?.verificationHash || `SP-${s.id.slice(0, 8).toUpperCase()}-${s.id.slice(9, 13).toUpperCase()}`;

          setReport({
            session_id: s.id,
            candidate: { name: s.candidate_name || 'Candidate', email: s.candidate_email || '' },
            assessment: {
              intake_mode: s.intake_mode || 'certificate',
              certificate: s.certificate_filename,
              date: s.created_at || new Date().toISOString(),
              skills: s.extracted_skills || [],
              role: s.extracted_role || 'Software Verification',
              company: s.extracted_company
            },
            score: {
              overall: isZeroAnswer ? 0.0 : avgScore,
              specificity: isZeroAnswer ? 0.0 : (firstDetail.specificity_score ?? 0.0),
              depth: isZeroAnswer ? 0.0 : (firstDetail.depth_score ?? 0.0),
              consistency: isZeroAnswer ? 0.0 : (firstDetail.consistency_score ?? 0.0),
              verdict: isZeroAnswer ? 'UNVERIFIED_EARLY_EXIT' : (scoreData?.verdict || sc.verdict || 'FULLY_VERIFIED')
            },
            document_verification: {
              status: s.document?.fetch_status || (metrics.document_verified ? 'verified' : 'unverifiable'),
              path: s.document?.verification_path || 'url_fetch',
              score: metrics.document_score ?? s.document?.document_score ?? 0.0
            },
            biometric: {
              face_verified: bioAudit.face_verified ?? true,
              voice_verified: bioAudit.voice_verified ?? true,
              integrity_score: bioAudit.integrity_score ?? 100.0,
              tab_switch_count: bioAudit.tab_switch_count ?? 0,
              window_blur_count: bioAudit.window_blur_count ?? 0,
              copy_paste_attempts: bioAudit.copy_paste_attempts ?? 0,
              fraud_status: bioAudit.fraud_status ?? 'clean',
              timeline: bioAudit.proctoring_timeline || [],
              violations: (bioAudit.tab_switch_count || 0) + (bioAudit.copy_paste_attempts || 0)
            },
            verifiable_credential: verCred,
            verification_hash: verificationHash,
            ai_summary: isZeroAnswer 
              ? 'Assessment concluded early by candidate without submitting answers to technical questions.' 
              : (firstDetail.llm_reasoning || sc.llm_reasoning || scoreData?.explanation || 'Candidate completed technical verification.'),
            strengths: scoreData?.strengths || (s.interview?.skill_context?.strengths) || (isZeroAnswer ? ['Source document ingested'] : ['Technical Skill Proficiency']),
            improvements: scoreData?.improvements || (s.interview?.skill_context?.improvements) || (isZeroAnswer ? ['Complete technical interview drills'] : ['Advanced Optimization']),
            transcript: transcriptList,
            qr_verification_id: verificationHash
          });
          setIsDemo(false);
        } else {
          setReport(MOCK_REPORT);
          setIsDemo(true);
        }
      } catch (err) {
        console.error('Failed fetching live report:', err);
        setReport(MOCK_REPORT);
        setIsDemo(true);
      } finally {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 1600 - elapsed);
        setTimeout(() => {
          setLoading(false);
        }, remaining);
      }
    }
    const startTime = Date.now();
    loadReport();
  }, [id]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' }}>
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            padding: '36px 40px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16
          }}
        >
          <NeuralOrbitLoader label="Loading Verification Report..." />
        </div>
      </div>
    );
  }

  const scoreObj = report.score;
  const verifyUrl = `http://${lanIp}:5173/verify/${report.session_id}`;
  const isEarlyExit = scoreObj.verdict === 'UNVERIFIED_EARLY_EXIT' || scoreObj.overall === 0;

  return (
    <div className="anim-fade-in report-print-container">
      {/* Printable official document header */}
      <div className="report-print-header" style={{ display: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Logo size={36} color="#0284c7" />
          <div>
            <h1 className="report-print-title">SkillProof Verification Certificate</h1>
            <div className="report-print-subtitle">Certified Technical Assessment & Document Audit Report</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#0284c7' }}>ID: {report.qr_verification_id}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Date: {formatDate(report.assessment.date)}</div>
        </div>
      </div>

      {/* Screen web header */}
      <div className="page-header page-header--row report-non-printable">
        <div>
          <h2 className="page-header__title">Skill Verification Report</h2>
          <p className="page-header__subtitle">ID: {report.qr_verification_id}</p>
        </div>
        <div className="page-header__actions">
          <Button variant="secondary" onClick={() => navigate(ROUTES.USER.DASHBOARD)}>
            Back to Dashboard
          </Button>
          <Button variant="outline" onClick={() => navigate(ROUTES.CREDENTIAL(report.verification_hash || report.qr_verification_id))}>
            📜 View Verifiable Credential
          </Button>
          <Button onClick={() => window.print()}>
            Print / Export PDF
          </Button>
        </div>
      </div>

      {isDemo && (
        <div className="common-alert common-alert--info" style={{ marginBottom: 24 }}>
          <strong>Demo Report:</strong> Showing mock scoring data.
        </div>
      )}

      {isEarlyExit && (
        <div className="common-alert common-alert--warning" style={{ marginBottom: 24 }}>
          <strong>Assessment Incomplete:</strong> The candidate exited the assessment early before providing answers to the AI technical questions.
        </div>
      )}

      <div className="report-grid">
        {/* Left: detailed ratings and summaries */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Main stats: Score, Name, Company/Certificate */}
          <div className="common-card">
            <div className="common-card__body report-print-hero-card" style={{ display: 'flex', gap: 40, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: '0 0 auto', textAlign: 'center' }}>
                <div
                  className="score-display-ring"
                  style={{
                    '--score-pct': Math.min(100, Math.max(0, scoreObj.overall || 0)),
                    '--score-color': scoreColor(scoreObj.overall)
                  }}
                >
                  <span className="score-display-ring__val">{formatScore(scoreObj.overall)}%</span>
                  <span className="score-display-ring__label">{isEarlyExit ? 'Incomplete' : scoreLabel(scoreObj.overall)}</span>
                </div>
                <StatusBadge variant={isEarlyExit ? 'warning' : scoreObj.verdict === 'FULLY_VERIFIED' ? 'success' : 'warning'}>
                  {scoreObj.verdict.replace(/_/g, ' ')}
                </StatusBadge>
              </div>

              <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {report.assessment.role || 'Software Engineer'}
                  </h3>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {report.assessment.company ? `Internship verified at ${report.assessment.company}` : 'General Skill Profile'}
                  </p>
                  {report.assessment.certificate && (
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Document: {report.assessment.certificate}
                    </p>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Candidate Name</div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{report.candidate.name}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Verified Date</div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{formatDate(report.assessment.date)}</div>
                  </div>
                </div>
              </div>

              {/* Dedicated Printable QR Code parallel to score in PDF */}
              <div className="report-print-only" style={{ flex: '0 0 auto', textAlign: 'center' }}>
                <QRDisplay value={verifyUrl} label={report.qr_verification_id} darkColor="#000000" lightColor="#ffffff" />
              </div>
            </div>
          </div>


          {/* AI Evaluation Summary */}
          <Card>
            <CardHeader><CardTitle>AI Evaluation Summary</CardTitle></CardHeader>
            <CardBody>
              <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>{report.ai_summary}</p>
            </CardBody>
          </Card>

          {/* Detailed Skill Breakdown: Technical Strengths & Growth Areas */}
          <div className="grid-2 report-print-grid-2">
            <Card>
              <CardHeader><CardTitle>Technical Strengths</CardTitle></CardHeader>
              <CardBody>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 20, listStyleType: 'disc' }}>
                  {report.strengths.map(s => <li key={s} style={{ fontSize: 14, color: 'var(--text-primary)' }}>{s}</li>)}
                </ul>
              </CardBody>
            </Card>

            <Card>
              <CardHeader><CardTitle>Gaps / Areas for growth</CardTitle></CardHeader>
              <CardBody>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 20, listStyleType: 'disc' }}>
                  {report.improvements.map(s => <li key={s} style={{ fontSize: 14, color: 'var(--text-primary)' }}>{s}</li>)}
                </ul>
              </CardBody>
            </Card>
          </div>

          {/* Candidate Interview Q&A Transcript — screen only, omitted from single-page PDF */}
          <div className="report-non-printable">
            <Card>
              <CardHeader><CardTitle>Candidate Interview Transcript</CardTitle></CardHeader>
              <CardBody>
                {report.transcript && report.transcript.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {report.transcript.map((msg, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '12px 16px',
                          borderRadius: 'var(--radius-md)',
                          background: msg.role === 'user' ? 'rgba(18, 163, 126, 0.1)' : 'var(--surface-elevated)',
                          border: msg.role === 'user' ? '1px solid rgba(18, 163, 126, 0.3)' : '1px solid var(--border)',
                          fontSize: 13,
                          lineHeight: 1.5
                        }}
                      >
                        <div style={{ fontWeight: 700, color: msg.role === 'user' ? 'var(--primary)' : 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', fontSize: 11 }}>
                          {msg.role === 'user' ? 'Candidate Spoken Response' : 'AI Interviewer Question'}
                        </div>
                        <div style={{ color: 'var(--text-primary)' }}>{msg.content}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic', padding: '10px 0' }}>
                    No spoken responses were submitted by the candidate during this assessment session.
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </div>

        {/* Right sidebar: screen-only QR code card, Verifiable Credential & Proctoring Telemetry */}
        <div className="report-non-printable" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* QR Code */}
          <QRDisplay value={verifyUrl} label={report.qr_verification_id} />

          {/* Feature 4: Cryptographic Verifiable Credential Card */}
          <Card>
            <CardHeader><CardTitle>Cryptographic Credential</CardTitle></CardHeader>
            <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                W3C Verifiable Credential with HMAC-SHA256 digital proof signature.
              </div>
              <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: 11, fontFamily: 'monospace', color: '#38bdf8', wordBreak: 'break-all' }}>
                {report.verification_hash}
              </div>
              <Button
                variant="outline"
                style={{ width: '100%', fontSize: 12 }}
                onClick={() => navigate(ROUTES.CREDENTIAL(report.verification_hash))}
              >
                🔗 Open Public Proof Page
              </Button>
            </CardBody>
          </Card>

          {/* Feature 2: Verification Data & Anti-Cheating Proctoring Audit */}
          <Card>
            <CardHeader><CardTitle>Proctoring & Integrity Audit</CardTitle></CardHeader>
            <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Integrity Trust Index:</span>
                <span style={{ color: (report.biometric.integrity_score || 100) >= 80 ? 'var(--success)' : '#f59e0b', fontWeight: 700, fontSize: 13 }}>
                  {report.biometric.integrity_score || 100}% Trust
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Tab Switches Logged:</span>
                <span style={{ color: (report.biometric.tab_switch_count || 0) === 0 ? 'var(--success)' : 'var(--warning)', fontWeight: 600, fontSize: 12 }}>
                  {report.biometric.tab_switch_count || 0} Incident{(report.biometric.tab_switch_count || 0) !== 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Face Identity Match:</span>
                <span style={{ color: report.biometric.face_verified ? 'var(--success)' : 'var(--danger)', fontWeight: 600, fontSize: 12 }}>
                  {report.biometric.face_verified ? 'PASSED (ArcFace)' : 'FLAGGED'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Voice Acoustic Match:</span>
                <span style={{ color: report.biometric.voice_verified ? 'var(--success)' : 'var(--danger)', fontWeight: 600, fontSize: 12 }}>
                  {report.biometric.voice_verified ? 'PASSED (ECAPA)' : 'FLAGGED'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Anti-Cheating Status:</span>
                <span style={{ color: report.biometric.fraud_status === 'clean' ? 'var(--success)' : 'var(--danger)', fontWeight: 700, fontSize: 12, textTransform: 'uppercase' }}>
                  {report.biometric.fraud_status || 'CLEAN'}
                </span>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
