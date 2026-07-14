from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, ConfigDict


# ── Shared ──────────────────────────────────────────────────────
class VerificationSessionBase(BaseModel):
    intake_mode: str = "certificate"
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    certificate_filename: Optional[str] = None


# ── Create ──────────────────────────────────────────────────────
class VerificationSessionCreate(VerificationSessionBase):
    """Used when creating a new session from an ingest request."""
    pass


# ── Read / Internal ─────────────────────────────────────────────
class VerificationSessionRead(VerificationSessionBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    raw_ocr_text: Optional[str] = None
    extracted_company: Optional[str] = None
    extracted_role: Optional[str] = None
    extracted_skills: Optional[List[str]] = Field(default_factory=list)
    extracted_verify_url: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime


# ── Response (public-facing) ─────────────────────────────────────
class VerificationSessionResponse(VerificationSessionRead):
    """Full session response including nested relations."""
    model_config = ConfigDict(from_attributes=True)

    document: Optional["DocumentVerificationResultResponse"] = None
    interview: Optional["InterviewSessionResponse"] = None
    scores: Optional[List["SkillScoreResultResponse"]] = Field(default_factory=list)


# ── Update ───────────────────────────────────────────────────────
class VerificationSessionUpdate(BaseModel):
    status: Optional[str] = None
    extracted_company: Optional[str] = None
    extracted_role: Optional[str] = None
    extracted_skills: Optional[List[str]] = None
    extracted_verify_url: Optional[str] = None
    raw_ocr_text: Optional[str] = None


# Circular reference resolution (document/interview/score imported below in __init__.py)
from app.schemas.document import DocumentVerificationResultResponse  # noqa: E402
from app.schemas.interview import InterviewSessionResponse           # noqa: E402
from app.schemas.score import SkillScoreResultResponse               # noqa: E402

VerificationSessionResponse.model_rebuild()
