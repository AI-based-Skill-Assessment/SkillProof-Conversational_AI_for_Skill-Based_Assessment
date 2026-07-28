"""
app/security/deps.py
FastAPI dependency functions for JWT-based authentication.
Provides role-specific guards and an optional (anonymous-friendly) getter.
"""
from uuid import UUID
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.security.jwt import verify_access_token
from app.models.user import User
from app.models.organisation import Organisation
from app.models.admin import Admin


# Bearer scheme — auto_error=False lets us use optional auth
_bearer_required = HTTPBearer(auto_error=True)
_bearer_optional = HTTPBearer(auto_error=False)


# ── Internal token extractor ───────────────────────────────────────────────────

def _get_payload(credentials: HTTPAuthorizationCredentials) -> dict:
    payload = verify_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


# ── User (Candidate) dependency ────────────────────────────────────────────────

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_required),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Require a valid candidate JWT. Returns the User ORM object."""
    from sqlalchemy import select
    payload = _get_payload(credentials)
    if payload.get("role") != "user":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a user token.")
    user_id = UUID(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive.")
    return user


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_optional),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """
    Optional user auth — returns the User if a valid token is provided, else None.
    Allows anonymous access while still enriching if logged in.
    """
    if not credentials:
        return None
    try:
        return await get_current_user(credentials, db)
    except HTTPException:
        return None


# ── Organisation dependency ────────────────────────────────────────────────────

async def get_current_org(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_required),
    db: AsyncSession = Depends(get_db),
) -> Organisation:
    """Require a valid organisation JWT. Returns the Organisation ORM object."""
    from sqlalchemy import select
    payload = _get_payload(credentials)
    if payload.get("role") != "org":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not an org token.")
    org_id = UUID(payload["sub"])
    result = await db.execute(select(Organisation).where(Organisation.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Organisation not found.")
    if org.status.value != "approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Organisation account status is '{org.status.value}'. Must be approved to access the platform."
        )
    return org


# ── Admin dependency ───────────────────────────────────────────────────────────

async def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_required),
    db: AsyncSession = Depends(get_db),
) -> Admin:
    """Require a valid admin JWT. Returns the Admin ORM object."""
    from sqlalchemy import select
    payload = _get_payload(credentials)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not an admin token.")
    admin_id = UUID(payload["sub"])
    result = await db.execute(select(Admin).where(Admin.id == admin_id))
    admin = result.scalar_one_or_none()
    if not admin or not admin.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin not found or inactive.")
    return admin
