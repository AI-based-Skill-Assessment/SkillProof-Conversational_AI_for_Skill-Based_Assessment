from typing import List, Optional, Any
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.session import VerificationSession, IntakeMode, SessionStatus
from app.models.interview import InterviewSession, InterviewStatus
from app.schemas.session import VerificationSessionCreate, VerificationSessionUpdate


async def get_session(db: AsyncSession, session_id: UUID) -> Optional[VerificationSession]:
    """Retrieve verification session with document, interview, and score relations preloaded."""
    stmt = (
        select(VerificationSession)
        .where(VerificationSession.id == session_id)
        .options(
            selectinload(VerificationSession.document),
            selectinload(VerificationSession.interview),
            selectinload(VerificationSession.scores)
        )
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_session_by_email(db: AsyncSession, email: str) -> Optional[VerificationSession]:
    """Retrieve the first verification session matching the candidate email."""
    stmt = select(VerificationSession).where(VerificationSession.candidate_email == email)
    result = await db.execute(stmt)
    return result.scalars().first()



async def create_session(db: AsyncSession, session_in: VerificationSessionCreate) -> VerificationSession:
    """Create a new verification session in the database."""
    # Resolve intake mode enum
    mode = IntakeMode.certificate
    if session_in.intake_mode == "skill_only":
        mode = IntakeMode.skill_only

    session = VerificationSession(
        intake_mode=mode,
        candidate_name=session_in.candidate_name,
        candidate_email=session_in.candidate_email,
        certificate_filename=session_in.certificate_filename,
        status=SessionStatus.pending
    )
    db.add(session)
    await db.flush()
    await db.refresh(session)
    return session


async def update_session_status(db: AsyncSession, session_id: UUID, status: str) -> Optional[VerificationSession]:
    """Update verification session status (mapping legacy statuses to proper enums if needed)."""
    session = await get_session(db, session_id)
    if session:
        # Map strings to SessionStatus enum
        status_map = {
            "pending": SessionStatus.pending,
            "ocr_done": SessionStatus.ocr_done,
            "verified": SessionStatus.verified,
            "interview_done": SessionStatus.interview_done,
            "scored": SessionStatus.scored,
            # Legacy mapping for backwards-compatibility:
            "verifying": SessionStatus.ocr_done,
            "interviewing": SessionStatus.verified,
            "completed": SessionStatus.scored,
            "failed": SessionStatus.scored
        }
        session.status = status_map.get(status, SessionStatus.pending)
        db.add(session)
        await db.flush()
        await db.refresh(session)
    return session


async def update_session_metadata(
    db: AsyncSession, 
    session_id: UUID, 
    update_data: VerificationSessionUpdate
) -> Optional[VerificationSession]:
    """Update extracted OCR metadata fields on the session."""
    session = await get_session(db, session_id)
    if session:
        if update_data.status is not None:
            # Map using status_map
            status_map = {
                "pending": SessionStatus.pending,
                "ocr_done": SessionStatus.ocr_done,
                "verified": SessionStatus.verified,
                "interview_done": SessionStatus.interview_done,
                "scored": SessionStatus.scored,
                "verifying": SessionStatus.ocr_done,
                "interviewing": SessionStatus.verified,
                "completed": SessionStatus.scored,
                "failed": SessionStatus.scored
            }
            session.status = status_map.get(update_data.status, session.status)
        if update_data.extracted_company is not None:
            session.extracted_company = update_data.extracted_company
        if update_data.extracted_role is not None:
            session.extracted_role = update_data.extracted_role
        if update_data.extracted_skills is not None:
            session.extracted_skills = update_data.extracted_skills
        if update_data.extracted_verify_url is not None:
            session.extracted_verify_url = update_data.extracted_verify_url
        if update_data.raw_ocr_text is not None:
            session.raw_ocr_text = update_data.raw_ocr_text
        
        db.add(session)
        await db.flush()
        await db.refresh(session)
    return session


async def list_sessions(db: AsyncSession, skip: int = 0, limit: int = 100) -> List[VerificationSession]:
    """List all sessions with offset and limit."""
    stmt = (
        select(VerificationSession)
        .options(
            selectinload(VerificationSession.document),
            selectinload(VerificationSession.interview),
            selectinload(VerificationSession.scores)
        )
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


# --- Interview Session Database CRUD Operations ---

async def get_interview_session(db: AsyncSession, session_id: UUID) -> Optional[InterviewSession]:
    """Retrieve interview session details by session_id."""
    stmt = select(InterviewSession).where(InterviewSession.session_id == session_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_interview_session(db: AsyncSession, session_id: UUID, skill_context: list = None) -> InterviewSession:
    """Create an interview session linked to a verification session."""
    interview = InterviewSession(
        session_id=session_id,
        skill_context=skill_context or [],
        transcript=[],
        question_count=0,
        status=InterviewStatus.active
    )
    db.add(interview)
    await db.flush()
    await db.refresh(interview)
    return interview


async def update_interview_session(
    db: AsyncSession,
    session_id: UUID,
    transcript: list,
    status: str,
    question_count: int,
    skill_context: list = None
) -> Optional[InterviewSession]:
    """Update interview session details."""
    interview = await get_interview_session(db, session_id)
    if interview:
        interview.transcript = transcript
        # Map string status to InterviewStatus enum
        status_map = {
            "active": InterviewStatus.active,
            "completed": InterviewStatus.completed,
            "abandoned": InterviewStatus.abandoned,
            # Legacy support
            "not_started": InterviewStatus.active,
            "interrupted": InterviewStatus.abandoned
        }
        interview.status = status_map.get(status, InterviewStatus.active)
        interview.question_count = question_count
        if skill_context is not None:
            interview.skill_context = skill_context
            
        db.add(interview)
        await db.flush()
        await db.refresh(interview)
    return interview
