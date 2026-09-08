"""
app/repositories/biometric_repo.py
Database operations for biometric profiles.
Includes duplicate detection, interview verification, and violation tracking.
"""

import math
from typing import Optional, List, Tuple
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.biometric import BiometricProfile

# ── Threshold Constants ───────────────────────────────────────────────────────
# Duplicate detection (registration): how close must two embeddings be to flag as same person
FACE_DUPLICATE_THRESHOLD  = 0.45   # Euclidean — same face across accounts (0.35 too strict, 0.55 too loose)
VOICE_DUPLICATE_THRESHOLD = 0.65   # Pearson correlation — same voice across accounts
# Live interview match (are you the same person who registered?)
FACE_MATCH_THRESHOLD      = 0.55   # Euclidean — more lenient, allows lighting/angle variation
VOICE_MATCH_THRESHOLD     = 0.55   # Pearson correlation — same speaker verification



def compute_min_face_distance(live_data, reg_data) -> float:
    """
    Computes minimum L2 Euclidean distance between live face descriptor and registered 3-pose face descriptors.
    Recursively unpacks nested lists so frontal, left-profile, and right-profile 128D vectors are each compared individually.
    """
    if not live_data or not reg_data:
        return 1.0

    # Extract all live 128D vectors
    live_vectors = []
    def _extract_vectors(item, acc):
        if not item: return
        if isinstance(item, list) and len(item) > 0:
            if isinstance(item[0], (int, float)) and len(item) >= 64:
                acc.append([float(x) for x in item[:128]])
            else:
                for sub in item:
                    _extract_vectors(sub, acc)

    _extract_vectors(live_data, live_vectors)
    reg_vectors = []
    _extract_vectors(reg_data, reg_vectors)

    if not live_vectors or not reg_vectors:
        return 1.0

    min_dist = float("inf")
    live_v = live_vectors[0]

    for reg_v in reg_vectors:
        m_len = min(len(live_v), len(reg_v))
        if m_len >= 64:
            dist = math.sqrt(sum((a - b) ** 2 for a, b in zip(live_v[:m_len], reg_v[:m_len])))
            if dist < min_dist:
                min_dist = dist

    return min_dist if min_dist != float("inf") else 1.0


# ─────────────────────────────────────────────────────────────────────────────
# CRUD — Fetch / Create / Update
# ─────────────────────────────────────────────────────────────────────────────

async def resolve_verification_session_id(db: AsyncSession, session_id: UUID) -> UUID:
    """If session_id is an InterviewSession ID, resolve its parent VerificationSession ID."""
    try:
        from app.models.interview import InterviewSession
        stmt = select(InterviewSession).where(InterviewSession.id == session_id)
        res = await db.execute(stmt)
        interview_obj = res.scalar_one_or_none()
        if interview_obj and interview_obj.session_id:
            return interview_obj.session_id
    except Exception:
        pass
    return session_id


async def get_profile(db: AsyncSession, session_id: UUID) -> Optional[BiometricProfile]:
    """Retrieve biometric profile by session_id."""
    target_id = await resolve_verification_session_id(db, session_id)
    stmt = select(BiometricProfile).where(BiometricProfile.session_id == target_id)
    result = await db.execute(stmt)
    profile = result.scalar_one_or_none()
    if not profile and target_id != session_id:
        stmt2 = select(BiometricProfile).where(BiometricProfile.session_id == session_id)
        res2 = await db.execute(stmt2)
        profile = res2.scalar_one_or_none()
    return profile


async def get_all_registered_face_profiles_except(
    db: AsyncSession,
    exclude_session_id: UUID,
) -> List[BiometricProfile]:
    """Return all profiles that have a face registered, excluding the given session."""
    target_id = await resolve_verification_session_id(db, exclude_session_id)
    stmt = (
        select(BiometricProfile)
        .where(BiometricProfile.face_registered == True)
        .where(BiometricProfile.session_id != target_id)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_all_registered_voice_profiles_except(
    db: AsyncSession,
    exclude_session_id: UUID,
) -> List[BiometricProfile]:
    """Return all profiles that have a voice registered, excluding the given session."""
    target_id = await resolve_verification_session_id(db, exclude_session_id)
    stmt = (
        select(BiometricProfile)
        .where(BiometricProfile.voice_registered == True)
        .where(BiometricProfile.session_id != target_id)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create_or_update_profile(
    db: AsyncSession,
    session_id: UUID,
    face_embedding: Optional[List[float]] = None,
    voice_embedding: Optional[List[float]] = None,
) -> BiometricProfile:
    """Create or update a biometric profile with new embeddings."""
    target_id = await resolve_verification_session_id(db, session_id)
    profile = await get_profile(db, target_id)

    if profile is None:
        profile = BiometricProfile(session_id=target_id, flag_reasons=[])
        db.add(profile)

    if face_embedding is not None:
        profile.face_embedding  = face_embedding
        profile.face_registered = True

    if voice_embedding is not None:
        profile.voice_embedding  = voice_embedding
        profile.voice_registered = True

    await db.flush()
    return profile


async def mark_duplicate(
    db: AsyncSession,
    session_id: UUID,
    duplicate_session_id: str,
    biometric_type: str,           # "face" | "voice" | "both"
) -> BiometricProfile:
    """Mark this profile as a duplicate of another session's biometric."""
    profile = await get_profile(db, session_id)
    if not profile:
        raise ValueError(f"No biometric profile for session {session_id}")

    if biometric_type in ("face", "both"):
        profile.face_duplicate_detected = True
    if biometric_type in ("voice", "both"):
        profile.voice_duplicate_detected = True

    profile.duplicate_of_session = duplicate_session_id
    profile.fraud_status = "flagged_duplicate"
    profile.interview_flagged = True

    reasons = list(profile.flag_reasons or [])
    reasons.append(f"Duplicate {biometric_type} biometric matches session {duplicate_session_id[:8]}…")
    profile.flag_reasons = reasons

    await db.flush()
    await db.refresh(profile)
    return profile





async def find_face_duplicate(
    db: AsyncSession,
    session_id: UUID,
    face_embedding: List[float],
) -> Optional[BiometricProfile]:
    """
    Check if this face embedding closely matches any already-registered face.
    Uses compute_min_face_distance which correctly handles nested 3-pose descriptor lists.
    Returns the matching profile if a duplicate is found, else None.
    """
    all_profiles = await get_all_registered_face_profiles_except(db, session_id)
    for profile in all_profiles:
        if not profile.face_embedding:
            continue
        # Use compute_min_face_distance: handles both flat 128-d and nested [[128-d], ...] pose lists
        dist = compute_min_face_distance(face_embedding, profile.face_embedding)
        print(f"[FIND_FACE_DUP] Distance to profile {str(profile.session_id)[:8]}: {dist:.4f} (threshold={FACE_DUPLICATE_THRESHOLD})")
        if dist < FACE_DUPLICATE_THRESHOLD:
            return profile
    return None


async def find_voice_duplicate(
    db: AsyncSession,
    session_id: UUID,
    voice_embedding: List[float],
) -> Optional[BiometricProfile]:
    """
    Check if this voice embedding closely matches any already-registered voice.
    Returns the matching profile if a duplicate is found, else None.
    """
    all_profiles = await get_all_registered_voice_profiles_except(db, session_id)
    for profile in all_profiles:
        if profile.voice_embedding and len(profile.voice_embedding) > 0:
            sim = voice_similarity(voice_embedding, profile.voice_embedding)
            if sim >= VOICE_DUPLICATE_THRESHOLD:
                return profile
    return None



# ─────────────────────────────────────────────────────────────────────────────
# Interview Verification (same-session match check)
# ─────────────────────────────────────────────────────────────────────────────

FLAG_AT_FRAUD_COUNT = 15       # Flag interview after persistent integrity failures during continuous polling


# ─────────────────────────────────────────────────────────────────────────────
# Pre-Check Dedicated Verification (Isolated for InterviewCheck.jsx)
# ─────────────────────────────────────────────────────────────────────────────

async def record_precheck_face_verification(
    db: AsyncSession,
    session_id: UUID,
    face_embedding: List[float],
) -> Tuple[bool, float, BiometricProfile]:
    """
    Dedicated pre-check face verification (InterviewCheck.jsx).
    Completely isolated from live interview logic.
    """
    profile = await get_profile(db, session_id)
    if not profile:
        raise ValueError(f"No biometric profile for session {session_id}")

    face_match = True
    face_conf = 0.95

    if face_embedding and profile.face_embedding:
        emb_a = face_embedding[:128]
        emb_b = profile.face_embedding[:128]
        min_len = min(len(emb_a), len(emb_b))
        if min_len >= 64:
            dist = math.sqrt(sum((a - b) ** 2 for a, b in zip(emb_a[:min_len], emb_b[:min_len])))
            face_match = dist < 0.55
            face_conf = max(0.85, round(1.0 - dist, 4)) if face_match else max(0.15, round(1.0 - (dist / 1.5), 4))

    await db.flush()
    await db.refresh(profile)
    return face_match, face_conf, profile


# ─────────────────────────────────────────────────────────────────────────────
# Live Interview Dedicated Verification (Isolated for InterviewSession.jsx)
# ─────────────────────────────────────────────────────────────────────────────

async def record_interview_verification(
    db: AsyncSession,
    session_id: UUID,
    face_embedding: Optional[List[float]],
    voice_embedding: Optional[List[float]],
) -> Tuple[bool, bool, float, float, BiometricProfile]:
    """
    Dedicated continuous live interview verification (InterviewSession.jsx).
    Returns (face_match, voice_match, face_conf, voice_conf, updated_profile).
    """
    profile = await get_profile(db, session_id)
    if not profile:
        from app.repositories import session_repo, user_repo
        session_obj = await session_repo.get_session(db, session_id)
        owner_face = None
        owner_voice = None
        if session_obj and session_obj.owner_id:
            owner = await user_repo.get_user_by_id(db, session_obj.owner_id)
            if owner:
                owner_face = owner.face_embedding
                owner_voice = owner.voice_embedding
        profile = await create_or_update_profile(
            db,
            session_id=session_id,
            face_embedding=owner_face,
            voice_embedding=owner_voice,
        )
        await db.flush()

    face_match  = False
    face_conf   = 0.0
    voice_match = False
    voice_conf  = 0.0
    any_mismatch = False

    # ── Face check ───────────────────────────────────────────────────────────
    if face_embedding:
        registered_emb = profile.face_embedding
        if not registered_emb:
            from app.repositories import session_repo, user_repo
            session_obj = await session_repo.get_session(db, session_id)
            if session_obj and session_obj.owner_id:
                owner = await user_repo.get_user_by_id(db, session_obj.owner_id)
                if owner and owner.face_embedding:
                    registered_emb = owner.face_embedding
                    profile.face_embedding = owner.face_embedding
                    profile.face_registered = True

        print(f"🔥 [BIOMETRIC BACKEND VERIFY] registered_emb exists: {bool(registered_emb)}, live len: {len(face_embedding) if face_embedding else 0}")
        if registered_emb:
            # Multi-pose L2 distance evaluation
            dist = compute_min_face_distance(face_embedding, registered_emb)
            
            # Strict calibrated face-api.js Euclidean distance threshold: dist < 0.48
            # Matches identical candidate while strictly blocking different people/friends (dist >= 0.48).
            face_match = dist < 0.48
            if face_match:
                # Dynamic percentage calculation based on actual L2 Euclidean distance:
                match_pct = round(max(65, min(99, (1.0 - (dist / 0.70)) * 100)))
                face_conf = round(match_pct / 100.0, 4)
            else:
                # Dynamic percentage calculation for real mismatch / different person:
                match_pct = round(max(10, min(45, (1.0 - dist) * 100)))
                face_conf = round(match_pct / 100.0, 4)
            print(f"🔥 [BIOMETRIC 3-POSE MATCH] Min L2 dist: {dist:.4f}, match_pct: {match_pct}%, face_match: {face_match}")
        else:
            print("⚠️ [BIOMETRIC BACKEND WARNING] No registered face embedding found for candidate!")
            face_match = False
            face_conf = 0.15

        if face_match:
            profile.face_verify_pass += 1
            profile.face_mismatch_count = 0  # Reset consecutive mismatch counter on successful match
        else:
            profile.face_mismatch_count += 1
            any_mismatch = True
            
            reasons = list(profile.flag_reasons or [])
            face_msg = "Face mismatch: The person on camera does not match the registered candidate."
            if face_msg not in reasons:
                reasons.append(face_msg)
                profile.flag_reasons = reasons

    # ── Voice check ──────────────────────────────────────────────────────────
    if voice_embedding and profile.voice_embedding:
        sim = voice_similarity(voice_embedding, profile.voice_embedding)
        voice_conf  = max(0.0, round(sim, 4))
        voice_match = sim >= 0.58
        if voice_match:
            profile.voice_verify_pass += 1
            profile.voice_mismatch_count = 0  # Reset consecutive mismatch counter on match
        else:
            profile.voice_mismatch_count += 1
            any_mismatch = True
            
            reasons = list(profile.flag_reasons or [])
            voice_msg = "Voice mismatch: The speaker does not match the registered voice profile (voice is altered from the registration)."
            if voice_msg not in reasons:
                reasons.append(voice_msg)
                profile.flag_reasons = reasons


    # ── Update fraud status ───────────────────────────────────────────────────
    if any_mismatch:
        profile.fraud_flags += 1
        _update_fraud_status(profile)

    await db.flush()
    await db.refresh(profile)
    return face_match, voice_match, face_conf, voice_conf, profile


async def record_violation(
    db: AsyncSession,
    session_id: UUID,
    violation_type: str,    # "gaze" | "camera"
    reason: str = "",
) -> BiometricProfile:
    """
    Record a gaze or camera violation and update the fraud status.
    Auto-flags the interview if the combined violation count exceeds the threshold.
    """
    profile = await get_profile(db, session_id)
    if not profile:
        raise ValueError(f"No biometric profile for session {session_id}")

    if violation_type == "gaze":
        profile.gaze_violations += 1
    elif violation_type == "camera":
        profile.camera_interruptions += 1

    profile.fraud_flags += 1

    reasons = list(profile.flag_reasons or [])
    reasons.append(reason or f"{violation_type.title()} violation detected")
    profile.flag_reasons = reasons

    _update_fraud_status(profile)

    await db.flush()
    await db.refresh(profile)
    return profile


async def increment_fraud_flag(db: AsyncSession, session_id: UUID) -> BiometricProfile:
    """Generic fraud flag increment (used by verify endpoint)."""
    profile = await get_profile(db, session_id)
    if not profile:
        raise ValueError(f"No biometric profile found for session {session_id}")

    profile.fraud_flags += 1
    _update_fraud_status(profile)

    await db.flush()
    await db.refresh(profile)
    return profile


def _update_fraud_status(profile: BiometricProfile) -> None:
    """Internal: update fraud_status and interview_flagged based on counters."""
    if profile.fraud_flags >= FLAG_AT_FRAUD_COUNT:
        profile.interview_flagged = True
        profile.fraud_status = "confirmed"
    elif profile.fraud_flags >= 2:
        profile.fraud_status = "suspected"
    elif profile.fraud_flags >= 1:
        profile.fraud_status = "warned"


# ─────────────────────────────────────────────────────────────────────────────
# Math Helpers
# ─────────────────────────────────────────────────────────────────────────────

def voice_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """
    Computes speaker similarity between two voice embeddings.
    Supports both 192-dim SpeechBrain ECAPA-TDNN deep embeddings and 64-band spectral formants.
    """
    from app.core.voice_verifier import BackendVoiceVerifier
    verifier = BackendVoiceVerifier()
    return verifier.compute_voice_similarity(vec_a, vec_b)


def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """Standard Cosine Similarity for ArcFace descriptors."""
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0
    dot   = sum(a * b for a, b in zip(vec_a, vec_b))
    mag_a = math.sqrt(sum(a * a for a in vec_a))
    mag_b = math.sqrt(sum(b * b for b in vec_b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


def euclidean_distance(vec_a: List[float], vec_b: List[float]) -> float:
    """
    Euclidean distance — used by face-api.js descriptors.
    Supports single 128-d vectors and nested pose list matrices.
    """
    if not vec_a or not vec_b:
        return float("inf")
    
    # Flatten if vec_a or vec_b are 2D lists (multi-pose descriptors)
    v_a = vec_a[0] if (isinstance(vec_a, list) and len(vec_a) > 0 and isinstance(vec_a[0], list)) else vec_a
    v_b = vec_b[0] if (isinstance(vec_b, list) and len(vec_b) > 0 and isinstance(vec_b[0], list)) else vec_b

    if not isinstance(v_a, list) or not isinstance(v_b, list):
        return float("inf")

    m_len = min(len(v_a), len(v_b))
    if m_len == 0:
        return float("inf")

    return math.sqrt(sum((float(a) - float(b)) ** 2 for a, b in zip(v_a[:m_len], v_b[:m_len])))
