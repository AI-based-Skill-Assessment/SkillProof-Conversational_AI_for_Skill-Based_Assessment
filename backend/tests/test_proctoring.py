"""
Proctoring: in-browser face incidents are counted and scored consistently.
"""
import asyncio
import uuid
from types import SimpleNamespace

from app.repositories import biometric_repo


def _profile(**kw):
    base = {f: 0 for f in biometric_repo.INTEGRITY_PENALTIES}
    base.update(integrity_score=100.0, fraud_flags=0, flag_reasons=[], fraud_status="clean", interview_flagged=False)
    base.update(kw)
    return SimpleNamespace(**base)


def test_integrity_penalises_another_person_on_camera():
    p = _profile(multi_face_count=1, gaze_violations=2)
    assert biometric_repo.recompute_integrity(p) == 100 - 15 - 4


def test_integrity_never_below_zero():
    assert biometric_repo.recompute_integrity(_profile(multi_face_count=20)) == 0.0


def test_record_violation_counts_multi_face(monkeypatch):
    p = _profile()

    async def get_profile(db, sid):
        return p

    monkeypatch.setattr(biometric_repo, "get_profile", get_profile)
    db = SimpleNamespace(flush=lambda: asyncio.sleep(0), refresh=lambda o: asyncio.sleep(0))
    asyncio.run(biometric_repo.record_violation(db, uuid.uuid4(), "multi_face", "Another person"))
    assert p.multi_face_count == 1
    assert p.fraud_flags == 1
