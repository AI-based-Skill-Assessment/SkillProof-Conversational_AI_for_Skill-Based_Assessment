"""
app/repositories/user_repo.py
Database operations for User (candidate) accounts.
"""
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from passlib.context import CryptContext

from app.models.user import User, AccountType

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


# ── Read ───────────────────────────────────────────────────────────────────────

async def get_user_by_id(db: AsyncSession, user_id: UUID) -> Optional[User]:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    result = await db.execute(
        select(User).where(User.email == email.lower().strip())
    )
    return result.scalar_one_or_none()


# ── Create ─────────────────────────────────────────────────────────────────────

async def create_user(
    db: AsyncSession,
    full_name: str,
    email: str,
    password: str,
    is_google_auth: bool = False,
    profile_picture_url: Optional[str] = None,
) -> User:
    user = User(
        full_name=full_name,
        email=email.lower().strip(),
        hashed_password=hash_password(password) if not is_google_auth else None,
        is_google_auth=is_google_auth,
        email_verified=is_google_auth,   # Google users are auto-verified
        profile_picture_url=profile_picture_url,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


# ── Update ─────────────────────────────────────────────────────────────────────

async def update_user_profile(
    db: AsyncSession,
    user: User,
    full_name: Optional[str] = None,
    profile_picture_url: Optional[str] = None,
    bio: Optional[str] = None,
) -> User:
    if full_name is not None:
        user.full_name = full_name
    if profile_picture_url is not None:
        user.profile_picture_url = profile_picture_url
    if bio is not None:
        user.bio = bio
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def update_password(db: AsyncSession, user: User, new_password: str) -> User:
    user.hashed_password = hash_password(new_password)
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def verify_email(db: AsyncSession, user: User) -> User:
    user.email_verified = True
    user.email_verify_token = None
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def set_biometric_flags(
    db: AsyncSession,
    user: User,
    face_registered: Optional[bool] = None,
    voice_registered: Optional[bool] = None,
) -> User:
    if face_registered is not None:
        user.face_registered = face_registered
        if face_registered and user.onboarding_step == "face_registration":
            user.onboarding_step = "voice_registration"
    if voice_registered is not None:
        user.voice_registered = voice_registered
        if voice_registered:
            user.onboarding_step = "completed"
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def deactivate_user(db: AsyncSession, user: User) -> User:
    user.is_active = False
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def update_account_type(db: AsyncSession, user: User, account_type: str) -> User:
    user.account_type = AccountType(account_type)
    if user.onboarding_step == "account_type":
        user.onboarding_step = "face_registration"
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


# ── List (admin use) ───────────────────────────────────────────────────────────

async def list_users(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50,
) -> list[User]:
    result = await db.execute(
        select(User).order_by(User.created_at.desc()).offset(skip).limit(limit)
    )
    return list(result.scalars().all())
