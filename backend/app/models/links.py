"""
app/models/links.py
Junction / association models:
  - UserOrganisationLink  — many-to-many user ↔ org with permission scopes
  - Notification          — platform-wide notification log
"""
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Enum, JSON, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class LinkStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    revoked = "revoked"


class UserOrganisationLink(Base):
    """
    Tracks candidate ↔ org connections.
    A candidate may connect to multiple organisations.
    An org sees only candidates who have explicitly linked to them.
    """
    __tablename__ = "user_organisation_links"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    org_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    status = Column(
        Enum(LinkStatus, name="link_status_enum"),
        nullable=False,
        default=LinkStatus.pending
    )

    # Which session_ids the candidate has authorized the org to see
    shared_session_ids = Column(JSON, nullable=True, default=list)   # List[UUID str]

    connected_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    # Relationships
    user = relationship("User", back_populates="org_memberships")
    organisation = relationship("Organisation", back_populates="members")


class NotificationCategory(str, enum.Enum):
    assessment = "assessment"
    report = "report"
    organisation = "organisation"
    security = "security"
    system = "system"


class Notification(Base):
    """
    Platform-wide notification log.
    Either user_id OR org_id is set (never both), pointing to the recipient.
    """
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Recipient — exactly one of these is non-null
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )
    org_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )

    category = Column(
        Enum(NotificationCategory, name="notification_category_enum"),
        nullable=False,
        default=NotificationCategory.system
    )

    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, nullable=False, default=False)
    action_url = Column(String(1024), nullable=True)   # deep link

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="notifications")
    organisation = relationship("Organisation", back_populates="notifications")
