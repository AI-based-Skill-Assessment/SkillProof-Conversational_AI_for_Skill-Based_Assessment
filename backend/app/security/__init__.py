"""
app/security/__init__.py
Simple API key authentication for sensitive admin endpoints.
"""

import os
from fastapi import Security, HTTPException, status
from fastapi.security import APIKeyHeader

# Admin API key — set via environment variable SKILLPROOF_ADMIN_KEY
# Falls back to a default for development only; production MUST set this.
ADMIN_API_KEY = os.environ.get("SKILLPROOF_ADMIN_KEY", "")

api_key_header = APIKeyHeader(name="X-Admin-Key", auto_error=False)


async def require_admin_key(
    key: str = Security(api_key_header),
) -> str:
    """
    Dependency that enforces a valid admin API key.
    Use on sensitive endpoints like force-override and manual verification.
    """
    if not ADMIN_API_KEY:
        # No key configured — skip auth in development mode
        return "dev-bypass"
    if not key or key != ADMIN_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing admin API key.",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    return key
