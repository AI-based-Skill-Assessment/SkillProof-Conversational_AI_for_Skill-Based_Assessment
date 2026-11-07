"""
app/controllers/org_portal.py
Real data for the organisation portal (replaces the frontend mock data).

  GET /api/v1/org/candidates                 → connected candidates with real stats
  GET /api/v1/org/candidates/{candidate_id}  → one candidate + their assessments & proctoring
  GET /api/v1/org/reports                    → every scored assessment of connected candidates
  GET /api/v1/org/analytics                  → verdict distribution, monthly trend, top skills

Visibility rule: an organisation sees a candidate's assessments only while the
candidate's connection to that organisation is APPROVED. The candidate starts
that connection themselves, so it is their consent; revoking or rejecting the
link removes access immediately.
"""
from collections import Counter
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.biometric import BiometricProfile
from app.models.links import LinkStatus, UserOrganisationLink
from app.models.organisation import Organisation
from app.models.session import VerificationSession
from app.security.deps import get_current_org

router = APIRouter(prefix="/org", tags=["Organisation Portal"])

# Worst verdict wins when a session has several per-skill scores
_VERDICT_RANK = {"verified": 0, "suspicious": 1, "likely_fraudulent": 2}
_DONE_STATUSES = {"scored", "completed"}


def _val(enum_or_str) -> Optional[str]:
    if enum_or_str is None:
        return None
    return getattr(enum_or_str, "value", str(enum_or_str))


def _iso(dt) -> str:
    return dt.isoformat() if dt else ""


def _summarise_session(s, profile) -> Dict[str, Any]:
    """Turn a VerificationSession (+ its BiometricProfile) into a plain dict."""
    scores = list(getattr(s, "scores", None) or [])
    numeric = [sc.overall_skill_score for sc in scores if sc.overall_skill_score is not None]
    avg = round(sum(numeric) / len(numeric), 1) if numeric else None

    verdicts = [_val(sc.verdict) for sc in scores if sc.verdict is not None]
    verdict = max(verdicts, key=lambda v: _VERDICT_RANK.get(v, 1)) if verdicts else None

    integrity = None
    if profile is not None:
        integrity = {
            "integrity_score": round(profile.integrity_score or 0.0, 1),
            "fraud_status": profile.fraud_status or "clean",
            "interview_flagged": bool(profile.interview_flagged),
            "flag_reasons": profile.flag_reasons or [],
            "tab_switch_count": profile.tab_switch_count or 0,
            "window_blur_count": profile.window_blur_count or 0,
            "copy_paste_attempts": profile.copy_paste_attempts or 0,
            "gaze_violations": profile.gaze_violations or 0,
            "camera_interruptions": profile.camera_interruptions or 0,
            "face_mismatch_count": profile.face_mismatch_count or 0,
            "voice_mismatch_count": profile.voice_mismatch_count or 0,
            "secondary_speaker_count": profile.secondary_speaker_count or 0,
            "face_verify_pass": profile.face_verify_pass or 0,
            "voice_verify_pass": profile.voice_verify_pass or 0,
            "face_duplicate_detected": bool(profile.face_duplicate_detected),
            "voice_duplicate_detected": bool(profile.voice_duplicate_detected),
        }

    return {
        "id": str(s.id),
        "status": _val(s.status) or "pending",
        "intake_mode": _val(s.intake_mode) or "certificate",
        "skills": list(s.extracted_skills or []),
        "role": s.extracted_role,
        "company": s.extracted_company,
        "created_at": _iso(s.created_at),
        "score": avg,
        "verdict": verdict,
        "skill_scores": [
            {
                "overall": sc.overall_skill_score,
                "depth": sc.depth_score,
                "specificity": sc.specificity_score,
                "consistency": sc.consistency_score,
                "verdict": _val(sc.verdict),
            }
            for sc in scores
        ],
        "integrity": integrity,
    }


async def load_connected_candidates(db: AsyncSession, org_id: UUID) -> List[Dict[str, Any]]:
    """
    All candidates with an APPROVED link to this organisation, each with their
    assessments (newest first). Three queries in total, regardless of size.
    """
    links_res = await db.execute(
        select(UserOrganisationLink)
        .where(
            UserOrganisationLink.org_id == org_id,
            UserOrganisationLink.status == LinkStatus.approved,
        )
        .options(selectinload(UserOrganisationLink.user))
    )
    links = [l for l in links_res.scalars().all() if l.user is not None]
    if not links:
        return []

    user_ids = [l.user_id for l in links]
    sess_res = await db.execute(
        select(VerificationSession)
        .where(VerificationSession.owner_id.in_(user_ids))
        .options(selectinload(VerificationSession.scores))
        .order_by(VerificationSession.created_at.desc())
    )
    sessions = list(sess_res.scalars().all())

    profiles: Dict[Any, Any] = {}
    if sessions:
        prof_res = await db.execute(
            select(BiometricProfile).where(
                BiometricProfile.session_id.in_([s.id for s in sessions])
            )
        )
        profiles = {p.session_id: p for p in prof_res.scalars().all()}

    by_owner: Dict[Any, List[Dict[str, Any]]] = {uid: [] for uid in user_ids}
    for s in sessions:
        by_owner.setdefault(s.owner_id, []).append(_summarise_session(s, profiles.get(s.id)))

    out = []
    for l in links:
        u = l.user
        out.append({
            "id": str(u.id),
            "link_id": str(l.id),
            "full_name": u.full_name,
            "email": u.email,
            "connected_at": _iso(l.connected_at),
            "face_registered": bool(u.face_registered),
            "voice_registered": bool(u.voice_registered),
            "assessments": by_owner.get(u.id, []),
        })
    return out


def _candidate_summary(c: Dict[str, Any]) -> Dict[str, Any]:
    assessments = c["assessments"]
    scored = [a for a in assessments if a["score"] is not None]
    integrities = [a["integrity"]["integrity_score"] for a in assessments if a["integrity"]]
    latest = assessments[0] if assessments else None
    return {
        "id": c["id"],
        "link_id": c["link_id"],
        "full_name": c["full_name"],
        "email": c["email"],
        "connected_at": c["connected_at"],
        "face_registered": c["face_registered"],
        "voice_registered": c["voice_registered"],
        "assessments_count": len(assessments),
        "completed_count": sum(1 for a in assessments if a["status"] in _DONE_STATUSES),
        "average_score": round(sum(a["score"] for a in scored) / len(scored), 1) if scored else None,
        "latest_status": latest["status"] if latest else None,
        "latest_verdict": latest["verdict"] if latest else None,
        "integrity_score": min(integrities) if integrities else None,
        "flagged": any(a["integrity"] and a["integrity"]["interview_flagged"] for a in assessments),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/candidates", summary="Organisation: Connected Candidates")
async def list_connected_candidates(
    current_org: Organisation = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    candidates = await load_connected_candidates(db, current_org.id)
    return [_candidate_summary(c) for c in candidates]


@router.get("/candidates/{candidate_id}", summary="Organisation: Candidate Detail")
async def get_connected_candidate(
    candidate_id: UUID,
    current_org: Organisation = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    candidates = await load_connected_candidates(db, current_org.id)
    match = next((c for c in candidates if c["id"] == str(candidate_id)), None)
    if not match:
        # Same response whether the user doesn't exist or just isn't connected,
        # so an org can't probe for other organisations' candidates.
        raise HTTPException(status_code=404, detail="Candidate not found or not connected to your organisation.")
    return {**_candidate_summary(match), "assessments": match["assessments"]}


@router.get("/reports", summary="Organisation: Assessment Reports")
async def list_org_reports(
    current_org: Organisation = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    candidates = await load_connected_candidates(db, current_org.id)
    reports = []
    for c in candidates:
        for a in c["assessments"]:
            if a["status"] not in _DONE_STATUSES:
                continue
            reports.append({
                "id": a["id"],
                "candidate_id": c["id"],
                "candidate_name": c["full_name"],
                "candidate_email": c["email"],
                "assessment_type": a["intake_mode"],
                "skills": a["skills"],
                "score": a["score"],
                "verdict": a["verdict"],
                "integrity_score": a["integrity"]["integrity_score"] if a["integrity"] else None,
                "flagged": bool(a["integrity"] and a["integrity"]["interview_flagged"]),
                "created_at": a["created_at"],
            })
    reports.sort(key=lambda r: r["created_at"], reverse=True)
    return reports


@router.get("/analytics", summary="Organisation: Analytics")
async def get_org_analytics(
    current_org: Organisation = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    candidates = await load_connected_candidates(db, current_org.id)
    assessments = [a for c in candidates for a in c["assessments"]]
    completed = [a for a in assessments if a["status"] in _DONE_STATUSES]
    scored = [a for a in completed if a["score"] is not None]

    verdicts = Counter(a["verdict"] or "unscored" for a in completed)
    in_progress = len(assessments) - len(completed)

    # Assessments completed per month (YYYY-MM), oldest first
    months = Counter(a["created_at"][:7] for a in completed if a["created_at"])

    # Skills from completed assessments, counted once per candidate
    skill_candidates: Dict[str, set] = {}
    for c in candidates:
        for a in c["assessments"]:
            if a["status"] in _DONE_STATUSES and a["verdict"] == "verified":
                for sk in a["skills"]:
                    skill_candidates.setdefault(sk, set()).add(c["id"])
    top_skills = sorted(
        ({"skill": k, "count": len(v)} for k, v in skill_candidates.items()),
        key=lambda x: (-x["count"], x["skill"]),
    )[:8]

    buckets = {"0-39": 0, "40-59": 0, "60-74": 0, "75-89": 0, "90-100": 0}
    for a in scored:
        s = a["score"]
        key = "90-100" if s >= 90 else "75-89" if s >= 75 else "60-74" if s >= 60 else "40-59" if s >= 40 else "0-39"
        buckets[key] += 1

    return {
        "totals": {
            "candidates": len(candidates),
            "assessments": len(assessments),
            "completed": len(completed),
            "in_progress": in_progress,
            "flagged": sum(1 for a in assessments if a["integrity"] and a["integrity"]["interview_flagged"]),
            "average_score": round(sum(a["score"] for a in scored) / len(scored), 1) if scored else None,
        },
        "verification_distribution": [
            {"label": "Verified", "key": "verified", "value": verdicts.get("verified", 0)},
            {"label": "Suspicious", "key": "suspicious", "value": verdicts.get("suspicious", 0)},
            {"label": "Likely fraudulent", "key": "likely_fraudulent", "value": verdicts.get("likely_fraudulent", 0)},
            {"label": "In progress", "key": "in_progress", "value": in_progress},
        ],
        "completion_trend": [{"month": m, "count": months[m]} for m in sorted(months)][-12:],
        "score_distribution": [{"range": k, "count": v} for k, v in buckets.items()],
        "top_skills": top_skills,
    }
