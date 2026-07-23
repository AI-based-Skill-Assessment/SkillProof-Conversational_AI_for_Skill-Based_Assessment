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

from typing import Optional, List

def _extract_face_embedding_if_present(face_image: Optional[str], fallback_emb: Optional[List[float]]) -> Optional[List[float]]:
    if not face_image:
        return fallback_emb
    try:
        from app.core.face_verifier import BackendFaceVerifier
        verifier = BackendFaceVerifier()
        img = verifier.base64_to_cv2(face_image)
        face_crop = verifier.process_low_res_pipeline(img)
        emb = verifier.extract_arcface_embedding(face_crop)
        if emb:
            return emb
    except Exception as e:
        print(f"[Biometric Controller] Backend ArcFace embedding extraction failed: {e}")
    return fallback_emb


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
    Store the candidate's face embedding (128-dim from face-api.js or 512-dim ArcFace) and/or
    voice embedding.
    Caller must run /biometric/check-duplicate FIRST; this endpoint does NOT
    block duplicate registrations by itself.
    """
    face_emb = _extract_face_embedding_if_present(payload.face_image, payload.face_embedding)
    if face_emb is None and payload.voice_embedding is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one of: face_image, face_embedding, or voice_embedding.",
        )

    profile = await biometric_repo.create_or_update_profile(
        db,
        session_id=payload.session_id,
        face_embedding=face_emb,
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
    face_emb = _extract_face_embedding_if_present(payload.face_image, payload.face_embedding)
    if face_emb:
        face_dup = await biometric_repo.find_face_duplicate(
            db, payload.session_id, face_emb
        )
        if face_dup:
            # Compute match distance (euclidean or 1-cosine)
            if len(face_emb) == 512 and face_dup.face_embedding and len(face_dup.face_embedding) == 512:
                sim = biometric_repo.cosine_similarity(face_emb, face_dup.face_embedding)
                face_dist = round(1.0 - sim, 4)
            else:
                face_dist = round(biometric_repo.euclidean_distance(
                    face_emb, face_dup.face_embedding
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

    face_emb = _extract_face_embedding_if_present(payload.face_image, payload.face_embedding)
    if face_emb and profile.face_embedding:
        is_arcface = len(face_emb) == 512 and len(profile.face_embedding) == 512
        if is_arcface:
            # ArcFace checks
            sim = biometric_repo.cosine_similarity(face_emb, profile.face_embedding)
            face_conf = max(0.0, round(sim, 4))
            face_match = sim >= 0.40
        else:
            # face-api.js fallback checks
            dist = biometric_repo.euclidean_distance(
                face_emb, profile.face_embedding
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

    face_emb = _extract_face_embedding_if_present(payload.face_image, payload.face_embedding)
    face_match, voice_match, face_conf, voice_conf, profile = (
        await biometric_repo.record_interview_verification(
            db,
            session_id=payload.session_id,
            face_embedding=face_emb,
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

    # Build specific flags list
    specific_flags = []
    parts = []

    if payload.face_embedding or payload.face_image:
        if face_match:
            parts.append("Face OK")
        else:
            parts.append("Face mismatch — different person detected!")
            specific_flags.append("face_mismatch")

    if payload.voice_embedding:
        if voice_match:
            parts.append("Voice OK")
        else:
            parts.append("Voice mismatch — different speaker detected!")
            specific_flags.append("voice_mismatch")

    # Check multi-face from request data (frontend sends this)
    multi_face = getattr(payload, 'multi_face_detected', False)
    if multi_face:
        specific_flags.append("multiple_faces")
        parts.append("Multiple faces detected in frame")

    face_detected = getattr(payload, 'face_detected', True)
    if not face_detected:
        specific_flags.append("face_not_detected")
        parts.append("Candidate face not visible")

    # Compose specific message
    if specific_flags:
        flag_messages = {
            "face_mismatch": "FACE MISMATCH: The person in the camera does not match the registered candidate. Possible proxy detected.",
            "voice_mismatch": "VOICE MISMATCH: The speaker does not match the registered candidate voice profile. Possible proxy detected.",
            "multiple_faces": "MULTIPLE FACES: More than one person detected in the camera frame. Unauthorized person present.",
            "face_not_detected": "FACE NOT VISIBLE: Candidate's face is not visible in the camera. Please face the camera directly.",
        }
        specific_msg = " | ".join(flag_messages[f] for f in specific_flags if f in flag_messages)
    else:
        specific_msg = "Biometric verification passed."

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
        message=specific_msg,
        face_detected=face_detected,
        multi_face_detected=multi_face,
        gaze_direction=getattr(payload, 'gaze_direction', 'center'),
        specific_flags=specific_flags,
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

    reasons = list(profile.flag_reasons or [])

    # Specific violation messages
    violation_messages = {
        "gaze": {
            "default": "Looking away from screen detected. Please look directly at the camera.",
            "left": "Head turned too far to the left. Please face the camera directly.",
            "right": "Head turned too far to the right. Please face the camera directly.",
            "up": "Looking upward away from screen. Please maintain eye contact with the camera.",
            "down": "Looking downward away from screen. Please maintain eye contact with the camera.",
        },
        "camera": {
            "default": "Camera feed interrupted. Please turn on your camera to resume.",
        },
        "multi_face": {
            "default": "MULTIPLE FACES DETECTED: More than one person found in camera frame. This is a serious integrity violation.",
        },
        "face_mismatch": {
            "default": "FACE MISMATCH: The face on camera does not match the registered candidate. Proxy detected.",
        },
        "voice_mismatch": {
            "default": "VOICE MISMATCH: The voice does not match the registered candidate. Proxy detected.",
        },
    }

    # Parse details for specific sub-type
    details_lower = (payload.details or "").lower()
    violation_msgs = violation_messages.get(payload.violation_type, {"default": f"{payload.violation_type} violation detected"})

    specific_msg = violation_msgs["default"]
    for sub_type, msg in violation_msgs.items():
        if sub_type != "default" and sub_type in details_lower:
            specific_msg = msg
            break

    reasons.append(payload.details or specific_msg)
    
    profile = await biometric_repo.record_violation(
        db,
        session_id=payload.session_id,
        violation_type=payload.violation_type,
        reason=reasons[-1],
    )
    profile.flag_reasons = reasons
    await db.commit()
    await db.refresh(profile)

    total_violations = profile.gaze_violations + profile.camera_interruptions
    if profile.interview_flagged:
        warn_level = "flag"
        msg = (
            "INTERVIEW FLAGGED: Repeated integrity violations detected. "
            "This session will be reviewed manually for potential proxy activity."
        )
    elif total_violations >= 2:
        warn_level = "flag"
        msg = "FINAL WARNING: Your interview is now flagged. Further violations will terminate the session."
    else:
        warn_level = "warn"
        msg = specific_msg + " Repeated violations will flag this session."

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
