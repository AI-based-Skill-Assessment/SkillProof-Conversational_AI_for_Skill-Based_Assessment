"""
app/controllers/biometric.py
Biometric REST API — registration, duplicate detection, live interview
verification, and violation reporting.
"""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.repositories import biometric_repo
from app.schemas.biometric import (
    BiometricRegisterRequest,
    BiometricStatusResponse,
    BiometricDuplicateCheckRequest,
    BiometricDuplicateCheckResponse,
    BiometricVerifyRequest,
    BiometricVerifyResponse,
    InterviewVerifyRequest,
    InterviewVerifyResponse,
    ViolationReportRequest,
    ViolationReportResponse,
)

router = APIRouter()

FACE_DIST_THRESHOLD  = 0.60   # for register-time manual verify
VOICE_SIM_THRESHOLD  = 0.80


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/v1/biometric/register
# ═══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/biometric/register",
    response_model=BiometricStatusResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register Face and/or Voice Biometrics",
)
async def register_biometrics(
    payload: BiometricRegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> BiometricStatusResponse:
    """
    Store the candidate's face embedding (128-dim from face-api.js) and/or
    voice embedding (MFCC spectral vector from Web Audio API).
    Caller must run /biometric/check-duplicate FIRST; this endpoint does NOT
    block duplicate registrations by itself.
    """
    if payload.face_embedding is None and payload.voice_embedding is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one of: face_embedding or voice_embedding.",
        )

    profile = await biometric_repo.create_or_update_profile(
        db,
        session_id=payload.session_id,
        face_embedding=payload.face_embedding,
        voice_embedding=payload.voice_embedding,
    )
    await db.commit()
    await db.refresh(profile)

    return BiometricStatusResponse(
        session_id=profile.session_id,
        face_registered=profile.face_registered,
        voice_registered=profile.voice_registered,
        fully_registered=profile.face_registered and profile.voice_registered,
        face_duplicate_detected=profile.face_duplicate_detected,
        voice_duplicate_detected=profile.voice_duplicate_detected,
        fraud_flags=profile.fraud_flags,
        fraud_status=profile.fraud_status,
        interview_flagged=profile.interview_flagged,
        flag_reasons=profile.flag_reasons or [],
    )


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/v1/biometric/status/{session_id}
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/biometric/status/{session_id}",
    response_model=BiometricStatusResponse,
    summary="Get Biometric Registration & Integrity Status",
)
async def get_biometric_status(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> BiometricStatusResponse:
    profile = await biometric_repo.get_profile(db, session_id)
    if not profile:
        return BiometricStatusResponse(
            session_id=session_id,
            face_registered=False,
            voice_registered=False,
            fully_registered=False,
            face_duplicate_detected=False,
            voice_duplicate_detected=False,
            fraud_flags=0,
            fraud_status="clean",
            interview_flagged=False,
            flag_reasons=[],
        )

    return BiometricStatusResponse(
        session_id=profile.session_id,
        face_registered=profile.face_registered,
        voice_registered=profile.voice_registered,
        fully_registered=profile.face_registered and profile.voice_registered,
        face_duplicate_detected=profile.face_duplicate_detected,
        voice_duplicate_detected=profile.voice_duplicate_detected,
        fraud_flags=profile.fraud_flags,
        fraud_status=profile.fraud_status,
        interview_flagged=profile.interview_flagged,
        flag_reasons=profile.flag_reasons or [],
    )


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/v1/biometric/check-duplicate
# ═══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/biometric/check-duplicate",
    response_model=BiometricDuplicateCheckResponse,
    summary="Check for Cross-Session Biometric Duplicate",
    description=(
        "Before registering, call this endpoint to verify that the candidate's "
        "face/voice embedding does NOT already exist under a different session. "
        "Returns `any_duplicate=true` with a rejection message if a match is found."
    ),
)
async def check_duplicate(
    payload: BiometricDuplicateCheckRequest,
    db: AsyncSession = Depends(get_db),
) -> BiometricDuplicateCheckResponse:
    face_dup  = None
    voice_dup = None
    face_dist = None
    voice_sim = None

    # ── Face duplicate scan ───────────────────────────────────────────────────
    if payload.face_embedding:
        face_dup = await biometric_repo.find_face_duplicate(
            db, payload.session_id, payload.face_embedding
        )
        if face_dup:
            # Compute the best-match distance for transparency
            face_dist = round(biometric_repo.euclidean_distance(
                payload.face_embedding, face_dup.face_embedding
            ), 4)

    # ── Voice duplicate scan ──────────────────────────────────────────────────
    if payload.voice_embedding:
        voice_dup = await biometric_repo.find_voice_duplicate(
            db, payload.session_id, payload.voice_embedding
        )
        if voice_dup:
            voice_sim = round(biometric_repo.cosine_similarity(
                payload.voice_embedding, voice_dup.voice_embedding
            ), 4)

    any_dup = bool(face_dup or voice_dup)

    # ── If duplicate found, mark the profile ─────────────────────────────────
    if any_dup:
        bio_type = (
            "both" if (face_dup and voice_dup)
            else "face" if face_dup
            else "voice"
        )
        dup_session_id = str(
            face_dup.session_id if face_dup else voice_dup.session_id
        )
        try:
            await biometric_repo.mark_duplicate(
                db, payload.session_id, dup_session_id, bio_type
            )
            await db.commit()
        except ValueError:
            pass   # profile may not exist yet if this is checked pre-register

    if any_dup:
        parts = []
        if face_dup:
            parts.append("face")
        if voice_dup:
            parts.append("voice")
        msg = (
            f"Duplicate {' and '.join(parts)} biometric detected. "
            "This biometric is already registered under a different account. "
            "Registration is blocked to prevent proxy abuse."
        )
    else:
        msg = "No duplicates found. Biometric is unique — safe to register."

    return BiometricDuplicateCheckResponse(
        session_id=payload.session_id,
        face_is_duplicate=bool(face_dup),
        voice_is_duplicate=bool(voice_dup),
        any_duplicate=any_dup,
        face_match_distance=face_dist,
        voice_match_similarity=voice_sim,
        message=msg,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/v1/biometric/verify  (registration-time / manual)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/biometric/verify",
    response_model=BiometricVerifyResponse,
    summary="Verify Live Embeddings Against Registered Profile",
)
async def verify_biometrics(
    payload: BiometricVerifyRequest,
    db: AsyncSession = Depends(get_db),
) -> BiometricVerifyResponse:
    profile = await biometric_repo.get_profile(db, payload.session_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No biometric profile for session {payload.session_id}.",
        )

    face_match = False;  face_conf = 0.0
    voice_match = False; voice_conf = 0.0
    mismatch = False

    if payload.face_embedding and profile.face_embedding:
        dist = biometric_repo.euclidean_distance(
            payload.face_embedding, profile.face_embedding
        )
        face_conf  = max(0.0, round(1.0 - dist / FACE_DIST_THRESHOLD, 4))
        face_match = dist < FACE_DIST_THRESHOLD
        if not face_match:
            mismatch = True

    if payload.voice_embedding and profile.voice_embedding:
        sim = biometric_repo.cosine_similarity(
            payload.voice_embedding, profile.voice_embedding
        )
        voice_conf  = max(0.0, round(sim, 4))
        voice_match = sim >= VOICE_SIM_THRESHOLD
        if not voice_match:
            mismatch = True

    if mismatch:
        profile = await biometric_repo.increment_fraud_flag(db, payload.session_id)
        await db.commit()

    parts = []
    if payload.face_embedding:
        parts.append("Face verified" if face_match else "Face mismatch")
    if payload.voice_embedding:
        parts.append("Voice verified" if voice_match else "Voice mismatch")

    return BiometricVerifyResponse(
        session_id=payload.session_id,
        face_match=face_match,
        voice_match=voice_match,
        face_confidence=face_conf,
        voice_confidence=voice_conf,
        flagged=mismatch,
        fraud_flags=profile.fraud_flags,
        fraud_status=profile.fraud_status,
        message=" | ".join(parts) or "No embeddings provided.",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/v1/biometric/interview-verify
# ═══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/biometric/interview-verify",
    response_model=InterviewVerifyResponse,
    summary="Real-Time Interview Biometric Verification",
    description=(
        "Called every ~5 seconds during the live interview. "
        "Compares live face descriptor and/or voice embedding against the "
        "candidate's registered profile. Tracks mismatches and auto-flags "
        "the interview if thresholds are exceeded."
    ),
)
async def interview_verify(
    payload: InterviewVerifyRequest,
    db: AsyncSession = Depends(get_db),
) -> InterviewVerifyResponse:
    profile = await biometric_repo.get_profile(db, payload.session_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No biometric profile for session {payload.session_id}.",
        )

    face_match, voice_match, face_conf, voice_conf, profile = (
        await biometric_repo.record_interview_verification(
            db,
            session_id=payload.session_id,
            face_embedding=payload.face_embedding,
            voice_embedding=payload.voice_embedding,
        )
    )
    await db.commit()
    await db.refresh(profile)

    # Determine alert level for the frontend
    if profile.interview_flagged:
        alert = "flag"
    elif profile.fraud_status in ("suspected", "warned"):
        alert = "warn"
    else:
        alert = "ok"

    parts = []
    if payload.face_embedding:
        parts.append("Face OK" if face_match else "Face mismatch — possible proxy!")
    if payload.voice_embedding:
        parts.append("Voice OK" if voice_match else "Voice mismatch — possible proxy!")

    return InterviewVerifyResponse(
        session_id=payload.session_id,
        face_match=face_match,
        voice_match=voice_match,
        face_confidence=face_conf,
        voice_confidence=voice_conf,
        face_mismatch_count=profile.face_mismatch_count,
        voice_mismatch_count=profile.voice_mismatch_count,
        interview_flagged=profile.interview_flagged,
        fraud_status=profile.fraud_status,
        fraud_flags=profile.fraud_flags,
        alert_level=alert,
        message=" | ".join(parts) or "Verification complete.",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/v1/biometric/report-violation
# ═══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/biometric/report-violation",
    response_model=ViolationReportResponse,
    summary="Report a Gaze or Camera Violation During Interview",
    description=(
        "Called by the frontend when the candidate's face is not visible, "
        "is severely turned away, or the camera feed is interrupted. "
        "First violation → warning. Second+ → interview flagged."
    ),
)
async def report_violation(
    payload: ViolationReportRequest,
    db: AsyncSession = Depends(get_db),
) -> ViolationReportResponse:
    profile = await biometric_repo.get_profile(db, payload.session_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No biometric profile for session {payload.session_id}.",
        )

    profile = await biometric_repo.record_violation(
        db,
        session_id=payload.session_id,
        violation_type=payload.violation_type,
        reason=payload.details or "",
    )
    await db.commit()
    await db.refresh(profile)

    total_violations = profile.gaze_violations + profile.camera_interruptions
    if profile.interview_flagged:
        warn_level = "flag"
        msg = (
            "Interview has been FLAGGED due to repeated attention violations. "
            "This session will be reviewed manually."
        )
    elif total_violations >= 2:
        warn_level = "flag"
        msg = "This is your final warning. Your interview is now flagged."
    else:
        warn_level = "warn"
        if payload.violation_type == "gaze":
            msg = (
                "Please look at the camera to continue your interview. "
                "Repeated inattention will flag this session."
            )
        else:
            msg = (
                "Camera feed interrupted. Please turn on your camera to resume. "
                "If this happens again, your interview will be flagged."
            )

    return ViolationReportResponse(
        session_id=payload.session_id,
        gaze_violations=profile.gaze_violations,
        camera_interruptions=profile.camera_interruptions,
        fraud_flags=profile.fraud_flags,
        interview_flagged=profile.interview_flagged,
        fraud_status=profile.fraud_status,
        warning_level=warn_level,
        message=msg,
        flag_reasons=profile.flag_reasons or [],
    )
