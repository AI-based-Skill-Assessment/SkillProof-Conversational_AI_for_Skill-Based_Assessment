"""
app/models/research.py
Data kept ONLY for a consented evaluation study (RESEARCH_LOGGING=true).

BiometricProbe stores each live face/voice sample checked during an interview,
so FAR / FRR / EER / ROC can be computed offline by comparing every probe with
every enrolled template (genuine = same person, impostor = different person).
See backend/eval/README.md. Samples are erased after BIOMETRIC_RETENTION_DAYS
and when a participant deletes their biometric data.
"""
import uuid

from sqlalchemy import Column, DateTime, ForeignKey, JSON, String, func
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class BiometricProbe(Base):
    __tablename__ = "biometric_probes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Groups the face + voice samples sent in the same check (used for fusion)
    call_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("verification_sessions.id", ondelete="SET NULL"), nullable=True, index=True)
    # The person who was actually being interviewed (ground truth identity)
    subject_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    modality = Column(String(10), nullable=False)          # "face" | "voice"
    embedding = Column(JSON, nullable=False)                # List[float]
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
