import uuid
from sqlalchemy import Column, String, DateTime, Text, JSON, Enum, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class IntakeMode(str, enum.Enum):
    certificate = "certificate"
    skill_only = "skill_only"


class SessionStatus(str, enum.Enum):
    pending = "pending"
    ocr_done = "ocr_done"
    verified = "verified"
    interview_done = "interview_done"
    scored = "scored"
    # Legacy/transitional statuses kept for compatibility
    verifying = "verifying"
    interviewing = "interviewing"
    completed = "completed"
    failed = "failed"


class VerificationSession(Base):
    __tablename__ = "verification_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    # Intake classification
    intake_mode = Column(
        Enum(IntakeMode, name="intake_mode_enum"),
        nullable=False,
        default=IntakeMode.certificate
    )

    # Candidate identity (kept for usability — dynamic, not hardcoded)
    candidate_name = Column(String(255), nullable=True)
    candidate_email = Column(String(255), nullable=True)

    # Certificate document fields
    certificate_filename = Column(String(512), nullable=True)
    raw_ocr_text = Column(Text, nullable=True)

    # Extracted certificate metadata
    extracted_company = Column(String(512), nullable=True)
    extracted_role = Column(String(512), nullable=True)
    extracted_skills = Column(JSON, nullable=True, default=list)     # List[str]
    extracted_verify_url = Column(String(1024), nullable=True)

    # Session lifecycle status
    status = Column(
        Enum(SessionStatus, name="session_status_enum"),
        nullable=False,
        default=SessionStatus.pending
    )

    # Relationships
    document = relationship(
        "DocumentVerificationResult",
        back_populates="session",
        uselist=False,
        cascade="all, delete-orphan"
    )
    interview = relationship(
        "InterviewSession",
        back_populates="session",
        uselist=False,
        cascade="all, delete-orphan"
    )
    scores = relationship(
        "SkillScoreResult",
        back_populates="session",
        cascade="all, delete-orphan"
    )
