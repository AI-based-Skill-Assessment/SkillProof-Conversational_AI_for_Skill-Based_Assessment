"""
Email notifications: sent over SMTP when configured, logged otherwise,
user-supplied text escaped, and never able to break the request that triggered it.
"""
import uuid
from types import SimpleNamespace

import pytest

from app.config import settings
from app.services import email_service


class FakeSMTP:
    sent = []

    def __init__(self, host, port, timeout=None, **kw):
        self.host, self.port = host, port

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def starttls(self, context=None):
        pass

    def login(self, user, pw):
        pass

    def send_message(self, msg):
        FakeSMTP.sent.append(msg)


@pytest.fixture
def smtp(monkeypatch):
    FakeSMTP.sent = []
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.test")
    monkeypatch.setattr(settings, "SMTP_SECURITY", "starttls")
    monkeypatch.setattr(email_service.smtplib, "SMTP", FakeSMTP)
    return FakeSMTP.sent


def _html(msg):
    return msg.get_body(preferencelist=("html",)).get_content()


def test_results_email_is_sent_with_report_link(smtp):
    sid = uuid.uuid4()
    email_service.notify_results_ready("asha@college.edu", "Asha", sid, ["Python", "SQL"], 72.5)
    assert len(smtp) == 1
    msg = smtp[0]
    assert msg["To"] == "asha@college.edu"
    assert "results are ready" in msg["Subject"]
    assert f"/user/reports/{sid}" in _html(msg)
    assert "72.5%" in _html(msg)


def test_user_text_is_escaped(smtp):
    email_service.notify_drive_completion(
        "hr@company.com", "Acme", uuid.uuid4(), "<b>Drive</b>", "<script>alert(1)</script>", None)
    body = _html(smtp[0])
    assert "<script>" not in body and "&lt;script&gt;" in body
    assert "<b>Drive</b>" not in body


def test_invalid_or_placeholder_addresses_are_skipped(smtp):
    email_service.notify_results_ready(None, "x", uuid.uuid4(), [], None)
    email_service.notify_results_ready("not-an-email", "x", uuid.uuid4(), [], None)
    email_service.notify_results_ready("anonymous@example.com", "x", uuid.uuid4(), [], None)
    assert smtp == []


def test_without_smtp_config_nothing_is_sent(monkeypatch, capsys):
    monkeypatch.setattr(settings, "SMTP_HOST", "")
    called = []
    monkeypatch.setattr(email_service.smtplib, "SMTP", lambda *a, **k: called.append(1))
    email_service.notify_org_status("org@college.edu", "College", approved=True)
    assert called == []
    assert "SMTP not configured" in capsys.readouterr().out


def test_smtp_failure_never_raises(monkeypatch):
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.test")

    def boom(*a, **k):
        raise OSError("connection refused")

    monkeypatch.setattr(email_service.smtplib, "SMTP", boom)
    email_service.notify_org_status("org@college.edu", "College", approved=False, reason="Incomplete")


def test_shortlisting_emails_the_candidate(client, monkeypatch):
    from app.controllers import drives as drives_ctrl
    from app.database import get_db
    from app.main import app
    from app.repositories import session_repo
    from app.security.deps import get_current_org

    org_id = uuid.uuid4()
    drive = SimpleNamespace(id=uuid.uuid4(), org_id=org_id, title="Campus Drive")
    sess = SimpleNamespace(id=uuid.uuid4(), drive_id=drive.id, drive_decision="pending",
                           candidate_email="asha@college.edu", candidate_name="Asha")
    sent = []

    class _DB:
        async def execute(self, stmt):
            return SimpleNamespace(scalar_one_or_none=lambda: drive)

        def add(self, o):
            pass

        async def commit(self):
            pass

    async def _db():
        yield _DB()

    async def _org():
        return SimpleNamespace(id=org_id, name="Test College")

    async def _get_session(db, sid):
        return sess

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_current_org] = _org
    monkeypatch.setattr(session_repo, "get_session", _get_session)
    monkeypatch.setattr(email_service, "notify_shortlisted", lambda *a: sent.append(a))
    try:
        url = f"/api/v1/org/drives/{drive.id}/candidates/{sess.id}/decision"
        assert client.post(url, json={"decision": "shortlisted"}).status_code == 200
        assert client.post(url, json={"decision": "shortlisted"}).status_code == 200   # no second email
        client.post(url, json={"decision": "rejected"})                                  # no email on reject
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_org, None)

    assert sent == [("asha@college.edu", "Asha", "Campus Drive", "Test College")]
