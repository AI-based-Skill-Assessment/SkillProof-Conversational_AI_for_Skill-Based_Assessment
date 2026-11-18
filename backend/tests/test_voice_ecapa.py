"""
Server-side ECAPA voice verification: template selection, matching, and the
/biometric/voice-sample endpoint (the model itself is replaced by a fake here).
"""
import asyncio
import uuid
from types import SimpleNamespace

import numpy as np
import pytest

from app.core import speaker_embedding as SE
from app.repositories import biometric_repo


def unit(seed, dim=192):
    v = np.random.default_rng(seed).normal(size=dim)
    return list(v / np.linalg.norm(v))


def near(vec, seed, noise=0.2):
    v = np.asarray(vec) + np.random.default_rng(seed).normal(scale=noise / np.sqrt(len(vec)), size=len(vec))
    return list(v / np.linalg.norm(v))


def _profile(voice=None):
    return SimpleNamespace(voice_embedding=voice, face_embedding=None, face_registered=False,
                           face_verify_pass=0, voice_verify_pass=0, face_mismatch_count=0, voice_mismatch_count=0,
                           face_mismatch_streak=0, voice_mismatch_streak=0, fraud_flags=0, flag_reasons=[],
                           fraud_status="clean", interview_flagged=False)


class _DB:
    async def flush(self):
        pass

    async def refresh(self, o):
        pass


def _run_check(monkeypatch, profile, probe, owner_voice=None):
    async def get_profile(db, sid):
        return profile

    async def get_session(db, sid):
        return SimpleNamespace(owner_id=uuid.uuid4())

    async def get_user(db, uid):
        return SimpleNamespace(voice_embedding=owner_voice, face_embedding=None)

    from app.repositories import session_repo, user_repo
    monkeypatch.setattr(biometric_repo, "get_profile", get_profile)
    monkeypatch.setattr(session_repo, "get_session", get_session)
    monkeypatch.setattr(user_repo, "get_user_by_id", get_user)
    return asyncio.run(biometric_repo.record_interview_verification(_DB(), uuid.uuid4(), None, probe))


def test_same_speaker_matches_and_other_speaker_does_not(monkeypatch):
    me = unit(1)
    p = _profile(me)
    _, match, _, conf, _ = _run_check(monkeypatch, p, near(me, 2))
    assert match is True and conf > biometric_repo.VOICE_ECAPA_THRESHOLD
    _, match, _, conf, _ = _run_check(monkeypatch, p, unit(99))      # someone else
    assert match is False and conf < biometric_repo.VOICE_ECAPA_THRESHOLD


def test_two_voice_mismatches_count_as_one_incident(monkeypatch):
    p = _profile(unit(1))
    for k in range(3):
        _run_check(monkeypatch, p, unit(100 + k))
    assert p.voice_mismatch_count == 1 and p.voice_mismatch_streak == 3


def test_legacy_spectral_template_is_not_compared_with_ecapa(monkeypatch):
    p = _profile([0.5] * 64)                                          # old browser feature
    _, match, _, _, _ = _run_check(monkeypatch, p, unit(1), owner_voice=[0.4] * 64)
    assert match is None                                              # "re-register", not a false mismatch
    assert p.voice_mismatch_count == 0


def test_session_falls_back_to_owners_new_ecapa_template(monkeypatch):
    me = unit(5)
    p = _profile([0.5] * 64)                                          # session created before re-registration
    _, match, _, _, _ = _run_check(monkeypatch, p, near(me, 6), owner_voice=me)
    assert match is True and SE.is_ecapa(p.voice_embedding)


# ── Endpoint ─────────────────────────────────────────────────────────────────

@pytest.fixture
def as_candidate(client, monkeypatch):
    from app.database import get_db
    from app.main import app
    from app.security.deps import get_current_user

    user = SimpleNamespace(id=uuid.uuid4(), voice_embedding=None, voice_registered=False)
    saved = {}

    class DB:
        async def execute(self, stmt):
            return SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: saved.get("others", [])))

        async def commit(self):
            pass

        async def flush(self):
            pass

    async def fake_user():
        return user

    async def fake_db():
        yield DB()

    async def set_flags(db, u, voice_registered=None, voice_embedding=None, **kw):
        u.voice_registered, u.voice_embedding = voice_registered, voice_embedding
        return u

    from app.repositories import user_repo
    monkeypatch.setattr(user_repo, "set_biometric_flags", set_flags)
    app.dependency_overrides[get_current_user] = fake_user
    app.dependency_overrides[get_db] = fake_db
    yield user, saved
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_db, None)


def _post(client, purpose, **extra):
    return client.post("/api/v1/biometric/voice-sample",
                       files={"audio": ("v.wav", b"RIFF" + b"\0" * 4000, "audio/wav")},
                       data={"purpose": purpose, **extra})


def test_voice_sample_requires_login(client):
    assert _post(client, "register").status_code in (401, 403)


def test_register_stores_server_computed_embedding(client, as_candidate, monkeypatch):
    user, _ = as_candidate
    emb = unit(7)
    monkeypatch.setattr(SE, "embed_wav_bytes", lambda data: emb)
    r = _post(client, "register")
    assert r.status_code == 200, r.text
    assert user.voice_embedding == emb and user.voice_registered is True


def test_register_rejects_a_voice_already_on_another_account(client, as_candidate, monkeypatch):
    user, saved = as_candidate
    other = unit(8)
    saved["others"] = [SimpleNamespace(voice_embedding=other)]
    monkeypatch.setattr(SE, "embed_wav_bytes", lambda data: near(other, 9, noise=0.05))
    r = _post(client, "register")
    assert r.status_code == 400 and "Duplicate" in r.json()["detail"]
    assert user.voice_embedding is None


def test_model_unavailable_is_503_not_a_fake_result(client, as_candidate, monkeypatch):
    def boom(data):
        raise SE.SpeakerModelUnavailable("not installed")
    monkeypatch.setattr(SE, "embed_wav_bytes", boom)
    assert _post(client, "register").status_code == 503
