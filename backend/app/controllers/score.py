from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional

from app.database import get_db
from app.security.deps import get_current_user_optional, ensure_session_access
from app.models.user import User
from app.services.report_service import ReportService
from app.repositories import session_repo, score_repo
from app.ai_engine.interview_manager import InterviewManager, ScoringUnavailable
from app.schemas.score import SkillScoreCreate

router = APIRouter()
report_service = ReportService()
interview_manager = InterviewManager()


@router.post("/score/{session_id}")
async def trigger_score_calculation(
    session_id: UUID,
    force: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Scores an interview session (the ONLY place scoring happens) and returns
    the compiled report. Only the session's owner can score an owned session.

    - Already scored: returns the existing report unchanged. Pass ?force=true to
      deliberately re-score.
    - AI scoring temporarily unavailable (e.g. Groq rate limit after retries):
      returns 503 and saves nothing, so the client can simply try again. A fake
      grade is never stored.

    GET /score/{id} stays public so the QR / public report verification page works.
    """
    await ensure_session_access(db, session_id, current_user)

    session = await session_repo.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session {session_id} not found.")

    already_scored = getattr(session.status, "value", session.status) == "scored" and bool(session.scores)
    if already_scored and not force:
        return await _report_or_404(db, session_id)

    try:
        await score_session(db, session)
    except ScoringUnavailable as e:
        print(f"[Score Endpoint] Scoring unavailable for {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI scoring is busy right now. Your answers are saved; please try again in a minute.",
        )

    return await _report_or_404(db, session_id)


async def score_session(db: AsyncSession, session) -> None:
    """
    Run the AI evaluation for a session and save per-skill scores, strengths,
    improvements and per-answer feedback. Raises ScoringUnavailable (saving
    nothing) if the AI could not score it.
    """
    session_id = session.id
    _declared = (session.extracted_role or "").strip()
    skills = (
        session.extracted_skills
        or ([_declared.title()] if _declared and _declared.lower() not in ("candidate", "software developer") else None)
        or ["General Software Engineering"]
    )

    history = await interview_manager.get_history(session_id)
    if not history and session.interview and session.interview.transcript:
        history = session.interview.transcript

    user_turns = [m for m in (history or []) if m.get("role") == "user" and str(m.get("content", "")).strip()]

    if not user_turns:
        # Nothing was answered: a zero score is the honest result, no AI needed
        evaluation = {
            "scores": [
                {
                    "skill_name": skill,
                    "specificity_score": 0.0,
                    "depth_score": 0.0,
                    "consistency_score": 0.0,
                    "overall_skill_score": 0.0,
                    "verdict": "suspicious",
                    "llm_reasoning": "Assessment concluded early by candidate without submitting answers to technical questions.",
                }
                for skill in skills
            ]
        }
    else:
        evaluation = await interview_manager.evaluate_interview(session_id, skills, history=history)
        if not evaluation.get("scores"):
            raise ScoringUnavailable("No scores were produced.")

    db.expire(session, ["scores"])
    await score_repo.delete_scores_by_session(db, session_id)
    await score_repo.bulk_create_scores(db, [
        SkillScoreCreate(
            session_id=session_id,
            skill_name=s.get("skill_name"),
            specificity_score=float(s.get("specificity_score", 0.0)),
            depth_score=float(s.get("depth_score", 0.0)),
            consistency_score=float(s.get("consistency_score", 0.0)),
            overall_skill_score=float(s.get("overall_skill_score", 0.0)),
            verdict=s.get("verdict", "suspicious"),
            llm_reasoning=s.get("llm_reasoning", "Completed technical assessment."),
        )
        for s in evaluation["scores"]
    ])

    int_obj = await session_repo.get_interview_session(db, session_id)
    if int_obj:
        int_obj.skill_context = {
            "skills": skills,
            "strengths": evaluation.get("strengths", []),
            "improvements": evaluation.get("improvements", []),
            "answer_feedback": evaluation.get("answer_feedback", []),
            "simulated": bool(evaluation.get("simulated")),
        }
        db.add(int_obj)

    await session_repo.update_session_status(db, session_id, "scored")
    await db.commit()

    # Email notifications (background; never affects scoring)
    if user_turns and not evaluation.get("simulated"):
        try:
            await _notify_scored(db, session, skills, evaluation["scores"])
        except Exception as mail_err:
            print(f"[Score] Notification skipped: {mail_err}")


async def _notify_scored(db: AsyncSession, session, skills, scores) -> None:
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.models.drive import PlacementDrive
    from app.services import email_service

    numeric = [float(s.get("overall_skill_score", 0.0)) for s in scores]
    avg = round(sum(numeric) / len(numeric), 1) if numeric else None

    email_service.notify_results_ready(session.candidate_email, session.candidate_name, session.id, skills, avg)

    drive_id = getattr(session, "drive_id", None)
    if drive_id:
        res = await db.execute(
            select(PlacementDrive).where(PlacementDrive.id == drive_id).options(selectinload(PlacementDrive.organisation))
        )
        drive = res.scalar_one_or_none()
        if drive and drive.organisation:
            email_service.notify_drive_completion(
                drive.organisation.email, drive.organisation.name, drive.id, drive.title,
                session.candidate_name, avg,
            )


async def _report_or_404(db: AsyncSession, session_id: UUID):
    report = await report_service.generate_verdict(db, session_id)
    if "error" in report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=report["error"])
    return report


@router.get("/score/{session_id}")
async def get_session_scorecard(
    session_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve compiled internship skill verification report, including overall verdict, 
    parsed metrics, and turn-based AI interview evaluation comments.
    """
    report = await report_service.generate_verdict(db, session_id)
    if "error" in report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=report["error"]
        )
    return report

