from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


# ── Shared ──────────────────────────────────────────────────────
class DocumentVerificationResultBase(BaseModel):
    verification_path: str = "none"
    fetch_status: str = "unverifiable"
    fetched_content_snippet: Optional[str] = None
    document_score: Optional[float] = None


# ── Create ──────────────────────────────────────────────────────
class DocumentVerificationResultCreate(DocumentVerificationResultBase):
    session_id: UUID


# ── Read ────────────────────────────────────────────────────────
class DocumentVerificationResultRead(DocumentVerificationResultBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: UUID
    checked_at: datetime


# ── Response (alias) ────────────────────────────────────────────
DocumentVerificationResultResponse = DocumentVerificationResultRead
