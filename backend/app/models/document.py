import uuid
from sqlalchemy import Column, String, DateTime, Float, ForeignKey, Text, Enum, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class VerificationPath(str, enum.Enum):
    url_fetch = "url_fetch"
    mca21 = "mca21"
    none = "none"


class FetchStatus(str, enum.Enum):
    verified = "verified"
    mismatched = "mismatched"
    not_found = "not_found"
    unverifiable = "unverifiable"


class DocumentVerificationResult(Base):
    __tablename__ = "document_verification_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("verification_sessions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True
    )

    # How the document was verified
    verification_path = Column(
        Enum(VerificationPath, name="verification_path_enum"),
        nullable=False,
        default=VerificationPath.none
    )

    # Result of the verification attempt
    fetch_status = Column(
        Enum(FetchStatus, name="fetch_status_enum"),
        nullable=False,
        default=FetchStatus.unverifiable
    )

    # Snippet of content fetched from verification URL (if any)
    fetched_content_snippet = Column(Text, nullable=True)

    # Score derived from document analysis (0–100)
    document_score = Column(Float, nullable=True)

    # Timestamp of the verification check
    checked_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    # Relationships
    session = relationship("VerificationSession", back_populates="document")
