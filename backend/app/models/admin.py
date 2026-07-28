"""
app/models/admin.py
System Administrator account model.
Admins are seeded — there is no public registration endpoint.
"""
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, func
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Admin(Base):
    __tablename__ = "admins"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Identity
    email = Column(String(255), nullable=False, unique=True, index=True)
    full_name = Column(String(255), nullable=False, default="Platform Admin")

    # Auth
    hashed_password = Column(String(255), nullable=False)

    # TOTP secret for 2FA — store base32 string (use pyotp.random_base32())
    totp_secret = Column(String(64), nullable=False)
    totp_enabled = Column(Boolean, nullable=False, default=False)

    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )
