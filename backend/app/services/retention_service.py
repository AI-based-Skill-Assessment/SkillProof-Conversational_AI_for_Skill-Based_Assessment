"""
app/services/retention_service.py
Biometric data deletion and retention.

What is stored:
- users.face_embedding / users.voice_embedding: the candidate's enrolment
  templates (numeric vectors, not images or audio). Kept while the account
  exists, because every new assessment is checked against them; the candidate
  can delete them at any time (DELETE /api/v1/auth/me/biometrics).
- biometric_profiles.face_embedding / voice_embedding: a per-assessment copy of
  those templates. Erased automatically BIOMETRIC_RETENTION_DAYS after the
  assessment, and immediately when the candidate deletes their biometrics.
- biometric_probes: live samples kept only when RESEARCH_LOGGING is enabled for
  a consented evaluation study; erased with the same retention period.

Integrity counters, scores and reports are kept: they contain no biometric data.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.biometric import BiometricProfile
from app.models.session import VerificationSession
from app.models.user import User


async def delete_user_biometrics(db: AsyncSession, user: User) -> dict:
    """Erase every stored face/voice template of this candidate."""
    user.face_embedding = None
    user.voice_embedding = None
    user.face_registered = False
    user.voice_registered = False
    db.add(user)

    session_ids = select(VerificationSession.id).where(VerificationSession.owner_id == user.id)
    res = await db.execute(
        update(BiometricProfile)
        .where(BiometricProfile.session_id.in_(session_ids))
        .values(face_embedding=None, voice_embedding=None, face_registered=False, voice_registered=False)
    )

    probes_deleted = 0
    try:
        from app.models.research import BiometricProbe
        pres = await db.execute(delete(BiometricProbe).where(BiometricProbe.subject_user_id == user.id))
        probes_deleted = pres.rowcount or 0
    except Exception:
        pass

    return {"assessments_cleared": res.rowcount or 0, "research_samples_deleted": probes_deleted}


async def purge_expired_biometrics(db: AsyncSession, days: int = None) -> dict:
    """Erase per-assessment biometric copies (and research samples) older than the retention period."""
    days = settings.BIOMETRIC_RETENTION_DAYS if days is None else days
    if not days or days <= 0:
        return {"skipped": True}
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    old_sessions = select(VerificationSession.id).where(VerificationSession.created_at < cutoff)
    res = await db.execute(
        update(BiometricProfile)
        .where(BiometricProfile.session_id.in_(old_sessions))
        .where((BiometricProfile.face_embedding.isnot(None)) | (BiometricProfile.voice_embedding.isnot(None)))
        .values(face_embedding=None, voice_embedding=None)
    )

    probes_deleted = 0
    try:
        from app.models.research import BiometricProbe
        pres = await db.execute(delete(BiometricProbe).where(BiometricProbe.created_at < cutoff))
        probes_deleted = pres.rowcount or 0
    except Exception:
        pass

    return {"profiles_cleared": res.rowcount or 0, "research_samples_deleted": probes_deleted, "cutoff_days": days}
