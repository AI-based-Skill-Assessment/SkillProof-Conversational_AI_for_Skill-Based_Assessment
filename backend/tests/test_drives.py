"""
Placement drives: creation rules, ranking, access control, joining, CSV export.
Runs without a database: a tiny fake AsyncSession returns queued query results.
"""
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.ai_engine.interview_manager import InterviewManager
from app.controllers import drives as drives_ctrl
from app.database import get_db
from app.main import app
from app.repositories import session_repo
from app.security.deps import get_current_org, get_current_user

ORG_ID = uuid.uuid4()
USER_ID = uuid.uuid4()


class _Result:
    def __init__(self, value):
        self._v = value

    def scalar_one_or_none(self):
        return self._v

    def scalars(self):
        v = self._v if isinstance(self._v, list) else ([] if self._v is None else [self._v])
        return SimpleNamespace(all=lambda: v, first=lambda: v[0] if v else None)


class FakeDB:
    """execute() returns queued results in order (None once the queue is empty)."""

    def __init__(self, *results):
        self.results = list(results)
        self.added = []
        self.committed = False

    async def execute(self, stmt):
        return _Result(self.results.pop(0) if self.results else None)

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        for o in self.added:
            if getattr(o, "id", None) is None:
                o.id = uuid.uuid4()
            if getattr(o, "created_at", None) is None and hasattr(o, "created_at"):
                o.created_at = datetime.now(timezone.utc)

    async def refresh(self, obj):
        pass

    async def commit(self):
        self.committed = True


@pytest.fixture
def use_db():
    holder = {}

    def _install(db):
        holder["db"] = db

        async def _get():
            yield db

        app.dependency_overrides[get_db] = _get
        return db

    yield _install
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def as_org():
    async def _org():
        return SimpleNamespace(id=ORG_ID, name="Test College")

    app.dependency_overrides[get_current_org] = _org
    yield
    app.dependency_overrides.pop(get_current_org, None)


@pytest.fixture
def as_user():
    user = SimpleNamespace(
        id=USER_ID, full_name="Asha", email="asha@x.com",
        face_embedding=None, voice_embedding=None,
    )

    async def _user():
        return user

    app.dependency_overrides[get_current_user] = _user
    yield user
    app.dependency_overrides.pop(get_current_user, None)


def _drive(**kw):
    base = dict(
        id=uuid.uuid4(), org_id=ORG_ID, title="Campus Drive", role="GET", description=None,
        skills=["Python", "SQL"], invite_code="ABCD2345", deadline=None, min_score=60.0,
        status="open", created_at=datetime(2026, 11, 1, tzinfo=timezone.utc),
        organisation=SimpleNamespace(name="Test College", org_type=None, status=drives_ctrl.OrgStatus.approved),
    )
    base.update(kw)
    return SimpleNamespace(**base)


# ── Creating drives ──────────────────────────────────────────────────────────

def test_create_drive_generates_code_and_cleans_skills(client, as_org, use_db):
    db = use_db(FakeDB())
    r = client.post("/api/v1/org/drives", json={
        "title": "TCS Campus Drive", "skills": [" Python ", "python", "SQL", ""], "min_score": 70,
    })
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["skills"] == ["Python", "SQL"]            # trimmed, de-duplicated, blanks dropped
    assert len(body["invite_code"]) == 8
    assert set(body["invite_code"]) <= set(drives_ctrl._CODE_ALPHABET)
    assert body["accepting"] is True
    assert db.committed


def test_create_drive_rejects_past_deadline(client, as_org, use_db):
    use_db(FakeDB())
    past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    r = client.post("/api/v1/org/drives", json={"title": "Old drive", "skills": ["Java"], "deadline": past})
    assert r.status_code == 400


def test_create_drive_needs_a_skill(client, as_org, use_db):
    use_db(FakeDB())
    r = client.post("/api/v1/org/drives", json={"title": "No skills", "skills": ["  "]})
    assert r.status_code == 422


def test_drive_endpoints_reject_candidate_tokens(client, user_token):
    _, token = user_token
    r = client.get("/api/v1/org/drives", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403


# ── Access control ───────────────────────────────────────────────────────────

def test_cannot_view_another_orgs_drive(client, as_org, use_db):
    use_db(FakeDB(_drive(org_id=uuid.uuid4())))
    r = client.get(f"/api/v1/org/drives/{uuid.uuid4()}")
    assert r.status_code == 404


def test_decision_only_for_sessions_in_this_drive(client, as_org, use_db, monkeypatch):
    drive = _drive()
    use_db(FakeDB(drive))

    async def _get_session(db, sid):
        return SimpleNamespace(id=sid, drive_id=uuid.uuid4(), drive_decision="pending")   # other drive

    monkeypatch.setattr(session_repo, "get_session", _get_session)
    r = client.post(f"/api/v1/org/drives/{drive.id}/candidates/{uuid.uuid4()}/decision", json={"decision": "shortlisted"})
    assert r.status_code == 404


def test_decision_is_saved(client, as_org, use_db, monkeypatch):
    drive = _drive()
    db = use_db(FakeDB(drive))
    sess = SimpleNamespace(id=uuid.uuid4(), drive_id=drive.id, drive_decision="pending")

    async def _get_session(_db, sid):
        return sess

    monkeypatch.setattr(session_repo, "get_session", _get_session)
    r = client.post(f"/api/v1/org/drives/{drive.id}/candidates/{sess.id}/decision", json={"decision": "shortlisted"})
    assert r.status_code == 200
    assert sess.drive_decision == "shortlisted"
    assert db.committed


# ── Ranking ──────────────────────────────────────────────────────────────────

def _row(name, status, score, flagged=False, started="2026-11-01"):
    return {"session_id": name, "full_name": name, "email": "", "status": status, "score": score,
            "verdict": None, "integrity_score": None, "flagged": flagged, "decision": "pending",
            "started_at": started, "candidate_id": None}


def test_ranking_orders_by_score_and_sinks_flagged_ties():
    ranked = drives_ctrl.rank_candidates([
        _row("low", "scored", 40.0),
        _row("busy", "ocr_done", None, started="2026-11-05"),
        _row("top", "scored", 90.0),
        _row("tie_flagged", "scored", 75.0, flagged=True),
        _row("tie_clean", "scored", 75.0),
    ], min_score=60.0)
    assert [r["session_id"] for r in ranked] == ["top", "tie_clean", "tie_flagged", "low", "busy"]
    assert [r["rank"] for r in ranked] == [1, 2, 3, 4, None]
    assert [r["meets_min_score"] for r in ranked] == [True, True, True, False, None]


def test_drive_not_accepting_after_deadline_or_when_closed():
    past = datetime.now(timezone.utc) - timedelta(minutes=1)
    assert drives_ctrl._is_accepting(_drive()) is True
    assert drives_ctrl._is_accepting(_drive(deadline=past)) is False
    assert drives_ctrl._is_accepting(_drive(status="closed")) is False


# ── Candidates ───────────────────────────────────────────────────────────────

def test_public_invite_hides_pass_mark(client, use_db):
    use_db(FakeDB(_drive()))
    r = client.get("/api/v1/drives/invite/abcd2345")
    assert r.status_code == 200
    body = r.json()
    assert body["organisation"]["name"] == "Test College"
    assert "min_score" not in body and "id" not in body


def test_invite_for_unapproved_org_is_404(client, use_db):
    d = _drive()
    d.organisation.status = "pending"
    use_db(FakeDB(d))
    assert client.get("/api/v1/drives/invite/ABCD2345").status_code == 404


def test_join_resumes_existing_attempt(client, as_user, use_db):
    existing = SimpleNamespace(id=uuid.uuid4(), status="scored")
    use_db(FakeDB(_drive(), [existing]))
    r = client.post("/api/v1/drives/invite/ABCD2345/join")
    assert r.status_code == 200
    assert r.json() == {"session_id": str(existing.id), "status": "scored", "resumed": True}


def test_join_closed_drive_is_rejected(client, as_user, use_db):
    use_db(FakeDB(_drive(status="closed"), []))
    r = client.post("/api/v1/drives/invite/ABCD2345/join")
    assert r.status_code == 400


def test_join_creates_session_with_drive_skills_and_approved_link(client, as_user, use_db, monkeypatch):
    drive = _drive()
    db = use_db(FakeDB(drive, [], None))       # drive, no existing attempt, no existing link
    created = SimpleNamespace(id=uuid.uuid4(), extracted_skills=None, drive_id=None, drive_decision=None)

    async def _create(_db, session_in, owner_id=None):
        assert owner_id == USER_ID and session_in.intake_mode == "skill_only"
        return created

    async def _ingest(_db, sid, skill_text, role):
        assert sid == created.id and skill_text == "Python, SQL" and role == "GET"

    monkeypatch.setattr(session_repo, "create_session", _create)
    monkeypatch.setattr(drives_ctrl._ingest, "ingest_skill_only", _ingest)

    r = client.post("/api/v1/drives/invite/ABCD2345/join")
    assert r.status_code == 200, r.text
    assert r.json()["resumed"] is False
    assert created.extracted_skills == ["Python", "SQL"]
    assert created.drive_id == drive.id and created.drive_decision == "pending"
    links = [o for o in db.added if type(o).__name__ == "UserOrganisationLink"]
    assert len(links) == 1 and links[0].status == drives_ctrl.LinkStatus.approved


# ── CSV export & interview wording ───────────────────────────────────────────

def test_csv_cells_cannot_run_formulas():
    assert drives_ctrl._csv_safe("=HYPERLINK(\"x\")") == "'=HYPERLINK(\"x\")"
    assert drives_ctrl._csv_safe("Asha") == "Asha"


def test_drive_q2_asks_about_skills_not_role():
    q2 = InterviewManager._q2_text("Graduate Engineer Trainee", "Self-Declared", ["Python", "SQL"])
    assert "Python and SQL" in q2
    assert "used Graduate Engineer Trainee" not in q2
