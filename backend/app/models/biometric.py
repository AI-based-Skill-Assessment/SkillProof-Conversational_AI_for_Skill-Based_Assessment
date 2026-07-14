"""
app/models/biometric.py
Biometric profile model — stores face/voice embeddings, duplicate flags,
gaze violations, camera interruptions, and interview integrity tracking.
"""

import uuid
from sqlalchemy import Column, String, DateTime, JSON, Boolean, Integer, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class BiometricProfile(Base):
    __tablename__ = "biometric_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("verification_sessions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True
    )

    # ── Registered Embeddings ────────────────────────────────────────────────
    face_embedding   = Column(JSON, nullable=True)   # List[float] 128-dim
    face_registered  = Column(Boolean, nullable=False, default=False)

    voice_embedding  = Column(JSON, nullable=True)   # List[float] MFCC spectral
    voice_registered = Column(Boolean, nullable=False, default=False)

    # ── Duplicate Detection ──────────────────────────────────────────────────
    # Set at registration time if the embedding matches another session
    face_duplicate_detected  = Column(Boolean, nullable=False, default=False)
    voice_duplicate_detected = Column(Boolean, nullable=False, default=False)
    # Stores the competing session_id (UUID string) that matched
    duplicate_of_session     = Column(String(64), nullable=True)

    # ── Interview Integrity Tracking ─────────────────────────────────────────
    # Gaze / attention violations (face not detected during interview)
    gaze_violations         = Column(Integer, nullable=False, default=0)
    # Camera feed interruptions (tab hidden, video paused, etc.)
    camera_interruptions    = Column(Integer, nullable=False, default=0)
    # Real-time biometric mismatches during the interview
    face_mismatch_count     = Column(Integer, nullable=False, default=0)
    voice_mismatch_count    = Column(Integer, nullable=False, default=0)
    # Running count of all integrity checks passed
    face_verify_pass        = Column(Integer, nullable=False, default=0)
    voice_verify_pass       = Column(Integer, nullable=False, default=0)

    # ── Overall Fraud Status ─────────────────────────────────────────────────
    # Computed from all the above sub-counters
    fraud_flags    = Column(Integer, nullable=False, default=0)
    fraud_status   = Column(String(50), nullable=False, default="clean")
    # clean / warned / suspected / confirmed / flagged_duplicate
    interview_flagged = Column(Boolean, nullable=False, default=False)
    flag_reasons      = Column(JSON, nullable=True)   # List[str]

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    # Relationship back to session
    session = relationship("VerificationSession", backref="biometric_profile")
