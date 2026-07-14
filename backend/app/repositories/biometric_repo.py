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
            sim = cosine_similarity(voice_embedding, profile.voice_embedding)
            if sim >= VOICE_DUPLICATE_THRESHOLD:
                return profile
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Interview Integrity — Real-Time Verification
# ─────────────────────────────────────────────────────────────────────────────

FACE_MATCH_THRESHOLD  = 0.60   # Euclidean — same person during interview
VOICE_MATCH_THRESHOLD = 0.80   # Cosine similarity

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
        dist = euclidean_distance(face_embedding, profile.face_embedding)
        face_conf  = max(0.0, round(1.0 - dist / FACE_MATCH_THRESHOLD, 4))
        face_match = dist < FACE_MATCH_THRESHOLD
        if face_match:
            profile.face_verify_pass += 1
        else:
            profile.face_mismatch_count += 1
            any_mismatch = True

    # ── Voice check ──────────────────────────────────────────────────────────
    if voice_embedding and profile.voice_embedding:
        sim = cosine_similarity(voice_embedding, profile.voice_embedding)
        voice_conf  = max(0.0, round(sim, 4))
        voice_match = sim >= VOICE_MATCH_THRESHOLD
        if voice_match:
            profile.voice_verify_pass += 1
        else:
            profile.voice_mismatch_count += 1
            any_mismatch = True

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

def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """Cosine similarity between two float vectors. Returns -1..1."""
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
