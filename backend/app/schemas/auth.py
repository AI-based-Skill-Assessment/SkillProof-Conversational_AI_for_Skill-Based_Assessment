"""
app/schemas/auth.py
Pydantic schemas for all authentication endpoints.
"""
from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import model_validator, BaseModel, EmailStr, Field, ConfigDict


# ── Token Responses ────────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str        # "user" | "org" | "admin"


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── User (Candidate) Auth ──────────────────────────────────────────────────────

class UserRegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str
    email: str
    is_google_auth: bool
    email_verified: bool
    face_registered: bool
    voice_registered: bool
    account_type: str
    profile_picture_url: Optional[str] = None
    onboarding_step: str
    is_active: bool
    created_at: datetime
    # "ecapa" = current speaker model; "legacy" = old browser spectral profile (must re-register)
    voice_model: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def _voice_model(cls, data):
        emb = data.get("voice_embedding") if isinstance(data, dict) else getattr(data, "voice_embedding", None)
        model = None if not emb else ("ecapa" if len(emb) == 192 else "legacy")
        if isinstance(data, dict):
            return {**data, "voice_model": model}
        fields = {k: getattr(data, k) for k in cls.model_fields if k != "voice_model" and hasattr(data, k)}
        return {**fields, "voice_model": model}


class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    profile_picture_url: Optional[str] = None
    bio: Optional[str] = None


class UserAccountTypeRequest(BaseModel):
    account_type: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)


class EmailVerifyRequest(BaseModel):
    token: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


# ── Organisation Auth ──────────────────────────────────────────────────────────

class OrgRegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    org_type: str = "college"   # college | university | placement_cell | company | other
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None


class OrgLoginRequest(BaseModel):
    email: EmailStr
    password: str


class OrgProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    email: str
    org_type: str
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    logo_url: Optional[str] = None
    status: str
    total_candidates: int
    is_google_auth: bool
    google_onboarding_completed: bool
    created_at: datetime


class OrgUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    logo_url: Optional[str] = None


class OrgGoogleVerifyRequest(BaseModel):
    credential_token: str
    is_signup: bool = False


class OrgGoogleOnboardRequest(BaseModel):
    org_type: str = "college"
    name: str = Field(..., min_length=2, max_length=255)
    contact_name: str = Field(..., min_length=2, max_length=255)
    contact_phone: Optional[str] = None
    website: Optional[str] = None
    address: str = Field(..., min_length=5)


# ── Admin Auth ─────────────────────────────────────────────────────────────────

class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AdminLoginStep1Response(BaseModel):
    """Returned after successful password check; 2FA is still required."""
    message: str = "Password verified. Please submit your 2FA code."
    temp_token: str   # Short-lived token to identify the admin during 2FA step
    totp_enabled: bool
    # Only returned during first-time 2FA setup (totp_enabled == False)
    totp_uri: Optional[str] = None
    totp_secret: Optional[str] = None


class Admin2FARequest(BaseModel):
    temp_token: str
    totp_code: str = Field(..., min_length=6, max_length=6)


class AdminProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    full_name: str
    is_active: bool
    created_at: datetime


class GoogleVerifyRequest(BaseModel):
    credential_token: str
    is_signup: bool = False


class AdminGoogleVerifyRequest(BaseModel):
    credential_token: str


class UserFaceRegisterRequest(BaseModel):
    face_embedding: List[float]


class UserVoiceRegisterRequest(BaseModel):
    voice_embedding: List[float]
