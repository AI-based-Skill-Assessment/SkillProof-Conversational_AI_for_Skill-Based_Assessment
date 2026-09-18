"""
app/controllers/auth.py
Authentication routes for all three portals:
  POST /api/v1/auth/user/register
  POST /api/v1/auth/user/login
  POST /api/v1/auth/user/refresh
  POST /api/v1/auth/org/register
  POST /api/v1/auth/org/login
  POST /api/v1/auth/admin/login      (step 1 — password)
  POST /api/v1/auth/admin/2fa        (step 2 — TOTP → full JWT)
  GET  /api/v1/auth/me               (current user profile)
  PUT  /api/v1/auth/me               (update profile)
  POST /api/v1/auth/me/change-password
  GET  /api/v1/auth/orgs/search      (find orgs for connection)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.auth import (
    UserRegisterRequest, UserLoginRequest, TokenResponse,
    UserProfileResponse, UserUpdateRequest, ChangePasswordRequest,
    OrgRegisterRequest, OrgLoginRequest, OrgProfileResponse, OrgUpdateRequest,
    AdminLoginRequest, AdminLoginStep1Response, Admin2FARequest, AdminProfileResponse,
    RefreshTokenRequest, AccessTokenResponse, GoogleVerifyRequest, UserAccountTypeRequest,
    OrgGoogleVerifyRequest, OrgGoogleOnboardRequest,
    UserFaceRegisterRequest, UserVoiceRegisterRequest, AdminGoogleVerifyRequest
)
from app.repositories import user_repo, org_repo, admin_repo, biometric_repo
from sqlalchemy import select
from app.security.jwt import (
    create_access_token, create_refresh_token, verify_refresh_token, verify_access_token
)
from app.security.deps import get_current_user, get_current_org, get_current_admin, get_current_org_any_status
from app.security.google_verify import verify_google_token
from app.models.user import User
from app.models.organisation import Organisation
from app.models.admin import Admin

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ═══════════════════════════════════════════════════════════════════════════════
#  USER (CANDIDATE) AUTH
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/user/register", status_code=status.HTTP_201_CREATED, summary="Candidate Registration")
async def user_register(payload: UserRegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new candidate account. Returns JWT tokens on success."""
    existing = await user_repo.get_user_by_email(db, payload.email)
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    user = await user_repo.create_user(
        db,
        full_name=payload.full_name,
        email=payload.email,
        password=payload.password,
    )
    await db.commit()

    access = create_access_token(str(user.id), "user", user.email)
    refresh = create_refresh_token(str(user.id), "user")
    return TokenResponse(access_token=access, refresh_token=refresh, role="user")


@router.post("/user/login", summary="Candidate Login")
async def user_login(payload: UserLoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """Authenticate a candidate and return JWT tokens."""
    user = await user_repo.get_user_by_email(db, payload.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if user.is_google_auth and not user.hashed_password:
        raise HTTPException(
            status_code=400,
            detail="This account was registered with Google. Please use Google Sign-In."
        )
    if not user_repo.verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account has been deactivated.")

    access = create_access_token(str(user.id), "user", user.email)
    refresh = create_refresh_token(str(user.id), "user")
    return TokenResponse(access_token=access, refresh_token=refresh, role="user")


@router.post("/user/google/verify", summary="Verify Google ID Token & Sign In/Up")
async def user_google_verify(payload: GoogleVerifyRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """Verify Google token, sign in existing candidate, or register a new candidate."""
    try:
        id_info = verify_google_token(payload.credential_token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    email = id_info.get("email")
    name = id_info.get("name", "Google User")
    picture = id_info.get("picture", "")

    if not email:
        raise HTTPException(status_code=400, detail="Google token does not contain an email address.")

    user = await user_repo.get_user_by_email(db, email)
    
    if payload.is_signup:
        # Flow: Sign Up
        if user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email address already exists. Please sign in instead."
            )
        # Register new Google candidate
        user = await user_repo.create_user(
            db,
            full_name=name,
            email=email,
            password="",
            is_google_auth=True,
            profile_picture_url=picture
        )
        await db.commit()
    else:
        # Flow: Sign In
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No account found with this email. Please sign up first."
            )
        
        # Check active status
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account has been deactivated.")
        
        # Link Google authentication if they signed up previously via email/password
        if not user.is_google_auth:
            user.is_google_auth = True
            user.email_verified = True
            if picture and not user.profile_picture_url:
                user.profile_picture_url = picture
            await db.commit()

    access = create_access_token(str(user.id), "user", user.email)
    refresh = create_refresh_token(str(user.id), "user")
    return TokenResponse(access_token=access, refresh_token=refresh, role="user")


@router.post("/user/refresh", summary="Refresh User Access Token")
async def user_refresh(payload: RefreshTokenRequest) -> AccessTokenResponse:
    data = verify_refresh_token(payload.refresh_token)
    if not data or data.get("role") != "user":
        raise HTTPException(status_code=401, detail="Invalid refresh token.")
    access = create_access_token(data["sub"], "user", "")
    return AccessTokenResponse(access_token=access)


# ── User profile ───────────────────────────────────────────────────────────────

@router.get("/me", summary="Get Current User Profile")
async def get_me(current_user: User = Depends(get_current_user)) -> UserProfileResponse:
    return UserProfileResponse.model_validate(current_user)


@router.put("/me", summary="Update User Profile")
async def update_me(
    payload: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserProfileResponse:
    updated = await user_repo.update_user_profile(
        db, current_user,
        full_name=payload.full_name,
        profile_picture_url=payload.profile_picture_url,
        bio=payload.bio,
    )
    await db.commit()
    return UserProfileResponse.model_validate(updated)


@router.post("/me/change-password", summary="Change Password")
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.is_google_auth:
        raise HTTPException(status_code=400, detail="Google-auth users cannot set a password.")
    if not user_repo.verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    await user_repo.update_password(db, current_user, payload.new_password)
    await db.commit()
    return {"message": "Password updated successfully."}


@router.put("/me/account-type", summary="Update User Account Type")
async def update_my_account_type(
    payload: UserAccountTypeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserProfileResponse:
    updated = await user_repo.update_account_type(db, current_user, payload.account_type)
    await db.commit()
    return UserProfileResponse.model_validate(updated)


@router.post("/me/register-face", summary="Register User Face Biometric")
async def register_my_face(
    payload: UserFaceRegisterRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserProfileResponse:
    # ── Double check face uniqueness across registered users and biometric profiles
    if payload.face_embedding:
        # Check against existing users
        stmt = select(User).where(User.face_registered == True).where(User.id != current_user.id)
        res = await db.execute(stmt)
        other_users = res.scalars().all()
        for u in other_users:
            if u.face_embedding and len(u.face_embedding) == len(payload.face_embedding):
                dist = biometric_repo.euclidean_distance(payload.face_embedding, u.face_embedding)
                if dist < biometric_repo.FACE_DUPLICATE_THRESHOLD:
                    raise HTTPException(
                        status_code=400,
                        detail="Duplicate face detected: This face is already registered under another account."
                    )
        
        # Check against session biometric profiles
        face_dup = await biometric_repo.find_face_duplicate(
            db, current_user.id, payload.face_embedding
        )
        if face_dup:
            raise HTTPException(
                status_code=400,
                detail="Duplicate face detected: This face matches an existing registered profile."
            )

    updated = await user_repo.set_biometric_flags(
        db, current_user, face_registered=True, face_embedding=payload.face_embedding
    )
    await db.commit()
    return UserProfileResponse.model_validate(updated)


@router.post("/me/register-voice", summary="Register User Voice Biometric")
async def register_my_voice(
    payload: UserVoiceRegisterRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserProfileResponse:
    # ── Double check voice uniqueness across registered users and biometric profiles
    if payload.voice_embedding:
        # Check against existing users
        stmt = select(User).where(User.voice_registered == True).where(User.id != current_user.id)
        res = await db.execute(stmt)
        other_users = res.scalars().all()
        for u in other_users:
            if u.voice_embedding and len(u.voice_embedding) > 0:
                sim = biometric_repo.voice_similarity(payload.voice_embedding, u.voice_embedding)
                if sim >= biometric_repo.VOICE_DUPLICATE_THRESHOLD:
                    raise HTTPException(
                        status_code=400,
                        detail="Duplicate voice detected: This voice pattern is already registered under another account."
                    )
        
        # Check against session biometric profiles
        voice_dup = await biometric_repo.find_voice_duplicate(
            db, current_user.id, payload.voice_embedding
        )
        if voice_dup:
            raise HTTPException(
                status_code=400,
                detail="Duplicate voice detected: This voice pattern matches an existing registered profile."
            )

    updated = await user_repo.set_biometric_flags(
        db, current_user, voice_registered=True, voice_embedding=payload.voice_embedding
    )
    await db.commit()
    return UserProfileResponse.model_validate(updated)


# ═══════════════════════════════════════════════════════════════════════════════
#  ORGANISATION AUTH
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/org/register", status_code=status.HTTP_201_CREATED, summary="Organisation Registration")
async def org_register(payload: OrgRegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new organisation. Status starts as 'pending' until admin approval."""
    existing = await org_repo.get_org_by_email(db, payload.email)
    if existing:
        raise HTTPException(status_code=400, detail="An organisation with this email already exists.")

    org = await org_repo.create_org(
        db,
        name=payload.name,
        email=payload.email,
        password=payload.password,
        org_type=payload.org_type,
        contact_name=payload.contact_name,
        contact_phone=payload.contact_phone,
        website=payload.website,
        address=payload.address,
    )
    await db.commit()
    return {
        "message": "Registration successful. Your account is pending admin approval.",
        "org_id": str(org.id),
        "status": org.status.value,
    }


@router.post("/org/login", summary="Organisation Login")
async def org_login(payload: OrgLoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """Authenticate an organisation. Only approved orgs can login."""
    org = await org_repo.get_org_by_email(db, payload.email)
    if not org:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if org.is_google_auth and not org.hashed_password:
        raise HTTPException(
            status_code=400,
            detail="This account was registered with Google. Please use Google Sign-In."
        )
    if not org_repo.verify_password(payload.password, org.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if org.status.value == "pending":
        raise HTTPException(
            status_code=403,
            detail="Organisation account status is 'pending'. Must be approved to access the platform."
        )
    if org.status.value == "rejected":
        reason = org.rejection_reason or "No reason provided."
        raise HTTPException(
            status_code=403,
            detail=f"Your organisation account has been rejected by the admin. Reason: {reason}"
        )
    if org.status.value == "suspended":
        raise HTTPException(status_code=403, detail="Your organisation account has been suspended.")

    access = create_access_token(str(org.id), "org", org.email)
    refresh = create_refresh_token(str(org.id), "org")
    return TokenResponse(access_token=access, refresh_token=refresh, role="org")


@router.post("/org/google/verify", summary="Verify Google ID Token & Sign In/Up for Organisation")
async def org_google_verify(payload: OrgGoogleVerifyRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """Verify Google token, sign in existing organisation, or register a new organisation."""
    try:
        id_info = verify_google_token(payload.credential_token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    email = id_info.get("email")
    name = id_info.get("name", "Google Organisation")

    if not email:
        raise HTTPException(status_code=400, detail="Google token does not contain an email address.")

    org = await org_repo.get_org_by_email(db, email)
    
    if payload.is_signup:
        # Flow: Sign Up
        if org:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email address already exists. Please sign in instead."
            )
        # Create a new Google organisation
        org = await org_repo.create_org(
            db,
            name=name,
            email=email,
            password="",
            is_google_auth=True,
            google_onboarding_completed=False
        )
        await db.commit()
    else:
        # Flow: Sign In
        if not org:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No account found with this email. Please register first."
            )
        
        # Link Google if not linked (manual signup → Google sign-in)
        if not org.is_google_auth:
            org.is_google_auth = True
            # Manual sign-up already filled all details, mark onboarding complete
            org.google_onboarding_completed = True
            await db.commit()

        # Determine if registration is fully complete
        # Manual signups always have details filled; Google signups need onboarding
        registration_complete = org.google_onboarding_completed or not org.is_google_auth

        if registration_complete:
            if org.status.value == "pending":
                raise HTTPException(
                    status_code=403,
                    detail="Organisation account status is 'pending'. Must be approved to access the platform."
                )
            if org.status.value == "rejected":
                reason = org.rejection_reason or "No reason provided."
                raise HTTPException(
                    status_code=403,
                    detail=f"Your organisation account has been rejected by the admin. Reason: {reason}"
                )
            if org.status.value == "suspended":
                raise HTTPException(status_code=403, detail="Your organisation account has been suspended.")

    access = create_access_token(str(org.id), "org", org.email)
    refresh = create_refresh_token(str(org.id), "org")
    return TokenResponse(access_token=access, refresh_token=refresh, role="org")


@router.put("/org/google/onboard", summary="Complete Google Organisation Onboarding")
async def org_google_onboard(
    payload: OrgGoogleOnboardRequest,
    current_org: Organisation = Depends(get_current_org_any_status),
    db: AsyncSession = Depends(get_db)
) -> OrgProfileResponse:
    """Update new Google Organisation fields to complete onboarding registration."""
    if not current_org.is_google_auth:
        raise HTTPException(status_code=400, detail="This operation is only for Google authenticated accounts.")
    if current_org.google_onboarding_completed:
        raise HTTPException(status_code=400, detail="Onboarding has already been completed.")

    from app.models.organisation import OrgType, OrgStatus

    current_org.name = payload.name
    try:
        current_org.org_type = OrgType(payload.org_type)
    except ValueError:
        current_org.org_type = OrgType.other
    current_org.contact_name = payload.contact_name
    current_org.contact_phone = payload.contact_phone
    current_org.website = payload.website
    current_org.address = payload.address
    current_org.google_onboarding_completed = True
    current_org.status = OrgStatus.pending

    db.add(current_org)
    await db.commit()
    await db.refresh(current_org)
    raise HTTPException(
        status_code=403,
        detail="Organisation account status is 'pending'. Must be approved to access the platform."
    )


@router.get("/org/me", summary="Get Organisation Profile")
async def get_org_me(current_org: Organisation = Depends(get_current_org_any_status)) -> OrgProfileResponse:
    return OrgProfileResponse.model_validate(current_org)


@router.put("/org/me", summary="Update Organisation Profile")
async def update_org_me(
    payload: OrgUpdateRequest,
    current_org: Organisation = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> OrgProfileResponse:
    updated = await org_repo.update_org(
        db, current_org,
        name=payload.name,
        contact_name=payload.contact_name,
        contact_phone=payload.contact_phone,
        website=payload.website,
        address=payload.address,
        logo_url=payload.logo_url,
    )
    await db.commit()
    return OrgProfileResponse.model_validate(updated)


@router.get("/orgs/search", summary="Search Organisations (for candidate connection)")
async def search_orgs(q: str = "", limit: int = 10, db: AsyncSession = Depends(get_db)):
    """Find approved organisations by name. Used by candidates to connect."""
    if len(q) < 2:
        return []
    orgs = await org_repo.search_orgs(db, q, limit=limit)
    return [
        {
            "id": str(o.id),
            "name": o.name,
            "org_type": o.org_type.value,
            "website": o.website,
            "logo_url": o.logo_url,
        }
        for o in orgs
    ]


# ═══════════════════════════════════════════════════════════════════════════════
#  ADMIN AUTH (two-step: password + TOTP)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/admin/login", summary="Admin Login Step 1 — Password")
async def admin_login_step1(
    payload: AdminLoginRequest,
    db: AsyncSession = Depends(get_db),
) -> AdminLoginStep1Response:
    """Step 1: verify admin email+password. Returns a temp token for 2FA step."""
    admin = await admin_repo.get_admin_by_email(db, payload.email)
    if not admin or not admin_repo.verify_password(payload.password, admin.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid admin credentials.")
    if not admin.is_active:
        raise HTTPException(status_code=403, detail="Admin account is inactive.")

    # Issue a very short-lived temp token (5 min) flagged for 2FA
    from datetime import timedelta, datetime, timezone
    from jose import jwt as _jwt
    from app.config import settings
    temp_payload = {
        "sub": str(admin.id),
        "role": "admin_2fa_pending",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        "type": "temp",
    }
    temp_token = _jwt.encode(temp_payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    
    totp_uri = f"otpauth://totp/SkillProof:{admin.email}?secret={admin.totp_secret}&issuer=SkillProof"
    return AdminLoginStep1Response(
        temp_token=temp_token,
        totp_enabled=admin.totp_enabled,
        totp_uri=totp_uri,
        totp_secret=admin.totp_secret
    )


@router.post("/admin/2fa", summary="Admin Login Step 2 — TOTP Verification")
async def admin_login_step2(
    payload: Admin2FARequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Step 2: verify TOTP code and issue full admin JWT tokens."""
    import pyotp
    from jose import jwt as _jwt, JWTError
    from app.config import settings

    # Decode the temp token
    try:
        temp_data = _jwt.decode(
            payload.temp_token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired 2FA session. Please login again.")

    if temp_data.get("role") != "admin_2fa_pending":
        raise HTTPException(status_code=401, detail="Invalid token for 2FA step.")

    from uuid import UUID
    admin = await admin_repo.get_admin_by_id(db, UUID(temp_data["sub"]))
    if not admin:
        raise HTTPException(status_code=401, detail="Admin not found.")

    # Verify TOTP
    totp = pyotp.TOTP(admin.totp_secret)
    if not totp.verify(payload.totp_code, valid_window=1):
        raise HTTPException(status_code=401, detail="Invalid 2FA code. Please try again.")

    if not admin.totp_enabled:
        admin.totp_enabled = True
        db.add(admin)
        await db.commit()

    access = create_access_token(str(admin.id), "admin", admin.email)
    refresh = create_refresh_token(str(admin.id), "admin")
    return TokenResponse(access_token=access, refresh_token=refresh, role="admin")


@router.get("/admin/me", summary="Get Admin Profile")
async def get_admin_me(current_admin: Admin = Depends(get_current_admin)) -> AdminProfileResponse:
    return AdminProfileResponse.model_validate(current_admin)


@router.post("/org/refresh", summary="Refresh Organisation Access Token")
async def org_refresh(payload: RefreshTokenRequest) -> AccessTokenResponse:
    data = verify_refresh_token(payload.refresh_token)
    if not data or data.get("role") != "org":
        raise HTTPException(status_code=401, detail="Invalid refresh token.")
    access = create_access_token(data["sub"], "org", "")
    return AccessTokenResponse(access_token=access)


@router.post("/admin/refresh", summary="Refresh Admin Access Token")
async def admin_refresh(payload: RefreshTokenRequest) -> AccessTokenResponse:
    data = verify_refresh_token(payload.refresh_token)
    if not data or data.get("role") != "admin":
        raise HTTPException(status_code=401, detail="Invalid refresh token.")
    access = create_access_token(data["sub"], "admin", "")
    return AccessTokenResponse(access_token=access)


@router.post("/admin/google/verify", summary="Verify Google ID Token for Admin")
async def admin_google_verify(payload: AdminGoogleVerifyRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """Verify Google token and log in existing admin."""
    try:
        id_info = verify_google_token(payload.credential_token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    email = id_info.get("email")

    if not email:
        raise HTTPException(status_code=400, detail="Google token does not contain an email address.")

    admin = await admin_repo.get_admin_by_email(db, email)
    if not admin:
        raise HTTPException(
            status_code=401,
            detail="No admin account found with this email. Admin access is restricted."
        )

    if not admin.is_active:
        raise HTTPException(status_code=403, detail="Admin account is inactive.")

    access = create_access_token(str(admin.id), "admin", admin.email)
    refresh = create_refresh_token(str(admin.id), "admin")
    return TokenResponse(access_token=access, refresh_token=refresh, role="admin")
