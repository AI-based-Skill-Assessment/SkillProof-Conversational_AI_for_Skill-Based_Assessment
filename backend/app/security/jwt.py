"""
app/security/jwt.py
JWT token creation, verification, and helper utilities.
Uses python-jose with HS256 algorithm.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from jose import JWTError, jwt

from app.config import settings


# ── Token creation ─────────────────────────────────────────────────────────────

def create_access_token(
    subject: str,          # user UUID as string
    role: str,             # "user" | "org" | "admin"
    email: str,
    extra: Optional[Dict[str, Any]] = None
) -> str:
    """Create a short-lived JWT access token (default: 60 min)."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": subject,
        "role": role,
        "email": email,
        "exp": expire,
        "type": "access",
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(subject: str, role: str) -> str:
    """Create a long-lived JWT refresh token (default: 7 days)."""
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload = {
        "sub": subject,
        "role": role,
        "exp": expire,
        "type": "refresh",
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


# ── Token verification ─────────────────────────────────────────────────────────

def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decode and verify a JWT token.
    Returns the payload dict on success, None if invalid/expired.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError:
        return None


def verify_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify that the token is a valid access token. Returns payload or None."""
    payload = decode_token(token)
    if payload and payload.get("type") == "access":
        return payload
    return None


def verify_refresh_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify that the token is a valid refresh token. Returns payload or None."""
    payload = decode_token(token)
    if payload and payload.get("type") == "refresh":
        return payload
    return None
