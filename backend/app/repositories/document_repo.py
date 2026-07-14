from typing import Optional
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import DocumentVerificationResult, VerificationPath, FetchStatus
from app.schemas.document import DocumentVerificationResultCreate


async def get_document_by_session(db: AsyncSession, session_id: UUID) -> Optional[DocumentVerificationResult]:
    """Retrieve document verification result by session ID."""
    stmt = select(DocumentVerificationResult).where(DocumentVerificationResult.session_id == session_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_document_result(
    db: AsyncSession, 
    doc_in: DocumentVerificationResultCreate
) -> DocumentVerificationResult:
    """Create a new document verification result in the database."""
    # Check if it already exists
    existing = await get_document_by_session(db, doc_in.session_id)
    if existing:
        return existing
        
    path_map = {
        "url_fetch": VerificationPath.url_fetch,
        "mca21": VerificationPath.mca21,
        "none": VerificationPath.none
    }
    
    status_map = {
        "verified": FetchStatus.verified,
        "mismatched": FetchStatus.mismatched,
        "not_found": FetchStatus.not_found,
        "unverifiable": FetchStatus.unverifiable
    }
        
    doc = DocumentVerificationResult(
        session_id=doc_in.session_id,
        verification_path=path_map.get(doc_in.verification_path, VerificationPath.none),
        fetch_status=status_map.get(doc_in.fetch_status, FetchStatus.unverifiable),
        fetched_content_snippet=doc_in.fetched_content_snippet,
        document_score=doc_in.document_score
    )
    db.add(doc)
    await db.flush()
    await db.refresh(doc)
    return doc


async def update_document_result(
    db: AsyncSession,
    session_id: UUID,
    verification_path: Optional[str] = None,
    fetch_status: Optional[str] = None,
    fetched_content_snippet: Optional[str] = None,
    document_score: Optional[float] = None
) -> Optional[DocumentVerificationResult]:
    """Update details of an existing document verification record."""
    doc = await get_document_by_session(db, session_id)
    if doc:
        path_map = {
            "url_fetch": VerificationPath.url_fetch,
            "mca21": VerificationPath.mca21,
            "none": VerificationPath.none
        }
        
        status_map = {
            "verified": FetchStatus.verified,
            "mismatched": FetchStatus.mismatched,
            "not_found": FetchStatus.not_found,
            "unverifiable": FetchStatus.unverifiable
        }
        
        if verification_path is not None:
            doc.verification_path = path_map.get(verification_path, doc.verification_path)
        if fetch_status is not None:
            doc.fetch_status = status_map.get(fetch_status, doc.fetch_status)
        if fetched_content_snippet is not None:
            doc.fetched_content_snippet = fetched_content_snippet
        if document_score is not None:
            doc.document_score = document_score
            
        db.add(doc)
        await db.flush()
        await db.refresh(doc)
    return doc
