"""
app/schemas/auth.py
Pydantic schemas for all authentication endpoints.
"""
from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, ConfigDict


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
    totp_uri: str
    totp_secret: str


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


class UserFaceRegisterRequest(BaseModel):
    face_embedding: List[float]


class UserVoiceRegisterRequest(BaseModel):
    voice_embedding: List[float]
