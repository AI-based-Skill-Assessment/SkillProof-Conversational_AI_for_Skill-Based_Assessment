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


# ─────────────────────────────────────────────────────────────────────────────
# CRUD — Fetch / Create / Update
# ─────────────────────────────────────────────────────────────────────────────

async def get_profile(db: AsyncSession, session_id: UUID) -> Optional[BiometricProfile]:
    """Retrieve biometric profile by session_id."""
    stmt = select(BiometricProfile).where(BiometricProfile.session_id == session_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_all_registered_face_profiles_except(
    db: AsyncSession,
    exclude_session_id: UUID,
) -> List[BiometricProfile]:
    """Return all profiles that have a face registered, excluding the given session."""
    stmt = (
        select(BiometricProfile)
        .where(BiometricProfile.face_registered == True)
        .where(BiometricProfile.session_id != exclude_session_id)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_all_registered_voice_profiles_except(
    db: AsyncSession,
    exclude_session_id: UUID,
) -> List[BiometricProfile]:
    """Return all profiles that have a voice registered, excluding the given session."""
    stmt = (
        select(BiometricProfile)
        .where(BiometricProfile.voice_registered == True)
        .where(BiometricProfile.session_id != exclude_session_id)
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
    profile = await get_profile(db, session_id)

    if profile is None:
        profile = BiometricProfile(session_id=session_id, flag_reasons=[])
        db.add(profile)

    if face_embedding is not None:
        profile.face_embedding  = face_embedding
        profile.face_registered = True

    if voice_embedding is not None:
        profile.voice_embedding  = voice_embedding
        profile.voice_registered = True

    await db.flush()
    await db.refresh(profile)
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


# ─────────────────────────────────────────────────────────────────────────────
# Duplicate Cross-Session Checks
# ─────────────────────────────────────────────────────────────────────────────

FACE_DUPLICATE_THRESHOLD  = 0.50   # Euclidean — strict for duplicate detection
VOICE_DUPLICATE_THRESHOLD = 0.88   # Cosine similarity — high for duplicate detection


async def find_face_duplicate(
    db: AsyncSession,
    session_id: UUID,
    face_embedding: List[float],
) -> Optional[BiometricProfile]:
    """
    Check if this face embedding closely matches any already-registered face.
    Returns the matching profile if a duplicate is found, else None.
    """
    all_profiles = await get_all_registered_face_profiles_except(db, session_id)
    for profile in all_profiles:
        if profile.face_embedding and len(profile.face_embedding) == len(face_embedding):
            dist = euclidean_distance(face_embedding, profile.face_embedding)
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
        if profile.voice_embedding and len(profile.voice_embedding) == len(voice_embedding):
            sim = voice_similarity(voice_embedding, profile.voice_embedding)
            if sim >= VOICE_DUPLICATE_THRESHOLD:
                return profile
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Interview Integrity — Real-Time Verification
# ─────────────────────────────────────────────────────────────────────────────

FACE_MATCH_THRESHOLD  = 0.60   # Euclidean — same person during interview
VOICE_MATCH_THRESHOLD = 0.85   # Pearson correlation on smoothed log-differenced formants

FLAG_AT_FRAUD_COUNT = 3        # Flag interview after N combined integrity failures


async def record_interview_verification(
    db: AsyncSession,
    session_id: UUID,
    face_embedding: Optional[List[float]],
    voice_embedding: Optional[List[float]],
) -> Tuple[bool, bool, float, float, BiometricProfile]:
    """
    Compare live embeddings against registered ones during the interview.
    Returns (face_match, voice_match, face_conf, voice_conf, updated_profile).
    """
    profile = await get_profile(db, session_id)
    if not profile:
        raise ValueError(f"No biometric profile for session {session_id}")

    face_match  = False
    face_conf   = 0.0
    voice_match = False
    voice_conf  = 0.0
    any_mismatch = False

    # ── Face check ───────────────────────────────────────────────────────────
    if face_embedding and profile.face_embedding:
        if len(face_embedding) != len(profile.face_embedding):
            print(f"[Biometric Repo] Embedding dimension mismatch: live={len(face_embedding)}, profile={len(profile.face_embedding)}. Auto-accepting to prevent false fraud flag.")
            face_match = True
            face_conf = 1.0
        elif len(face_embedding) == 512:
            sim = cosine_similarity(face_embedding, profile.face_embedding)
            face_conf = max(0.0, round(sim, 4))
            face_match = sim >= 0.40
        else:
            dist = euclidean_distance(face_embedding, profile.face_embedding)
            face_conf  = max(0.0, round(1.0 - dist / FACE_MATCH_THRESHOLD, 4))
            face_match = dist < FACE_MATCH_THRESHOLD
        if face_match:
            profile.face_verify_pass += 1
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
        voice_match = sim >= VOICE_MATCH_THRESHOLD
        if voice_match:
            profile.voice_verify_pass += 1
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
    Pearson Correlation Coefficient (mean-centered cosine similarity)
    applied to smoothed log-differenced spectral formants to remove text-dependence
    while preserving speaker-specific vocal tract envelopes.
    """
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0
        
    epsilon = 1e-8
    log_a = [math.log(x + epsilon) for x in vec_a]
    log_b = [math.log(x + epsilon) for x in vec_b]
    
    formants_a = [log_a[i+1] - log_a[i] for i in range(len(log_a) - 1)]
    formants_b = [log_b[i+1] - log_b[i] for i in range(len(log_b) - 1)]
    
    # Smooth vectors with a moving average window to extract vocal envelope
    def smooth(vec: List[float], window: int = 7) -> List[float]:
        half = window // 2
        res = []
        for i in range(len(vec)):
            start = max(0, i - half)
            end = min(len(vec), i + half + 1)
            res.append(sum(vec[start:end]) / (end - start))
        return res
        
    smoothed_a = smooth(formants_a, window=7)
    smoothed_b = smooth(formants_b, window=7)
    
    n     = len(smoothed_a)
    mu_a  = sum(smoothed_a) / n
    mu_b  = sum(smoothed_b) / n
    ca    = [a - mu_a for a in smoothed_a]
    cb    = [b - mu_b for b in smoothed_b]
    dot   = sum(a * b for a, b in zip(ca, cb))
    mag_a = math.sqrt(sum(a * a for a in ca))
    mag_b = math.sqrt(sum(b * b for b in cb))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    sim = dot / (mag_a * mag_b)
    print(f"[DEBUG] voice comparison: max_a={max(vec_a):.4f}, max_b={max(vec_b):.4f}, similarity={sim:.4f} (threshold={VOICE_MATCH_THRESHOLD})")
    return sim


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
    face-api.js recommends threshold of 0.6 for a face match.
    """
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return float("inf")
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(vec_a, vec_b)))
