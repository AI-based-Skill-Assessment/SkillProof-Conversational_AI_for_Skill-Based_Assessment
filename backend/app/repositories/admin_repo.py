"""
app/repositories/admin_repo.py
Database operations for Admin accounts.
Admins are seeded — this repo is used by the seed script and auth controller.
"""
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from passlib.context import CryptContext

from app.models.admin import Admin

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


async def get_admin_by_email(db: AsyncSession, email: str) -> Optional[Admin]:
    result = await db.execute(
        select(Admin).where(Admin.email == email.lower().strip())
    )
    return result.scalar_one_or_none()


async def get_admin_by_id(db: AsyncSession, admin_id: UUID) -> Optional[Admin]:
    result = await db.execute(select(Admin).where(Admin.id == admin_id))
    return result.scalar_one_or_none()


async def create_admin(
    db: AsyncSession,
    email: str,
    password: str,
    totp_secret: str,
    full_name: str = "Platform Admin",
) -> Admin:
    admin = Admin(
        email=email.lower().strip(),
        full_name=full_name,
        hashed_password=hash_password(password),
        totp_secret=totp_secret,
    )
    db.add(admin)
    await db.flush()
    await db.refresh(admin)
    return admin


async def ensure_default_admin(db: AsyncSession) -> Admin:
    """
    Called at startup. Creates the default admin from config if it doesn't exist.
    """
    from app.config import settings
    existing = await get_admin_by_email(db, settings.ADMIN_EMAIL)
    if existing:
        return existing
    return await create_admin(
        db,
        email=settings.ADMIN_EMAIL,
        password=settings.ADMIN_PASSWORD,
        totp_secret=settings.ADMIN_TOTP_SECRET,
        full_name="SkillProof Admin",
    )
