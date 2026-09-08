import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Logo from '../../components/common/Logo';
import StatusBadge from '../../components/common/StatusBadge';
import { formatScore, scoreColor, scoreLabel } from '../../utils/formatScore';
import { formatDate } from '../../utils/formatDate';
import ROUTES from '../../core/routes';
import '../../styles/pages/portal.css';

const pvr = `
  .pvr-root{min-height:100vh;background:var(--background);padding:14px 10px 32px;box-sizing:border-box}
  .pvr-wrap{max-width:1100px;margin:0 auto;display:flex;flex-direction:column;gap:12px;width:100%}
  .pvr-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg)}
  .pvr-header{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;padding:12px 14px}
  .pvr-brand{display:flex;align-items:center;gap:9px}
  .pvr-brand-title{font-weight:800;font-size:clamp(12px,3.8vw,17px);color:var(--text-primary);line-height:1.2}
  .pvr-brand-id{font-size:clamp(10px,2.4vw,12px);color:var(--text-secondary);margin-top:2px}
  .pvr-score-row{display:flex;gap:16px;align-items:center;flex-wrap:wrap;padding:18px 14px}
  .pvr-ring-wrap{text-align:center;flex-shrink:0}
  .pvr-ring{width:86px!important;height:86px!important}
  .pvr-ring .score-display-ring__val{font-size:clamp(12px,3.4vw,16px)!important;margin-top:-8px!important}
  .pvr-ring .score-display-ring__label{font-size:clamp(8px,2vw,10px)!important;bottom:12px!important;max-width:62px!important;line-height:1.15!important}
  .pvr-info{flex:1;min-width:0}
  .pvr-role{font-size:clamp(14px,4.2vw,20px);font-weight:700;color:var(--text-primary);line-height:1.3;word-break:break-word}
  .pvr-company{font-size:clamp(11px,2.8vw,13px);color:var(--text-secondary);margin-top:3px}
  .pvr-meta{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;padding-top:10px;border-top:1px solid var(--border)}
  .pvr-ml{font-size:clamp(10px,2.4vw,11px);color:var(--text-secondary);margin-bottom:2px}
  .pvr-mv{font-size:clamp(12px,3vw,14px);font-weight:600;color:var(--text-primary);word-break:break-word}
  .pvr-section{padding:14px}
  .pvr-sh{font-size:clamp(12px,3.4vw,15px);font-weight:700;color:var(--text-primary);margin-bottom:8px}
  .pvr-st{font-size:clamp(11px,2.9vw,13px);color:var(--text-primary);line-height:1.65;margin:0}
  .pvr-ti{padding:9px 11px;border-radius:var(--radius-md);border:1px solid var(--border);font-size:clamp(11px,2.8vw,13px);line-height:1.5;margin-bottom:7px}
  .pvr-ti:last-child{margin-bottom:0}
  .pvr-tr{font-weight:700;font-size:clamp(9px,2.1vw,10px);text-transform:uppercase;margin-bottom:3px}
  @keyframes pvr-spin{to{transform:rotate(360deg)}}
  .pvr-spinner{width:34px;height:34px;border:3px solid var(--border);border-top-color:var(--primary);border-radius:50%;animation:pvr-spin 1s linear infinite;margin:0 auto 12px}
  @media(min-width:768px){
    .pvr-root{padding:28px 24px 44px}
    .pvr-wrap{gap:16px}
    .pvr-header{padding:16px 24px}
    .pvr-score-row{padding:24px;gap:28px}
    .pvr-ring{width:116px!important;height:116px!important}
    .pvr-ring .score-display-ring__val{font-size:20px!important;margin-top:-10px!important}
    .pvr-ring .score-display-ring__label{font-size:11px!important;bottom:16px!important;max-width:85px!important}
    .pvr-section{padding:20px 24px}
  }
`;

export default function PublicReportVerify() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchPublicReport() {
      try {
        setLoading(true);
        setError(null);

        // When accessed from a phone/external device via LAN, use the backend directly on port 8000.
        // When on localhost (dev laptop), use relative URLs that go through the Vite proxy.
        const isExternalDevice = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
        const apiBase = isExternalDevice
          ? `${window.location.protocol}//${window.location.hostname}:8000/api/v1`
          : '/api/v1';

        const fetchWithTimeout = (url, timeoutMs = 10000) => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);
          return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
        };

        let sessionData = null;
        let scoreData = null;

        try {
          const sRes = await fetchWithTimeout(`${apiBase}/verify/${id}`);
          if (sRes.ok) {
            sessionData = await sRes.json();
          }
        } catch (e) {
          console.warn('Fetch verify endpoint error:', e);
        }

        try {
          const scRes = await fetchWithTimeout(`${apiBase}/score/${id}`);
          if (scRes.ok) {
            scoreData = await scRes.json();
          }
        } catch (e) {
          console.warn('Fetch score endpoint error:', e);
        }

        if (sessionData || scoreData) {
          const s = sessionData || {};
          const sc = (s.scores && s.scores[0]) || {};
          const metrics = scoreData?.metrics || {};
          const detailed = scoreData?.detailed_scores || [];
          const firstDetail = detailed[0] || {};
          const transcriptList = scoreData?.transcript || (s.interview && s.interview.transcript) || [];

          const avgScore = metrics.average_skill_score ?? sc.overall_skill_score ?? 0;
          const isZeroAnswer = metrics.questions_answered_count === 0 || (!metrics.average_skill_score && !sc.overall_skill_score);

          setReport({
            session_id: s.id || id,
            candidate_name: s.candidate_name || scoreData?.candidate_name || 'Candidate',
            candidate_email: s.candidate_email || scoreData?.candidate_email || '',
            intake_mode: s.intake_mode || scoreData?.intake_mode || 'certificate',
            created_at: s.created_at || new Date().toISOString(),
            extracted_skills: s.extracted_skills || [],
            extracted_role: s.extracted_role || 'Software Engineer',
            extracted_company: s.extracted_company,
            score: isZeroAnswer ? 0.0 : avgScore,
            verdict: isZeroAnswer ? 'UNVERIFIED_EARLY_EXIT' : (scoreData?.verdict || sc.verdict || 'PENDING_INTERVIEW'),
            explanation: isZeroAnswer 
              ? 'Assessment concluded early by candidate without submitting answers to technical questions.' 
              : (firstDetail.llm_reasoning || sc.llm_reasoning || scoreData?.explanation || 'Candidate completed technical verification.'),
            strengths: scoreData?.strengths || (s.interview?.skill_context?.strengths) || (isZeroAnswer ? ['Source document ingested'] : ['Technical Skill Proficiency']),
            improvements: scoreData?.improvements || (s.interview?.skill_context?.improvements) || (isZeroAnswer ? ['Complete technical interview drills'] : ['Advanced Optimization']),
            transcript: transcriptList,
            qr_verification_id: `SP-${(s.id || id).slice(0, 8).toUpperCase()}`
          });
        } else {
          setError('Verification record not found or server is unreachable.');
        }
      } catch (err) {
        console.error('Public report lookup failed:', err);
        setError('Verification session not found or link has expired.');
      } finally {
        setLoading(false);
      }
    }
    fetchPublicReport();
  }, [id]);

  if (loading) {
    return (
      <>
        <style>{pvr}</style>
        <div className="pvr-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 'clamp(12px,3vw,14px)' }}>
            <div className="pvr-spinner" />
            Loading Verification Report...
          </div>
        </div>
      </>
    );
  }

  if (error || !report) {
    return (
      <>
        <style>{pvr}</style>
        <div className="pvr-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', padding: '24px 18px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', textAlign: 'center', maxWidth: 400, width: '100%' }}>
            <Logo size={32} color="var(--primary)" />
            <h2 style={{ fontSize: 'clamp(14px,4vw,18px)', fontWeight: 700, margin: '14px 0 8px', color: 'var(--text-primary)' }}>Verification Record Not Found</h2>
            <p style={{ fontSize: 'clamp(11px,2.8vw,13px)', color: 'var(--text-secondary)', marginBottom: 18 }}>{error || 'This QR verification record does not exist or has expired.'}</p>
            <Link to={ROUTES.HOME} className="button button--primary">Go to Home Page</Link>
          </div>
        </div>
      </>
    );
  }

  const isEarlyExit = report.verdict === 'UNVERIFIED_EARLY_EXIT' || report.score === 0;

  return (
    <>
      <style>{pvr}</style>
      <div className="pvr-root">
        <div className="pvr-wrap">

          {/* Header */}
          <div className="pvr-card pvr-header">
            <div className="pvr-brand">
              <Logo size={26} color="var(--primary)" />
              <div>
                <div className="pvr-brand-title">SkillProof Official Verification</div>
                <div className="pvr-brand-id">ID: {report.qr_verification_id}</div>
              </div>
            </div>
            <StatusBadge variant="success">PUBLIC AUDIT VERIFIED</StatusBadge>
          </div>

          {/* Score Card */}
          <div className="pvr-card pvr-score-row">
            <div className="pvr-ring-wrap">
              <div
                className="score-display-ring pvr-ring"
                style={{
                  '--score-pct': Math.min(100, Math.max(0, report.score || 0)),
                  '--score-color': scoreColor(report.score),
                  margin: '0 auto 8px'
                }}
              >
                <span className="score-display-ring__val">{formatScore(report.score)}%</span>
                <span className="score-display-ring__label">{isEarlyExit ? 'Incomplete' : scoreLabel(report.score)}</span>
              </div>
              <StatusBadge variant={isEarlyExit ? 'warning' : report.verdict === 'FULLY_VERIFIED' ? 'success' : 'warning'}>
                {report.verdict.replace(/_/g, ' ')}
              </StatusBadge>
            </div>

            <div className="pvr-info">
              <div className="pvr-role">{report.extracted_role}</div>
              <div className="pvr-company">
                {report.extracted_company ? `Verified for ${report.extracted_company}` : 'Skill Evaluation'}
              </div>
              <div className="pvr-meta">
                <div>
                  <div className="pvr-ml">Candidate Name</div>
                  <div className="pvr-mv">{report.candidate_name}</div>
                </div>
                <div>
                  <div className="pvr-ml">Verified Date</div>
                  <div className="pvr-mv">{formatDate(report.created_at)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Evaluation Summary */}
          <div className="pvr-card pvr-section">
            <div className="pvr-sh">Evaluation Summary</div>
            <p className="pvr-st">{report.explanation}</p>
          </div>

          {/* Transcript */}
          {report.transcript && report.transcript.length > 0 && (
            <div className="pvr-card pvr-section">
              <div className="pvr-sh">Interview Transcript</div>
              {report.transcript.map((msg, idx) => (
                <div
                  key={idx}
                  className="pvr-ti"
                  style={{
                    background: msg.role === 'user' ? 'rgba(18,163,126,0.08)' : 'var(--surface-elevated)',
                    borderColor: msg.role === 'user' ? 'rgba(18,163,126,0.25)' : 'var(--border)'
                  }}
                >
                  <div className="pvr-tr" style={{ color: msg.role === 'user' ? 'var(--primary)' : 'var(--text-secondary)' }}>
                    {msg.role === 'user' ? 'Candidate' : 'AI Interviewer'}
                  </div>
                  <div style={{ color: 'var(--text-primary)' }}>{msg.content}</div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
