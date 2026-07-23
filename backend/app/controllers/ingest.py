from typing import Annotated, Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.session import VerificationSessionCreate, VerificationSessionResponse
from app.repositories import session_repo
from app.services.ingestion_service import IngestionService

router = APIRouter()
ingest_service = IngestionService()


@router.post(
    "/ingest",
    response_model=VerificationSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest Certificate or Declare Skills",
    description=(
        "**Path A (Certificate):** Upload a PDF/image file of your internship/course certificate. "
        "The system runs OCR to extract company, role, skills, and verification URL.\n\n"
        "**Path B (Skill-only):** Provide your skills as plain text with a target role — no file needed."
    )
)
async def ingest_credentials(
    candidate_name: str = Form(..., description="Full name of the candidate"),
    candidate_email: str = Form(..., description="Email address of the candidate"),
    # ── Path A: Certificate upload ──────────────────────────────────
    file: UploadFile = File(None, description="Certificate PDF, JPG, or PNG (Path A — leave blank for Path B)"),
    # ── Path B: Skill-only declaration ──────────────────────────────
    skill_text: Optional[str] = Form(None, description="Comma-separated skill declaration e.g. 'React, Python, Docker' (Path B only)"),
    role: Optional[str] = Form(None, description="Target role/designation e.g. 'Frontend Developer' (required for Path B)"),
    db: AsyncSession = Depends(get_db)
):
    """
    Certificate ingestion endpoint.
    - Send `file` for certificate-based verification (PDF/JPG/PNG accepted).
    - Send `skill_text` + `role` for skill-only verification (no file needed).
    """
    # 0. Check for duplicate session with same email
    existing_session = await session_repo.get_session_by_email(db, candidate_email)
    if existing_session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A verification session for candidate email '{candidate_email}' already exists. Duplicate sessions are not allowed."
        )

    # 1. Determine intake mode
    has_file = file is not None and file.filename not in (None, "", "string")
    has_skills = skill_text and skill_text.strip()


    if has_file:
        intake_mode = "certificate"
        ext = (file.filename or "").lower().split(".")[-1]
        if ext not in ("pdf", "png", "jpg", "jpeg", "txt"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported file format. Please upload PDF, PNG, JPG, JPEG, or TXT."
            )
    elif has_skills:
        intake_mode = "skill_only"
        if not role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="'role' is required when using the skill-only path (Path B)."
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Provide either a 'file' (PDF/image certificate) OR "
                "'skill_text' + 'role' for skill-only verification."
            )
        )

    # 2. Create the Verification Session
    session_in = VerificationSessionCreate(
        intake_mode=intake_mode,
        candidate_name=candidate_name,
        candidate_email=candidate_email,
        certificate_filename=file.filename if has_file else None
    )
    session = await session_repo.create_session(db, session_in)

    # 3. Run ingestion service
    try:
        if intake_mode == "certificate" and has_file:
            await ingest_service.ingest_certificate(db, session.id, file)
        else:
            await ingest_service.ingest_skill_only(db, session.id, skill_text or "", role or "")
    except Exception as e:
        await db.rollback()
        try:
            await session_repo.update_session_status(db, session.id, "failed")
            await db.commit()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ingestion failed: {str(e)}"
        )

    # 4. Return the fully refreshed session
    refreshed = await session_repo.get_session(db, session.id)
    if not refreshed:
        raise HTTPException(status_code=404, detail="Failed to retrieve session after ingestion.")

    return refreshed
