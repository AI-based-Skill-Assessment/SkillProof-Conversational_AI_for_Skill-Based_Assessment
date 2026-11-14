"""
Fixes from the full-project review: proctoring honesty, credential privacy,
SSRF protection, biometric deletion.
"""
import asyncio
import uuid
from datetime import datetime
from types import SimpleNamespace

import httpx
import pytest

from app.core import url_safety
from app.repositories import biometric_repo


def _profile(**kw):
    base = dict(face_verify_pass=0, voice_verify_pass=0, face_mismatch_count=0, voice_mismatch_count=0,
                face_mismatch_streak=0, voice_mismatch_streak=0)
    base.update(kw)
    return SimpleNamespace(**base)


# ── Mismatch incidents can't be erased ───────────────────────────────────────

def test_single_noisy_frame_is_not_an_incident():
    p = _profile()
    assert biometric_repo._apply_check(p, "face", False) is False
    assert p.face_mismatch_count == 0 and p.face_mismatch_streak == 1


def test_two_mismatches_in_a_row_start_one_incident():
    p = _profile()
    starts = [biometric_repo._apply_check(p, "face", False) for _ in range(5)]
    assert starts == [False, True, False, False, False]      # one long incident counts once
    assert p.face_mismatch_count == 1 and p.face_mismatch_streak == 5


def test_a_match_does_not_erase_recorded_incidents():
    p = _profile()
    for _ in range(3):
        biometric_repo._apply_check(p, "face", False)
    biometric_repo._apply_check(p, "face", True)               # real candidate returns
    assert p.face_mismatch_count == 1                          # used to reset to 0
    assert p.face_mismatch_streak == 0 and p.face_verify_pass == 1


# ── Identity check fails closed ──────────────────────────────────────────────

def test_identity_check_error_is_not_reported_as_a_match(client, monkeypatch, fake_session):
    sess = fake_session(None)

    async def get_profile(db, sid):
        return SimpleNamespace(face_embedding=[0.1] * 128)

    async def boom(*a, **k):
        raise RuntimeError("model crashed")

    monkeypatch.setattr(biometric_repo, "get_profile", get_profile)
    monkeypatch.setattr(biometric_repo, "record_interview_verification", boom)
    from app.database import get_db
    from app.main import app

    async def fake_db():
        yield SimpleNamespace()

    app.dependency_overrides[get_db] = fake_db
    try:
        r = client.post("/api/v1/biometric/interview-verify",
                        json={"session_id": str(sess.id), "face_embedding": [0.1] * 128})
    finally:
        app.dependency_overrides.pop(get_db, None)
    assert r.status_code == 503                                # used to answer "matched, 94%, clean"


def test_verify_endpoint_requires_session_owner(client, fake_session):
    sess = fake_session(uuid.uuid4())                          # someone else's session
    r = client.post("/api/v1/biometric/verify", json={"session_id": str(sess.id), "voice_embedding": [0.1] * 64})
    assert r.status_code == 403


# ── Public credential lookup ─────────────────────────────────────────────────

@pytest.mark.parametrize("partial", ["SP-", "E", "1", "SP-0123", "SP-0123456789ABCDEF"])
def test_partial_codes_do_not_return_credentials(client, partial):
    r = client.get(f"/api/v1/verify/credential/public/{partial}")
    assert r.status_code == 404


def test_credential_requires_scored_session_and_has_no_email(monkeypatch):
    from app.services import credential_service as cs

    sess = SimpleNamespace(id=uuid.uuid4(), status="scored", candidate_name="Asha", candidate_email="asha@x.com",
                           created_at=datetime(2026, 11, 1), extracted_skills=["Python"], extracted_role="dev",
                           extracted_company="", certificate_filename=None)

    async def get_session(db, sid):
        return sess

    async def none(db, sid):
        return None

    async def scores(db, sid):
        return [SimpleNamespace(overall_skill_score=70.0)]

    monkeypatch.setattr(cs.session_repo, "get_session", get_session)
    monkeypatch.setattr(cs.document_repo, "get_document_by_session", none)
    monkeypatch.setattr(cs.biometric_repo, "get_profile", none)
    monkeypatch.setattr(cs.score_repo, "get_scores_by_session", scores)
    svc = cs.CredentialService(secret_key="k")

    cred = asyncio.run(svc.issue_verifiable_credential(None, sess.id))
    assert "candidateEmail" not in cred["credentialSubject"]

    sess.status = "interview_done"
    assert "error" in asyncio.run(svc.issue_verifiable_credential(None, sess.id))


# ── SSRF protection ──────────────────────────────────────────────────────────

@pytest.mark.parametrize("url", [
    "http://127.0.0.1:8000/api/v1/admin/stats",
    "http://localhost/",
    "http://169.254.169.254/latest/meta-data/",      # cloud metadata service
    "http://10.0.0.5/", "http://192.168.1.1/", "http://[::1]/",
    "file:///etc/passwd", "ftp://example.com/",
    "http://8.8.8.8:22/",                             # non-web port
    "http://user:pass@8.8.8.8/",
])
def test_unsafe_urls_are_refused(url):
    with pytest.raises(url_safety.UnsafeURL):
        asyncio.run(url_safety.check_url(url))


def test_public_ip_is_allowed():
    assert asyncio.run(url_safety.check_url("https://8.8.8.8/verify?id=1"))


def test_redirect_to_internal_address_is_refused():
    def handler(request):
        if request.url.host == "8.8.8.8":
            return httpx.Response(302, headers={"location": "http://127.0.0.1:5432/"})
        return httpx.Response(200, text="internal secret")

    with pytest.raises(url_safety.UnsafeURL):
        asyncio.run(url_safety.safe_get("https://8.8.8.8/cert", transport=httpx.MockTransport(handler)))


def test_safe_redirects_are_followed():
    def handler(request):
        if request.url.path == "/old":
            return httpx.Response(301, headers={"location": "/new"})
        return httpx.Response(200, text="certificate page")

    r = asyncio.run(url_safety.safe_get("https://8.8.8.8/old", transport=httpx.MockTransport(handler)))
    assert r.status_code == 200 and r.text == "certificate page"


# ── Biometric deletion ───────────────────────────────────────────────────────

def test_delete_my_biometrics_requires_login(client):
    assert client.delete("/api/v1/auth/me/biometrics").status_code in (401, 403)


def test_delete_my_biometrics_clears_templates(client, monkeypatch):
    from app.database import get_db
    from app.main import app
    from app.security.deps import get_current_user
    from app.services import retention_service

    user = SimpleNamespace(id=uuid.uuid4())
    called = []

    async def fake_user():
        return user

    async def fake_db():
        yield SimpleNamespace(commit=lambda: asyncio.sleep(0))

    async def fake_delete(db, u):
        called.append(u)
        return {"assessments_cleared": 2, "research_samples_deleted": 0}

    app.dependency_overrides[get_current_user] = fake_user
    app.dependency_overrides[get_db] = fake_db
    monkeypatch.setattr(retention_service, "delete_user_biometrics", fake_delete)
    try:
        r = client.delete("/api/v1/auth/me/biometrics")
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)
    assert r.status_code == 200 and called == [user]
    assert r.json()["assessments_cleared"] == 2
