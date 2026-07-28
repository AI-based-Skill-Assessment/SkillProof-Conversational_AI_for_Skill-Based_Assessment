"""
app/models/organisation.py
Organisation (college, company, placement cell) account model.
"""
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Enum, Text, Integer, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class OrgStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    suspended = "suspended"


class OrgType(str, enum.Enum):
    college = "college"
    university = "university"
    placement_cell = "placement_cell"
    company = "company"
    other = "other"


class Organisation(Base):
    __tablename__ = "organisations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Identity
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, unique=True, index=True)

    # Auth
    hashed_password = Column(String(255), nullable=False)
    is_google_auth = Column(Boolean, nullable=False, default=False)
    google_onboarding_completed = Column(Boolean, nullable=False, default=False)

    # Type & details
    org_type = Column(
        Enum(OrgType, name="org_type_enum"),
        nullable=False,
        default=OrgType.college
    )
    contact_name = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    website = Column(String(512), nullable=True)
    address = Column(Text, nullable=True)
    logo_url = Column(String(1024), nullable=True)

    # Admin-controlled status
    status = Column(
        Enum(OrgStatus, name="org_status_enum"),
        nullable=False,
        default=OrgStatus.pending
    )
    rejection_reason = Column(Text, nullable=True)

    # Stats (denormalized for quick reads)
    total_candidates = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    # Relationships
    members = relationship(
        "UserOrganisationLink",
        back_populates="organisation",
        cascade="all, delete-orphan"
    )
    notifications = relationship(
        "Notification",
        back_populates="organisation",
        cascade="all, delete-orphan"
    )
