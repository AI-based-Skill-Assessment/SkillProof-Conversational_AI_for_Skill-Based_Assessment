"""
app/security/__init__.py
Security exports — JWT auth + legacy API key helper.
"""

# ── JWT auth ───────────────────────────────────────────────────────────────────
from app.security.jwt import create_access_token, create_refresh_token, verify_access_token
from app.security.deps import (
    get_current_user,
    get_current_user_optional,
    get_current_org,
    get_current_admin,
)

# ── Legacy admin API key (kept for backward compat on biometric endpoints) ─────
import os
from fastapi import Security, HTTPException, status
from fastapi.security import APIKeyHeader

ADMIN_API_KEY = os.environ.get("SKILLPROOF_ADMIN_KEY", "")
api_key_header = APIKeyHeader(name="X-Admin-Key", auto_error=False)


async def require_admin_key(key: str = Security(api_key_header)) -> str:
    """Legacy: enforce admin API key on sensitive biometric endpoints."""
    if not ADMIN_API_KEY:
        return "dev-bypass"
    if not key or key != ADMIN_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing admin API key.",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    return key
