import uuid
from sqlalchemy import Column, String, DateTime, Float, ForeignKey, Text, Enum, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class SkillVerdict(str, enum.Enum):
    verified = "verified"
    suspicious = "suspicious"
    likely_fraudulent = "likely_fraudulent"


class SkillScoreResult(Base):
    __tablename__ = "skill_score_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("verification_sessions.id", ondelete="CASCADE"),
        nullable=False
    )

    # Skill-level scores (0.0 – 100.0 scale each)
    specificity_score = Column(Float, nullable=True)     # How specific/detailed the answers were
    depth_score = Column(Float, nullable=True)           # Technical depth demonstrated
    consistency_score = Column(Float, nullable=True)     # Consistency across multiple answers

    # Composite score
    overall_skill_score = Column(Float, nullable=True)   # Weighted average (0–100)

    # Final decision
    verdict = Column(
        Enum(SkillVerdict, name="skill_verdict_enum"),
        nullable=True
    )

    # LLM reasoning text (free-form justification)
    llm_reasoning = Column(Text, nullable=True)

    # When the score was generated
    scored_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    # Relationships
    session = relationship("VerificationSession", back_populates="scores")
