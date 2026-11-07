"""
app/controllers/drives.py
Placement drives: an organisation creates an assessment, shares an invite
code / link, candidates take the AI interview on exactly those skills, and the
organisation reviews a ranked, proctored shortlist.

Organisation (org JWT, approved org):
  POST   /api/v1/org/drives                                   create a drive
  GET    /api/v1/org/drives                                   list drives with counts
  GET    /api/v1/org/drives/{drive_id}                        drive + ranked candidates
  PATCH  /api/v1/org/drives/{drive_id}                        edit / open / close
  POST   /api/v1/org/drives/{drive_id}/candidates/{session_id}/decision
  GET    /api/v1/org/drives/{drive_id}/export.csv             ranked list as CSV

Candidate:
  GET    /api/v1/drives/invite/{code}                         public drive info (no login)
  POST   /api/v1/drives/invite/{code}/join                    start (or resume) the drive
  GET    /api/v1/drives/mine                                  drives the candidate joined
"""
import csv
import io
import secrets
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.controllers.org_portal import _summarise_session
from app.database import get_db
from app.models.biometric import BiometricProfile
from app.models.drive import DriveDecision, DriveStatus, PlacementDrive
from app.models.links import LinkStatus, UserOrganisationLink
from app.models.organisation import Organisation, OrgStatus
from app.models.session import VerificationSession
from app.models.user import User
from app.repositories import biometric_repo, session_repo
from app.schemas.session import VerificationSessionCreate
from app.security.deps import get_current_org, get_current_user
from app.services.ingestion_service import IngestionService

router = APIRouter(tags=["Placement Drives"])
_ingest = IngestionService()

# No 0/O/1/I so codes are easy to read out loud or type from a poster
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
_DONE = {"scored", "completed"}


# ─────────────────────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────────────────────

def _clean_skills(v: List[str]) -> List[str]:
    out, seen = [], set()
    for s in v or []:
        s = " ".join(str(s).split())[:60]
        if s and s.lower() not in seen:
            seen.add(s.lower())
            out.append(s)
    return out


class DriveCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    role: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = Field(None, max_length=4000)
    skills: List[str] = Field(..., min_length=1)
    deadline: Optional[datetime] = None
    min_score: Optional[float] = Field(None, ge=0, le=100)

    @field_validator("skills")
    @classmethod
    def _skills(cls, v):
        v = _clean_skills(v)
        if not v:
            raise ValueError("Add at least one skill.")
        if len(v) > 8:
            raise ValueError("A drive can cover at most 8 skills.")
        return v


class DriveUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=255)
    role: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = Field(None, max_length=4000)
    deadline: Optional[datetime] = None
    clear_deadline: bool = False
    min_score: Optional[float] = Field(None, ge=0, le=100)
    clear_min_score: bool = False
    status: Optional[DriveStatus] = None


class DecisionIn(BaseModel):
    decision: DriveDecision


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _is_accepting(drive) -> bool:
    if getattr(drive.status, "value", drive.status) != "open":
        return False
    deadline = _aware(drive.deadline)
    return deadline is None or deadline > _utcnow()


def _drive_dict(drive, stats: Optional[Dict[str, int]] = None) -> Dict[str, Any]:
    out = {
        "id": str(drive.id),
        "title": drive.title,
        "role": drive.role,
        "description": drive.description,
        "skills": list(drive.skills or []),
        "invite_code": drive.invite_code,
        "deadline": drive.deadline.isoformat() if drive.deadline else None,
        "min_score": drive.min_score,
        "status": getattr(drive.status, "value", drive.status),
        "accepting": _is_accepting(drive),
        "created_at": drive.created_at.isoformat() if drive.created_at else None,
    }
    if stats is not None:
        out.update(stats)
    return out


async def _new_invite_code(db: AsyncSession) -> str:
    for _ in range(10):
        code = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(8))
        taken = await db.execute(select(PlacementDrive.id).where(PlacementDrive.invite_code == code))
        if taken.scalar_one_or_none() is None:
            return code
    raise HTTPException(status_code=500, detail="Could not generate a unique invite code. Try again.")


async def _get_own_drive(db: AsyncSession, drive_id: UUID, org_id) -> PlacementDrive:
    res = await db.execute(select(PlacementDrive).where(PlacementDrive.id == drive_id))
    drive = res.scalar_one_or_none()
    if not drive or drive.org_id != org_id:
        raise HTTPException(status_code=404, detail="Drive not found.")
    return drive


async def load_drive_candidates(db: AsyncSession, drive_id) -> List[Dict[str, Any]]:
    """Every attempt at this drive with the candidate, score, verdict and proctoring."""
    res = await db.execute(
        select(VerificationSession)
        .where(VerificationSession.drive_id == drive_id)
        .options(selectinload(VerificationSession.scores), selectinload(VerificationSession.owner))
    )
    sessions = list(res.scalars().all())
    profiles: Dict[Any, Any] = {}
    if sessions:
        pres = await db.execute(
            select(BiometricProfile).where(BiometricProfile.session_id.in_([s.id for s in sessions]))
        )
        profiles = {p.session_id: p for p in pres.scalars().all()}

    rows = []
    for s in sessions:
        summary = _summarise_session(s, profiles.get(s.id))
        owner = s.owner
        rows.append({
            "session_id": summary["id"],
            "candidate_id": str(owner.id) if owner else None,
            "full_name": (owner.full_name if owner else None) or s.candidate_name or "Candidate",
            "email": (owner.email if owner else None) or s.candidate_email or "",
            "status": summary["status"],
            "score": summary["score"],
            "verdict": summary["verdict"],
            "integrity_score": summary["integrity"]["integrity_score"] if summary["integrity"] else None,
            "flagged": bool(summary["integrity"] and summary["integrity"]["interview_flagged"]),
            "decision": s.drive_decision or "pending",
            "started_at": summary["created_at"],
        })
    return rows


def rank_candidates(rows: List[Dict[str, Any]], min_score: Optional[float]) -> List[Dict[str, Any]]:
    """
    Completed attempts first, ordered by score (flagged attempts sink below
    clean ones with the same score); unfinished attempts last, newest first.
    """
    done = [r for r in rows if r["status"] in _DONE]
    pending = [r for r in rows if r["status"] not in _DONE]
    done.sort(key=lambda r: (r["score"] is None, -(r["score"] or 0), r["flagged"]))
    pending.sort(key=lambda r: r["started_at"] or "", reverse=True)

    out = []
    for i, r in enumerate(done, start=1):
        out.append({
            **r,
            "rank": i,
            "meets_min_score": None if min_score is None or r["score"] is None else r["score"] >= min_score,
        })
    for r in pending:
        out.append({**r, "rank": None, "meets_min_score": None})
    return out


def _stats(rows: List[Dict[str, Any]], min_score: Optional[float]) -> Dict[str, Any]:
    done = [r for r in rows if r["status"] in _DONE]
    scored = [r["score"] for r in done if r["score"] is not None]
    return {
        "joined": len(rows),
        "completed": len(done),
        "shortlisted": sum(1 for r in rows if r["decision"] == "shortlisted"),
        "passed": sum(1 for s in scored if min_score is not None and s >= min_score),
        "average_score": round(sum(scored) / len(scored), 1) if scored else None,
        "flagged": sum(1 for r in rows if r["flagged"]),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Organisation endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/org/drives", status_code=201, summary="Organisation: Create Placement Drive")
async def create_drive(
    payload: DriveCreate,
    current_org: Organisation = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    deadline = _aware(payload.deadline)
    if deadline is not None and deadline <= _utcnow():
        raise HTTPException(status_code=400, detail="The deadline must be in the future.")

    drive = PlacementDrive(
        org_id=current_org.id,
        title=payload.title.strip(),
        role=(payload.role or "").strip() or None,
        description=(payload.description or "").strip() or None,
        skills=payload.skills,
        deadline=deadline,
        min_score=payload.min_score,
        invite_code=await _new_invite_code(db),
        status=DriveStatus.open,
    )
    db.add(drive)
    await db.flush()
    await db.refresh(drive)
    await db.commit()
    return _drive_dict(drive, _stats([], drive.min_score))


@router.get("/org/drives", summary="Organisation: List Placement Drives")
async def list_drives(
    current_org: Organisation = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(PlacementDrive)
        .where(PlacementDrive.org_id == current_org.id)
        .order_by(PlacementDrive.created_at.desc())
    )
    drives = list(res.scalars().all())
    out = []
    for d in drives:
        rows = await load_drive_candidates(db, d.id)
        out.append(_drive_dict(d, _stats(rows, d.min_score)))
    return out


@router.get("/org/drives/{drive_id}", summary="Organisation: Drive Detail & Ranked Candidates")
async def get_drive(
    drive_id: UUID,
    current_org: Organisation = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    drive = await _get_own_drive(db, drive_id, current_org.id)
    rows = await load_drive_candidates(db, drive.id)
    return {
        **_drive_dict(drive, _stats(rows, drive.min_score)),
        "candidates": rank_candidates(rows, drive.min_score),
    }


@router.patch("/org/drives/{drive_id}", summary="Organisation: Update Placement Drive")
async def update_drive(
    drive_id: UUID,
    payload: DriveUpdate,
    current_org: Organisation = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    drive = await _get_own_drive(db, drive_id, current_org.id)
    if payload.title is not None:
        drive.title = payload.title.strip()
    if payload.role is not None:
        drive.role = payload.role.strip() or None
    if payload.description is not None:
        drive.description = payload.description.strip() or None
    if payload.clear_deadline:
        drive.deadline = None
    elif payload.deadline is not None:
        drive.deadline = _aware(payload.deadline)
    if payload.clear_min_score:
        drive.min_score = None
    elif payload.min_score is not None:
        drive.min_score = payload.min_score
    if payload.status is not None:
        drive.status = payload.status
    db.add(drive)
    await db.flush()
    await db.refresh(drive)
    await db.commit()
    rows = await load_drive_candidates(db, drive.id)
    return _drive_dict(drive, _stats(rows, drive.min_score))


@router.post(
    "/org/drives/{drive_id}/candidates/{session_id}/decision",
    summary="Organisation: Shortlist / Reject a Drive Candidate",
)
async def set_decision(
    drive_id: UUID,
    session_id: UUID,
    payload: DecisionIn,
    current_org: Organisation = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    drive = await _get_own_drive(db, drive_id, current_org.id)
    session = await session_repo.get_session(db, session_id)
    if not session or session.drive_id != drive.id:
        raise HTTPException(status_code=404, detail="This candidate has not joined this drive.")
    previous = session.drive_decision
    session.drive_decision = payload.decision.value
    db.add(session)
    await db.commit()

    # Tell the candidate when they are shortlisted (not on reject: the
    # organisation communicates that in its own way)
    if payload.decision == DriveDecision.shortlisted and previous != DriveDecision.shortlisted.value:
        try:
            from app.services import email_service
            email_service.notify_shortlisted(
                getattr(session, "candidate_email", None), getattr(session, "candidate_name", None),
                drive.title, getattr(current_org, "name", None),
            )
        except Exception as mail_err:
            print(f"[Drives] Shortlist email skipped: {mail_err}")

    return {"session_id": str(session_id), "decision": payload.decision.value}


@router.get("/org/drives/{drive_id}/export.csv", summary="Organisation: Export Drive Results (CSV)")
async def export_drive(
    drive_id: UUID,
    current_org: Organisation = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    drive = await _get_own_drive(db, drive_id, current_org.id)
    ranked = rank_candidates(await load_drive_candidates(db, drive.id), drive.min_score)

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Rank", "Name", "Email", "Status", "Score", "Verdict", "Integrity", "Flagged", "Meets pass mark", "Decision", "Started"])
    for r in ranked:
        w.writerow([
            r["rank"] or "", _csv_safe(r["full_name"]), _csv_safe(r["email"]), r["status"],
            "" if r["score"] is None else r["score"], r["verdict"] or "",
            "" if r["integrity_score"] is None else r["integrity_score"],
            "yes" if r["flagged"] else "no",
            "" if r["meets_min_score"] is None else ("yes" if r["meets_min_score"] else "no"),
            r["decision"], (r["started_at"] or "")[:10],
        ])
    filename = f"drive-{drive.invite_code}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _csv_safe(value: str) -> str:
    """Stop names like '=HYPERLINK(...)' running as formulas when opened in Excel."""
    value = value or ""
    return "'" + value if value[:1] in ("=", "+", "-", "@", "\t", "\r") else value


# ─────────────────────────────────────────────────────────────────────────────
# Candidate endpoints
# ─────────────────────────────────────────────────────────────────────────────

async def _drive_by_code(db: AsyncSession, code: str):
    res = await db.execute(
        select(PlacementDrive)
        .where(PlacementDrive.invite_code == code.strip().upper())
        .options(selectinload(PlacementDrive.organisation))
    )
    drive = res.scalar_one_or_none()
    if not drive or not drive.organisation or drive.organisation.status != OrgStatus.approved:
        raise HTTPException(status_code=404, detail="No drive found for this invite code.")
    return drive


@router.get("/drives/invite/{code}", summary="Public: Placement Drive Info")
async def get_invite(code: str, db: AsyncSession = Depends(get_db)):
    drive = await _drive_by_code(db, code)
    # Public view: no invite stats, pass mark or internal IDs beyond what's needed
    return {
        "title": drive.title,
        "role": drive.role,
        "description": drive.description,
        "skills": list(drive.skills or []),
        "deadline": drive.deadline.isoformat() if drive.deadline else None,
        "accepting": _is_accepting(drive),
        "organisation": {"name": drive.organisation.name, "org_type": getattr(drive.organisation.org_type, "value", None)},
        "invite_code": drive.invite_code,
    }


@router.post("/drives/invite/{code}/join", summary="Candidate: Join a Placement Drive")
async def join_drive(
    code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    drive = await _drive_by_code(db, code)

    # One attempt per candidate per drive: rejoining resumes the same session,
    # so a candidate can't retake the interview until they get a better score.
    existing = await db.execute(
        select(VerificationSession).where(
            VerificationSession.drive_id == drive.id,
            VerificationSession.owner_id == current_user.id,
        )
    )
    session = existing.scalars().first()
    if session:
        return {"session_id": str(session.id), "status": getattr(session.status, "value", session.status), "resumed": True}

    if not _is_accepting(drive):
        raise HTTPException(status_code=400, detail="This drive is no longer accepting candidates.")

    # Joining a drive is the candidate's explicit consent to share results with
    # this organisation, so the connection is approved straight away.
    link_res = await db.execute(
        select(UserOrganisationLink).where(
            UserOrganisationLink.user_id == current_user.id,
            UserOrganisationLink.org_id == drive.org_id,
        )
    )
    link = link_res.scalar_one_or_none()
    if link is None:
        db.add(UserOrganisationLink(
            user_id=current_user.id, org_id=drive.org_id,
            status=LinkStatus.approved, shared_session_ids=[],
        ))
    elif link.status != LinkStatus.approved:
        link.status = LinkStatus.approved
        db.add(link)

    session = await session_repo.create_session(
        db,
        VerificationSessionCreate(
            intake_mode="skill_only",
            candidate_name=current_user.full_name,
            candidate_email=current_user.email,
        ),
        owner_id=current_user.id,
    )

    # Same biometric sync the normal /ingest flow does
    if current_user.face_embedding or current_user.voice_embedding:
        await biometric_repo.create_or_update_profile(
            db, session_id=session.id,
            face_embedding=current_user.face_embedding,
            voice_embedding=current_user.voice_embedding,
        )

    skills = list(drive.skills or [])
    await _ingest.ingest_skill_only(db, session.id, ", ".join(skills), drive.role or ", ".join(skills))

    # Interview exactly the skills the organisation chose (no vocabulary rewrite)
    session.extracted_skills = skills
    session.drive_id = drive.id
    session.drive_decision = DriveDecision.pending.value
    db.add(session)
    await db.commit()

    return {"session_id": str(session.id), "status": "ocr_done", "resumed": False}


@router.get("/drives/mine", summary="Candidate: My Placement Drives")
async def my_drives(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(VerificationSession, PlacementDrive)
        .join(PlacementDrive, VerificationSession.drive_id == PlacementDrive.id)
        .where(VerificationSession.owner_id == current_user.id)
        .options(selectinload(PlacementDrive.organisation))
        .order_by(VerificationSession.created_at.desc())
    )
    out = []
    for s, d in res.all():
        decision = s.drive_decision or "pending"
        out.append({
            "session_id": str(s.id),
            "status": getattr(s.status, "value", s.status),
            "drive_title": d.title,
            "role": d.role,
            "skills": list(d.skills or []),
            "organisation": d.organisation.name if d.organisation else None,
            "deadline": d.deadline.isoformat() if d.deadline else None,
            # The candidate sees "shortlisted" once decided; a rejection stays
            # "under review" so the organisation can tell them in its own way.
            "decision": "shortlisted" if decision == "shortlisted" else "under_review",
            "joined_at": s.created_at.isoformat() if s.created_at else None,
        })
    return out
