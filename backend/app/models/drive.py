"""
app/models/drive.py
PlacementDrive — an assessment an organisation creates and shares with
candidates through an invite code / link (e.g. "Campus Drive: Python + SQL").

Each candidate who joins gets an ordinary skill-only VerificationSession with
`drive_id` set, so the interview, scoring and proctoring pipeline is unchanged.
"""
import enum
import uuid

from sqlalchemy import Column, String, Text, DateTime, Float, JSON, Enum, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class DriveStatus(str, enum.Enum):
    open = "open"
    closed = "closed"


class DriveDecision(str, enum.Enum):
    pending = "pending"
    shortlisted = "shortlisted"
    rejected = "rejected"


class PlacementDrive(Base):
    __tablename__ = "placement_drives"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title = Column(String(255), nullable=False)
    role = Column(String(255), nullable=True)            # e.g. "Graduate Engineer Trainee"
    description = Column(Text, nullable=True)
    skills = Column(JSON, nullable=False, default=list)  # List[str] the interview covers

    invite_code = Column(String(16), nullable=False, unique=True, index=True)
    deadline = Column(DateTime(timezone=True), nullable=True)
    min_score = Column(Float, nullable=True)             # optional pass mark (0-100)

    status = Column(
        Enum(DriveStatus, name="drive_status_enum"),
        nullable=False,
        default=DriveStatus.open,
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    organisation = relationship("Organisation")
