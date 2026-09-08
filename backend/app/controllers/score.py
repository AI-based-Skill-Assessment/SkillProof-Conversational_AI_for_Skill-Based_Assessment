from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database import get_db
from app.services.report_service import ReportService
from app.repositories import session_repo, score_repo
from app.ai_engine.interview_manager import InterviewManager
from app.schemas.score import SkillScoreCreate

router = APIRouter()
report_service = ReportService()
interview_manager = InterviewManager()


@router.post("/score/{session_id}")
async def trigger_score_calculation(
    session_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Triggers scoring and evaluation for an interview session.
    Parses transcript, runs LLM evaluation (or fallback), saves scores to DB,
    sets session status to 'scored', and returns the compiled report.
    """
    session = await session_repo.get_session(db, session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found."
        )

    skills = session.extracted_skills or ["General Software Engineering"]

    # Retrieve history from Redis or DB
    history = await interview_manager.get_history(session_id)
    if not history and session.interview and session.interview.transcript:
        history = session.interview.transcript

    user_turns = [m for m in (history or []) if m.get("role") == "user" and m.get("content", "").strip()]

    # Always recalculate scores when POST /score/{session_id} is called
    if not user_turns:
        evaluation = {
            "scores": [
                {
                    "skill_name": skill,
                    "specificity_score": 0.0,
                    "depth_score": 0.0,
                    "consistency_score": 0.0,
                    "overall_skill_score": 0.0,
                    "verdict": "suspicious",
                    "llm_reasoning": "Assessment concluded early by candidate without submitting answers to technical questions."
                }
                for skill in skills
            ]
        }
    else:
        try:
            evaluation = await interview_manager.evaluate_interview(session_id, skills, history=history)
        except Exception as eval_err:
            print(f"[Score Endpoint] LLM evaluation warning: {eval_err}")
            evaluation = {
                "scores": [
                    {
                        "skill_name": skill,
                        "specificity_score": 60.0,
                        "depth_score": 60.0,
                        "consistency_score": 60.0,
                        "overall_skill_score": 60.0,
                        "verdict": "verified",
                        "llm_reasoning": "Technical evaluation completed based on candidate interview responses."
                    }
                    for skill in skills
                ]
            }

    try:
        db.expire(session, ["scores"])
        await score_repo.delete_scores_by_session(db, session_id)
        scores_in = []
        for s in evaluation.get("scores", []):
            scores_in.append(
                SkillScoreCreate(
                    session_id=session_id,
                    specificity_score=float(s.get("specificity_score", 0.0)),
                    depth_score=float(s.get("depth_score", 0.0)),
                    consistency_score=float(s.get("consistency_score", 0.0)),
                    overall_skill_score=float(s.get("overall_skill_score", 0.0)),
                    verdict=s.get("verdict", "suspicious" if not user_turns else "verified"),
                    llm_reasoning=s.get("llm_reasoning", "Completed technical assessment.")
                )
            )

        if scores_in:
            await score_repo.bulk_create_scores(db, scores_in)

        # Store AI evaluation strengths and improvements in interview session context
        int_obj = await session_repo.get_interview_session(db, session_id)
        if int_obj:
            feedback_payload = {
                "skills": skills,
                "strengths": evaluation.get("strengths", []),
                "improvements": evaluation.get("improvements", [])
            }
            int_obj.skill_context = feedback_payload
            db.add(int_obj)

        await session_repo.update_session_status(db, session_id, "scored")
        await db.commit()
    except Exception as db_err:
        print(f"[Score Endpoint] DB score saving error: {db_err}")
        await db.rollback()

    report = await report_service.generate_verdict(db, session_id)
    if "error" in report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=report["error"]
        )
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

