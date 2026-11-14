"""
Public credential verification by hash (e.g. "SP-XXXX-XXXX").
Regression test: this endpoint used score_repo without importing it, so every
hash lookup crashed with a 500 instead of finding the credential.
"""
import uuid
from datetime import datetime
from types import SimpleNamespace

from app.controllers import verify as verify_ctrl
from app.database import get_db
from app.main import app

CODE = "SP-0123456789ABCDEF-FEDCBA9876543210"


class _FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return SimpleNamespace(all=lambda: self._rows)


class _FakeDB:
    def __init__(self, rows):
        self._rows = rows

    async def execute(self, stmt):
        return _FakeResult(self._rows)


def test_public_verify_by_hash_finds_session(client, monkeypatch):
    sess = SimpleNamespace(id=uuid.uuid4(), candidate_name="Asha", created_at=datetime(2026, 11, 7))

    async def fake_db():
        yield _FakeDB([sess])

    async def fake_scores(db, session_id):
        return [SimpleNamespace(overall_skill_score=80.0)]

    async def fake_issue(db, session_id):
        assert session_id == sess.id
        return {"verificationHash": CODE, "issuer": "SkillProof"}

    app.dependency_overrides[get_db] = fake_db
    monkeypatch.setattr(verify_ctrl.score_repo, "get_scores_by_session", fake_scores)
    monkeypatch.setattr(verify_ctrl.credential_service, "generate_verification_hash", lambda *a: CODE)
    monkeypatch.setattr(verify_ctrl.credential_service, "issue_verifiable_credential", fake_issue)
    try:
        r = client.get(f"/api/v1/verify/credential/public/{CODE}")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert r.status_code == 200, r.text
    assert r.json()["valid"] is True


def test_public_verify_unknown_hash_is_404(client, monkeypatch):
    async def fake_db():
        yield _FakeDB([])

    app.dependency_overrides[get_db] = fake_db
    try:
        r = client.get("/api/v1/verify/credential/public/SP-0000000000000000-0000000000000000")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert r.status_code == 404
