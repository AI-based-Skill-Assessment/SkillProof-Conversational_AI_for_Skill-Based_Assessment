import uuid
from sqlalchemy import Column, String, DateTime, Integer, ForeignKey, JSON, Enum, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class InterviewStatus(str, enum.Enum):
    active = "active"
    completed = "completed"
    abandoned = "abandoned"


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("verification_sessions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True
    )

    # Skills being tested in this interview (JSON list of strings)
    skill_context = Column(JSON, nullable=True, default=list)

    # Full interview transcript: list of {role, content, timestamp}
    transcript = Column(JSON, nullable=True, default=list)

    # Total number of questions asked so far
    question_count = Column(Integer, nullable=False, default=0)

    # Interview lifecycle status
    status = Column(
        Enum(InterviewStatus, name="interview_status_enum"),
        nullable=False,
        default=InterviewStatus.active
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    # Relationships
    session = relationship("VerificationSession", back_populates="interview")
