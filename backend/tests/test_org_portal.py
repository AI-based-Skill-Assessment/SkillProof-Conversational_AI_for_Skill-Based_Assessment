"""
Organisation portal: real candidate / report / analytics data and access rules.
"""
import uuid
from datetime import datetime
from types import SimpleNamespace

import pytest

from app.controllers import org_portal
from app.database import get_db
from app.main import app
from app.repositories import link_repo
from app.security.deps import get_current_org


ORG_ID = uuid.uuid4()


@pytest.fixture
def as_org():
    """Log the test client in as an approved organisation (no DB needed)."""
    async def _org():
        return SimpleNamespace(id=ORG_ID, name="Test College")

    async def _db():
        yield None

    app.dependency_overrides[get_current_org] = _org
    app.dependency_overrides[get_db] = _db
    yield
    app.dependency_overrides.pop(get_current_org, None)
    app.dependency_overrides.pop(get_db, None)


def _score(overall, verdict):
    return SimpleNamespace(
        overall_skill_score=overall, depth_score=overall, specificity_score=overall,
        consistency_score=overall, verdict=verdict,
    )


def _session(status, skills, scores, created, mode="skill_only"):
    return SimpleNamespace(
        id=uuid.uuid4(), status=status, intake_mode=mode, extracted_skills=skills,
        extracted_role=None, extracted_company=None, created_at=created, scores=scores,
    )


def _profile(**kw):
    base = dict(
        integrity_score=100.0, fraud_status="clean", interview_flagged=False, flag_reasons=[],
        tab_switch_count=0, window_blur_count=0, copy_paste_attempts=0, gaze_violations=0,
        camera_interruptions=0, face_mismatch_count=0, voice_mismatch_count=0,
        secondary_speaker_count=0, face_verify_pass=0, voice_verify_pass=0,
        face_duplicate_detected=False, voice_duplicate_detected=False,
    )
    base.update(kw)
    return SimpleNamespace(**base)


@pytest.fixture
def two_candidates(monkeypatch):
    """Asha: one verified (90) + one flagged suspicious (50). Ravi: one in progress."""
    asha_id, ravi_id = str(uuid.uuid4()), str(uuid.uuid4())
    good = _session("scored", ["Python"], [_score(90.0, "verified")], datetime(2026, 10, 3))
    bad = _session("scored", ["SQL"], [_score(70.0, "verified"), _score(30.0, "suspicious")], datetime(2026, 11, 2))
    pending = _session("verified", ["Java"], [], datetime(2026, 11, 5))

    data = [
        {
            "id": asha_id, "link_id": str(uuid.uuid4()), "full_name": "Asha", "email": "asha@x.com",
            "connected_at": "2026-09-01T00:00:00", "face_registered": True, "voice_registered": True,
            "assessments": [
                org_portal._summarise_session(bad, _profile(integrity_score=55.0, interview_flagged=True, tab_switch_count=3)),
                org_portal._summarise_session(good, _profile()),
            ],
        },
        {
            "id": ravi_id, "link_id": str(uuid.uuid4()), "full_name": "Ravi", "email": "ravi@x.com",
            "connected_at": "2026-10-01T00:00:00", "face_registered": False, "voice_registered": False,
            "assessments": [org_portal._summarise_session(pending, None)],
        },
    ]

    async def _load(db, org_id):
        assert org_id == ORG_ID
        return data

    monkeypatch.setattr(org_portal, "load_connected_candidates", _load)
    return asha_id, ravi_id


# ── Summaries ────────────────────────────────────────────────────────────────

def test_session_summary_uses_worst_verdict_and_average():
    s = _session("scored", ["SQL"], [_score(70.0, "verified"), _score(30.0, "suspicious")], datetime(2026, 1, 1))
    out = org_portal._summarise_session(s, None)
    assert out["score"] == 50.0
    assert out["verdict"] == "suspicious"
    assert out["integrity"] is None


def test_candidates_list_has_real_stats(client, as_org, two_candidates):
    r = client.get("/api/v1/org/candidates")
    assert r.status_code == 200, r.text
    asha, ravi = r.json()
    assert asha["assessments_count"] == 2
    assert asha["average_score"] == 70.0          # (50 + 90) / 2, not a hardcoded 88
    assert asha["flagged"] is True
    assert asha["integrity_score"] == 55.0         # worst session
    assert ravi["average_score"] is None           # nothing scored yet
    assert ravi["latest_status"] == "verified"


def test_candidate_detail_includes_proctoring(client, as_org, two_candidates):
    asha_id, _ = two_candidates
    r = client.get(f"/api/v1/org/candidates/{asha_id}")
    assert r.status_code == 200
    latest = r.json()["assessments"][0]
    assert latest["integrity"]["tab_switch_count"] == 3


def test_unconnected_candidate_is_404(client, as_org, two_candidates):
    r = client.get(f"/api/v1/org/candidates/{uuid.uuid4()}")
    assert r.status_code == 404


def test_reports_only_completed_newest_first(client, as_org, two_candidates):
    r = client.get("/api/v1/org/reports")
    reports = r.json()
    assert len(reports) == 2                        # Ravi's in-progress one is excluded
    assert reports[0]["skills"] == ["SQL"]
    assert reports[0]["flagged"] is True


def test_analytics_counts(client, as_org, two_candidates):
    data = client.get("/api/v1/org/analytics").json()
    assert data["totals"] == {
        "candidates": 2, "assessments": 3, "completed": 2, "in_progress": 1,
        "flagged": 1, "average_score": 70.0,
    }
    dist = {d["key"]: d["value"] for d in data["verification_distribution"]}
    assert dist == {"verified": 1, "suspicious": 1, "likely_fraudulent": 0, "in_progress": 1}
    assert data["completion_trend"] == [{"month": "2026-10", "count": 1}, {"month": "2026-11", "count": 1}]
    assert data["top_skills"] == [{"skill": "Python", "count": 1}]   # only verified skills


def test_org_endpoints_reject_candidate_tokens(client, user_token):
    _, token = user_token
    r = client.get("/api/v1/org/candidates", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403


# ── Link approval ownership ──────────────────────────────────────────────────

def test_org_cannot_approve_another_orgs_link(client, as_org, monkeypatch):
    other_link = SimpleNamespace(id=uuid.uuid4(), org_id=uuid.uuid4())   # belongs to a different org
    called = []

    async def _get_link(db, link_id):
        return other_link

    async def _update(*a, **k):
        called.append(True)

    monkeypatch.setattr(link_repo, "get_link", _get_link)
    monkeypatch.setattr(link_repo, "update_link_status", _update)

    r = client.post(f"/api/v1/auth/org/candidates/requests/{other_link.id}/status?action=approve")
    assert r.status_code == 404
    assert not called


def test_invalid_link_action_is_400(client, as_org):
    r = client.post(f"/api/v1/auth/org/candidates/requests/{uuid.uuid4()}/status?action=delete")
    assert r.status_code == 400
