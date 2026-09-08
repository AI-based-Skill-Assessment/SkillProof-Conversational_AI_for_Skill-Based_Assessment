from datetime import datetime
from typing import Optional, List, Dict, Any, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# A single transcript turn
class TranscriptTurn(BaseModel):
    role: str          # "system" | "assistant" | "user"
    content: str
    timestamp: str     # ISO datetime string


# ── Shared ──────────────────────────────────────────────────────
class InterviewSessionBase(BaseModel):
    skill_context: Optional[Union[List[str], Dict[str, Any], Any]] = None
    question_count: int = 0
    status: str = "active"


# ── Create ──────────────────────────────────────────────────────
class InterviewSessionCreate(InterviewSessionBase):
    session_id: UUID
    transcript: Optional[List[Dict[str, Any]]] = Field(default_factory=list)


# ── Read ────────────────────────────────────────────────────────
class InterviewSessionRead(InterviewSessionBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: UUID
    transcript: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


# ── Response (alias) ────────────────────────────────────────────
InterviewSessionResponse = InterviewSessionRead
