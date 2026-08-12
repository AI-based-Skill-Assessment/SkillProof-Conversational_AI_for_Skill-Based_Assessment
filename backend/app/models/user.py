"""
app/models/user.py
Candidate / User account model.
"""
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Enum, Text, JSON, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class AccountType(str, enum.Enum):
    individual = "individual"
    organisation_connected = "organisation_connected"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Identity
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, unique=True, index=True)

    # Auth
    hashed_password = Column(String(255), nullable=True)   # null for Google-auth users
    is_google_auth = Column(Boolean, nullable=False, default=False)

    # Email verification
    email_verified = Column(Boolean, nullable=False, default=False)
    email_verify_token = Column(String(255), nullable=True)

    # Biometric registration status (mirrors BiometricProfile convenience flags)
    face_registered = Column(Boolean, nullable=False, default=False)
    face_embedding = Column(JSON, nullable=True)
    voice_registered = Column(Boolean, nullable=False, default=False)
    voice_embedding = Column(JSON, nullable=True)

    # Profile
    account_type = Column(
        Enum(AccountType, name="account_type_enum"),
        nullable=False,
        default=AccountType.individual
    )
    profile_picture_url = Column(String(1024), nullable=True)
    bio = Column(Text, nullable=True)

    # Status
    is_active = Column(Boolean, nullable=False, default=True)
    onboarding_step = Column(String(50), nullable=False, default="account_type")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    # Relationships
    sessions = relationship(
        "VerificationSession",
        back_populates="owner",
        cascade="all, delete-orphan"
    )
    org_memberships = relationship(
        "UserOrganisationLink",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    notifications = relationship(
        "Notification",
        back_populates="user",
        cascade="all, delete-orphan"
    )
