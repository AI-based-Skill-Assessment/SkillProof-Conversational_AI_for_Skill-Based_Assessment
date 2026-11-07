"""
Shared test fixtures.

These tests run WITHOUT PostgreSQL or Redis: the FastAPI TestClient is used
without its lifespan (so startup DB/Redis work is skipped), and any repository
call that would hit the database is monkeypatched.

Run from the backend folder:
    .venv\\Scripts\\python.exe -m pytest
"""
import os
import sys
import uuid
from types import SimpleNamespace

import pytest

# Make `import app...` work when pytest is run from backend/
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.security.jwt import create_access_token  # noqa: E402


@pytest.fixture
def client():
    # No `with` block -> app lifespan (DB migrations, Redis, admin seed) is not run
    return TestClient(app)


@pytest.fixture
def user_token():
    """Return (user_id, bearer token) for a candidate."""
    user_id = uuid.uuid4()
    return user_id, create_access_token(str(user_id), "user", "candidate@example.com")


@pytest.fixture
def fake_session(monkeypatch):
    """
    Patch session_repo.get_session to return an in-memory session owned by `owner_id`.
    Usage: sess = fake_session(owner_id)
    """
    from app.repositories import session_repo

    def _make(owner_id=None):
        sess = SimpleNamespace(
            id=uuid.uuid4(),
            owner_id=owner_id,
            candidate_name="Candidate",
            extracted_skills=["Python"],
            extracted_role="python",
            extracted_company="Self-Declared",
        )

        async def _get_session(db, session_id):
            return sess if session_id == sess.id else None

        monkeypatch.setattr(session_repo, "get_session", _get_session)
        return sess

    return _make
