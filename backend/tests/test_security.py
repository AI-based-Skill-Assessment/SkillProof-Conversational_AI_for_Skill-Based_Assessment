"""
Regression tests for the security fixes. If one of these fails, a protection
that stops candidates from faking results (or outsiders from becoming admin)
has been removed or broken.
"""
import asyncio
import os
import subprocess
import sys
import uuid
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from starlette.websockets import WebSocketDisconnect

from app.config import settings
from app.security.deps import ensure_session_access
from app.security.google_verify import verify_google_token

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


# ── Force-verify override is admin-only ───────────────────────────────────────

def test_force_verify_requires_login(client):
    r = client.post(f"/api/v1/verify/{uuid.uuid4()}/force")
    assert r.status_code in (401, 403)


def test_force_verify_rejects_candidate_token(client, user_token):
    _, token = user_token
    r = client.post(
        f"/api/v1/verify/{uuid.uuid4()}/force",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403
    assert r.json()["detail"] == "Not an admin token."


# ── Mock Google login can never reach the admin portal ────────────────────────

MOCK_ADMIN_TOKEN = "mock_google_1_admin@skillproof.ai_Someone"


def test_mock_google_rejected_for_admin(monkeypatch):
    # Even in dev mode with no Client ID configured (where mocks are allowed)
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "")
    monkeypatch.setattr(settings, "APP_ENV", "development")
    with pytest.raises(ValueError):
        verify_google_token(MOCK_ADMIN_TOKEN, allow_mock=False)


def test_admin_google_endpoint_rejects_mock(client, monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "")
    monkeypatch.setattr(settings, "APP_ENV", "development")
    r = client.post("/api/v1/auth/admin/google/verify", json={"credential_token": MOCK_ADMIN_TOKEN})
    assert r.status_code == 400


def test_mock_google_allowed_for_candidates_in_dev(monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "")
    monkeypatch.setattr(settings, "APP_ENV", "development")
    monkeypatch.setattr(settings, "ALLOW_MOCK_GOOGLE_LOGIN", True)
    info = verify_google_token("mock_google_1_cand@gmail.com_Test-User")
    assert info["email"] == "cand@gmail.com"


def test_mock_google_can_be_disabled(monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "")
    monkeypatch.setattr(settings, "APP_ENV", "development")
    monkeypatch.setattr(settings, "ALLOW_MOCK_GOOGLE_LOGIN", False)
    with pytest.raises(ValueError):
        verify_google_token("mock_google_1_cand@gmail.com_Test-User")


def test_mock_google_rejected_in_production(monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "")
    monkeypatch.setattr(settings, "APP_ENV", "production")
    with pytest.raises(ValueError):
        verify_google_token("mock_google_1_cand@gmail.com_Test-User")


# ── Admin 2FA secret is only revealed during first-time setup ─────────────────

def _admin(totp_enabled):
    return SimpleNamespace(
        id=uuid.uuid4(), email="admin@skillproof.ai",
        totp_secret="JBSWY3DPEHPK3PXP", totp_enabled=totp_enabled,
    )


def test_totp_secret_hidden_once_enabled():
    from app.controllers.auth import _admin_2fa_challenge
    resp = _admin_2fa_challenge(_admin(totp_enabled=True))
    assert resp.totp_secret is None
    assert resp.totp_uri is None
    assert resp.temp_token


def test_totp_secret_shown_for_first_setup():
    from app.controllers.auth import _admin_2fa_challenge
    resp = _admin_2fa_challenge(_admin(totp_enabled=False))
    assert resp.totp_secret == "JBSWY3DPEHPK3PXP"
    assert resp.totp_uri.startswith("otpauth://totp/")


# ── Session ownership guard ───────────────────────────────────────────────────

def _user(user_id):
    return SimpleNamespace(id=user_id)


def test_owner_can_access_session(fake_session):
    owner = uuid.uuid4()
    sess = fake_session(owner)
    asyncio.run(ensure_session_access(None, sess.id, _user(owner)))  # no exception


def test_other_user_cannot_access_session(fake_session):
    sess = fake_session(uuid.uuid4())
    with pytest.raises(HTTPException) as exc:
        asyncio.run(ensure_session_access(None, sess.id, _user(uuid.uuid4())))
    assert exc.value.status_code == 403


def test_anonymous_cannot_access_owned_session(fake_session):
    sess = fake_session(uuid.uuid4())
    with pytest.raises(HTTPException) as exc:
        asyncio.run(ensure_session_access(None, sess.id, None))
    assert exc.value.status_code == 403


def test_unowned_session_stays_accessible(fake_session):
    sess = fake_session(None)  # anonymous / CLI sessions
    asyncio.run(ensure_session_access(None, sess.id, None))


def test_rescore_blocked_for_non_owner(client, fake_session, user_token):
    sess = fake_session(uuid.uuid4())  # owned by someone else
    _, token = user_token
    r = client.post(f"/api/v1/score/{sess.id}", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403


# ── Interview WebSocket requires the owner's token ────────────────────────────

def _ws_rejected(client, url):
    """Connect and return the error message sent before the server closes."""
    with client.websocket_connect(url) as ws:
        msg = ws.receive_json()
        with pytest.raises(WebSocketDisconnect):
            ws.receive_json()
        return msg


def test_ws_rejects_unknown_session(client, fake_session):
    fake_session(None)  # repo returns None for any other id
    msg = _ws_rejected(client, f"/api/v1/interview/{uuid.uuid4()}/ws")
    assert msg["type"] == "error"


def test_ws_rejects_missing_token(client, fake_session):
    sess = fake_session(uuid.uuid4())
    msg = _ws_rejected(client, f"/api/v1/interview/{sess.id}/ws")
    assert "Not authorised" in msg["message"]


def test_ws_rejects_other_users_token(client, fake_session, user_token):
    sess = fake_session(uuid.uuid4())
    _, token = user_token  # a different user
    msg = _ws_rejected(client, f"/api/v1/interview/{sess.id}/ws?token={token}")
    assert "Not authorised" in msg["message"]


# ── CORS ──────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("origin,allowed", [
    ("http://localhost:5173", True),
    ("http://192.168.1.20:5173", True),
    ("https://evil.example.com", False),
])
def test_cors_origins(client, origin, allowed):
    r = client.options("/health", headers={"Origin": origin, "Access-Control-Request-Method": "GET"})
    assert (r.headers.get("access-control-allow-origin") == origin) is allowed


# ── Production refuses default secrets ────────────────────────────────────────

def test_production_refuses_default_secrets():
    env = {**os.environ, "APP_ENV": "production",
           "JWT_SECRET_KEY": "skillproof-super-secret-jwt-key-change-in-production-2024"}
    r = subprocess.run(
        [sys.executable, "-c", "import app.config"],
        cwd=BACKEND_DIR, env=env, capture_output=True, text=True,
    )
    assert r.returncode != 0
    assert "Refusing to start in production" in r.stderr
