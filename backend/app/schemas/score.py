from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


# ── Shared ──────────────────────────────────────────────────────
class SkillScoreBase(BaseModel):
    specificity_score: Optional[float] = None
    depth_score: Optional[float] = None
    consistency_score: Optional[float] = None
    overall_skill_score: Optional[float] = None
    verdict: Optional[str] = None
    llm_reasoning: Optional[str] = None


# ── Create ──────────────────────────────────────────────────────
class SkillScoreCreate(SkillScoreBase):
    session_id: UUID


# ── Read ────────────────────────────────────────────────────────
class SkillScoreRead(SkillScoreBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: UUID
    scored_at: datetime


# ── Response (alias) ────────────────────────────────────────────
SkillScoreResultResponse = SkillScoreRead
