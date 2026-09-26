from typing import Annotated, Optional, List
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.session import VerificationSessionCreate, VerificationSessionResponse
from app.repositories import session_repo, biometric_repo
from app.services.ingestion_service import IngestionService

router = APIRouter()
ingest_service = IngestionService()


from app.security.deps import get_current_user_optional
from app.models.user import User

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
    candidate_name: Optional[str] = Form(None, description="Full name of the candidate"),
    candidate_email: Optional[str] = Form(None, description="Email address of the candidate"),
    file: Optional[UploadFile] = File(None, description="Single certificate PDF, JPG, or PNG"),
    files: Optional[List[UploadFile]] = File(default=None, description="Multiple certificate files (up to 10)"),
    # ── Path B: Skill-only declaration ──────────────────────────────
    skill_text: Optional[str] = Form(None, description="Comma-separated skill declaration e.g. 'React, Python, Docker' (Path B only)"),
    role: Optional[str] = Form(None, description="Target role/designation e.g. 'Frontend Developer' (required for Path B)"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    Certificate ingestion endpoint.
    - Send `files` or `file` for certificate-based verification.
    - Send `skill_text` + `role` for skill-only verification.
    """
    # Combine single and multiple files into a clean list without duplicate files
    uploaded_files: List[UploadFile] = []
    seen_filenames = set()
    if files:
        for f in files:
            if f.filename and f.filename not in (None, "", "string") and f.filename not in seen_filenames:
                uploaded_files.append(f)
                seen_filenames.add(f.filename)
    if file and file.filename and file.filename not in (None, "", "string"):
        if file.filename not in seen_filenames:
            uploaded_files.append(file)
            seen_filenames.add(file.filename)

    actual_name = candidate_name or (current_user.full_name if current_user else "Anonymous Candidate")
    actual_email = candidate_email or (current_user.email if current_user else "anonymous@example.com")



    # 1. Determine intake mode
    has_files = len(uploaded_files) > 0
    has_skills = skill_text and skill_text.strip()

    if has_files:
        intake_mode = "certificate"
        MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
        for f in uploaded_files:
            ext = (f.filename or "").lower().split(".")[-1]
            if ext not in ("pdf", "png", "jpg", "jpeg", "txt", "docx"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unsupported file format for '{f.filename}'. Allowed formats: PDF, PNG, JPG, JPEG, TXT, DOCX."
                )

            # 1b. Inspect magic bytes header to prevent malicious disguised files (.exe, .sh, .py disguised as pdf/png)
            header = await f.read(16)
            await f.seek(0)  # Reset stream position after header read

            if len(header) > 0:
                if ext == "pdf" and not header.startswith(b"%PDF"):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Security Violation: '{f.filename}' does not contain valid PDF binary signature."
                    )
                elif ext in ("png", "jpg", "jpeg"):
                    is_png = header.startswith(b"\x89PNG")
                    is_jpeg = header.startswith(b"\xff\xd8\xff")
                    if not (is_png or is_jpeg):
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Security Violation: '{f.filename}' does not contain valid image binary signature."
                        )
                elif ext == "docx" and not header.startswith(b"PK\x03\x04"):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Security Violation: '{f.filename}' is not a valid DOCX container file."
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
                "Provide certificate file(s) OR "
                "'skill_text' + 'role' for skill-only verification."
            )
        )

    # 2. Run document classifier validation BEFORE creating session record in DB
    if intake_mode == "certificate" and has_files:
        # Pre-validate files through ingestion_service text/format checks before DB session creation
        for f in uploaded_files:
            file_bytes = await f.read()
            await f.seek(0)
            
            # Magic byte header check
            header = file_bytes[:16]
            ext = (f.filename or "").lower().split(".")[-1]
            if len(header) > 0:
                if ext == "pdf" and not header.startswith(b"%PDF"):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Security Violation: '{f.filename}' does not contain valid PDF binary signature."
                    )
                elif ext in ("png", "jpg", "jpeg"):
                    if not (header.startswith(b"\x89PNG") or header.startswith(b"\xff\xd8\xff")):
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Security Violation: '{f.filename}' does not contain valid image binary signature."
                        )

            # OCR Text / Keyword Classifier Check
            raw_text = ""
            if ext == "pdf":
                raw_text = ingest_service._extract_text_from_pdf(file_bytes)
            elif ext in ("jpg", "jpeg", "png"):
                raw_text = ingest_service._extract_text_from_image(file_bytes)
            elif ext == "docx":
                raw_text = ingest_service._extract_text_from_docx(file_bytes)
            else:
                try:
                    raw_text = file_bytes.decode("utf-8", errors="ignore")
                except Exception:
                    raw_text = ""

            clean_text = " ".join(raw_text.split()).lower()
            CERT_KEYWORDS = [
                "certify", "certificate", "completed", "completion", "internship", 
                "awarded", "course", "successfully", "training", "program", "issued",
                "pvt ltd", "private limited", "technologies", "coursera", "udemy", 
                "springboard", "forage", "degree", "diploma", "conduct", "achievement",
                "this is to", "has completed", "satisfactorily"
            ]
            matches = [kw for kw in CERT_KEYWORDS if kw in clean_text]
            if len(clean_text) < 15 or len(matches) == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid Document '{f.filename}': The uploaded file does not appear to be an internship or course completion certificate."
                )

    # 3. Create the Verification Session in DB (Only reached if validation passes)
    primary_filename = ", ".join([f.filename for f in uploaded_files if f.filename]) if has_files else None
    session_in = VerificationSessionCreate(
        intake_mode=intake_mode,
        candidate_name=actual_name,
        candidate_email=actual_email,
        certificate_filename=primary_filename
    )
    session = await session_repo.create_session(db, session_in, owner_id=current_user.id if current_user else None)

    # Automatically sync candidate's registered onboarding biometrics into biometric_profiles table for this session
    if current_user and (current_user.face_embedding or current_user.voice_embedding):
        try:
            await biometric_repo.create_or_update_profile(
                db,
                session_id=session.id,
                face_embedding=current_user.face_embedding,
                voice_embedding=current_user.voice_embedding
            )
            await db.commit()
        except Exception as bio_err:
            print(f"[Ingest Controller] Biometric profile sync warning: {bio_err}")

    # 4. Run ingestion service processing across validated files
    try:
        if intake_mode == "certificate" and has_files:
            for f in uploaded_files:
                await ingest_service.ingest_certificate(db, session.id, f)
        else:
            await ingest_service.ingest_skill_only(db, session.id, skill_text or "", role or "")
    except Exception as e:
        await db.rollback()
        try:
            await session_repo.delete_session(db, session.id)
            await db.commit()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ingestion failed: {str(e)}"
        )

    # 4. Return the fully refreshed session
    refreshed = await session_repo.get_session(db, session.id)
    if not refreshed:
        raise HTTPException(status_code=404, detail="Failed to retrieve session after ingestion.")

    return refreshed
