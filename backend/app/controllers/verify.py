"""
app/controllers/verify.py
Verification endpoints for SkillProof.

GET  /api/v1/verify/{session_id}       → fetch session status
POST /api/v1/verify/{session_id}       → run document verification engine
POST /api/v1/verify/{session_id}/force → force a manual override (admin)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional
from datetime import datetime

from app.database import get_db, get_redis
from app.schemas.session import VerificationSessionResponse
from app.repositories import session_repo, document_repo
from app.schemas.document import DocumentVerificationResultCreate
from app.core.verification_engine import run_verification

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# GET  /api/v1/verify/{session_id}
# ─────────────────────────────────────────────────────────────────────────────
@router.get(
    "/verify/{session_id}",
    response_model=VerificationSessionResponse,
    summary="Get Verification Session",
    description="Fetch the full verification session, including OCR results and current status."
)
async def get_verification_session(
    session_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    session = await session_repo.get_session(db, session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found."
        )
    return session


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/v1/verify/{session_id}
# ─────────────────────────────────────────────────────────────────────────────
@router.post(
    "/verify/{session_id}",
    summary="Run Document Verification",
    description=(
        "Runs the full document verification engine on the session's extracted URL / company name.\n\n"
        "**Logic:**\n"
        "1. If `extracted_verify_url` is present → HTTP fetch + BeautifulSoup4 classification → optional Playwright JS fallback\n"
        "2. If only `extracted_company` is present → MCA21 API lookup\n"
        "3. Results cached in Redis for 24 hours (SHA-256 key)\n"
        "4. `document_score` is computed from the fetch status (verified=85–100, unverifiable=50, not_found=25–40, mismatched=0–20)\n\n"
        "Updates session status to `verified` (or `ocr_done` if unverifiable)."
    )
)
async def run_document_verification(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis)
):
    # 1. Load session
    session = await session_repo.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found.")

    if session.status.name in ("pending",):
        raise HTTPException(
            status_code=400,
            detail="Session is still in 'pending' state. Run ingestion first via POST /api/v1/ingest."
        )

    verify_url_str: Optional[str] = session.extracted_verify_url
    company_name: Optional[str]   = session.extracted_company
    candidate_name: Optional[str] = session.candidate_name
    raw_ocr_text: str             = session.raw_ocr_text or ""

    # 2. Run the verification engine
    result = await run_verification(
        verify_url_str=verify_url_str,
        company_name=company_name,
        candidate_name=candidate_name,
        raw_ocr_text=raw_ocr_text,
        redis=redis
    )

    # 3. Persist or update the document_verification_result row
    existing_doc = await document_repo.get_document_by_session(db, session_id)

    if existing_doc:
        # Update the existing record
        await document_repo.update_document_result(
            db,
            session_id,
            verification_path=result["verification_path"],
            fetch_status=result["fetch_status"],
            fetched_content_snippet=result.get("fetched_content_snippet"),
            document_score=result["document_score"]
        )
    else:
        # Create a fresh record
        doc_in = DocumentVerificationResultCreate(
            session_id=session_id,
            verification_path=result["verification_path"],
            fetch_status=result["fetch_status"],
            fetched_content_snippet=result.get("fetched_content_snippet"),
            document_score=result["document_score"]
        )
        await document_repo.create_document_result(db, doc_in)

    # 4. Update session status
    new_session_status = (
        "verified"
        if result["fetch_status"] in ("verified",)
        else "ocr_done"
    )
    await session_repo.update_session_status(db, session_id, new_session_status)
    await db.commit()

    # 5. Return enriched response
    refreshed = await session_repo.get_session(db, session_id)

    return {
        "session_id": str(session_id),
        "session_status": new_session_status,
        "verification_path": result["verification_path"],
        "fetch_status": result["fetch_status"],
        "document_score": result["document_score"],
        "confidence": result.get("confidence", 0.5),
        "fetched_content_snippet": result.get("fetched_content_snippet"),
        "checked_at": result.get("checked_at"),
        "candidate_name": candidate_name,
        "extracted_company": company_name,
        "extracted_verify_url": verify_url_str,
        "cached": result.get("cached", False)
    }


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/v1/verify/{session_id}/force
# ─────────────────────────────────────────────────────────────────────────────
@router.post(
    "/verify/{session_id}/force",
    summary="Force Manual Verification Override (Admin)",
    description="Manually force the verification status (e.g., after offline review). Provide `force_status`: verified | not_found | mismatched."
)
async def force_verification_override(
    session_id: UUID,
    force_status: str = "verified",
    document_score: float = 100.0,
    reason: str = "Manual admin override",
    db: AsyncSession = Depends(get_db)
):
    valid = ("verified", "not_found", "mismatched", "unverifiable")
    if force_status not in valid:
        raise HTTPException(
            status_code=400,
            detail=f"force_status must be one of {valid}"
        )

    session = await session_repo.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found.")

    # Upsert document result
    existing = await document_repo.get_document_by_session(db, session_id)
    if existing:
        await document_repo.update_document_result(
            db, session_id,
            verification_path="none",
            fetch_status=force_status,
            fetched_content_snippet=f"[MANUAL OVERRIDE] {reason}",
            document_score=document_score
        )
    else:
        doc_in = DocumentVerificationResultCreate(
            session_id=session_id,
            verification_path="none",
            fetch_status=force_status,
            fetched_content_snippet=f"[MANUAL OVERRIDE] {reason}",
            document_score=document_score
        )
        await document_repo.create_document_result(db, doc_in)

    new_status = "verified" if force_status == "verified" else "ocr_done"
    await session_repo.update_session_status(db, session_id, new_status)
    await db.commit()

    return {
        "session_id": str(session_id),
        "force_status": force_status,
        "document_score": document_score,
        "reason": reason,
        "updated_session_status": new_status
    }
