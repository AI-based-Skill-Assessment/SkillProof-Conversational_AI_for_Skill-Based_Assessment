"""
Scoring integrity: per-skill scores, answer feedback, and never storing a fake
grade when the AI is unavailable.
"""
import asyncio
import json
import uuid
from types import SimpleNamespace

import pytest

from app.ai_engine import groq_client as groq_mod
from app.ai_engine.groq_client import GroqClient, GroqUnavailable
from app.ai_engine.interview_context import InterviewContextBuilder
from app.ai_engine.interview_manager import InterviewManager, ScoringUnavailable
from app.controllers import score as score_ctrl

HISTORY = [
    {"role": "assistant", "content": "Tell me about yourself."},
    {"role": "user", "content": "I am a student who likes C++."},
    {"role": "assistant", "content": "Explain a stack."},
    {"role": "user", "content": "I don't know."},
]


def _manager(raw_reply=None, enabled=True, raise_unavailable=False):
    m = InterviewManager.__new__(InterviewManager)
    m.context_builder = InterviewContextBuilder()

    async def chat_completion(messages, **kw):
        if raise_unavailable:
            raise GroqUnavailable("429 rate limit")
        return raw_reply

    m.groq = SimpleNamespace(enabled=enabled, chat_completion=chat_completion)

    async def _meta(session_id):
        return {}

    m._get_meta = _meta
    return m


def _evaluate(m, skills):
    return asyncio.run(m.evaluate_interview(uuid.uuid4(), skills, history=HISTORY))


# ── Prompt ───────────────────────────────────────────────────────────────────

def test_prompt_numbers_answers_and_has_no_copyable_example_scores():
    p = InterviewContextBuilder.build_scoring_prompt(HISTORY, ["C++", "Data Structures"])
    assert "Candidate (answer 1)" in p and "Candidate (answer 2)" in p
    assert "C++, Data Structures" in p
    assert "answer_feedback" in p
    # The old schema showed 85.0/80.0/90.0, which the model copied as real scores
    assert "85.0" not in p and "90.0" not in p
    assert "<number 0-100>" in p


# ── Parsing model output ─────────────────────────────────────────────────────

def test_low_scores_are_not_rescaled_and_skill_names_are_cleaned():
    reply = json.dumps({"scores": [
        {"skill_name": "c++", "specificity_score": 4, "depth_score": 3, "consistency_score": 5,
         "overall_skill_score": 4, "verdict": "likely_fraudulent", "llm_reasoning": "No answers."},
        {"skill_name": "Data Structures.", "overall_skill_score": 12, "verdict": "???"},
    ]})
    res = _evaluate(_manager(reply), ["C++", "Data Structures"])
    cpp, ds = res["scores"]
    assert cpp["overall_skill_score"] == 4.0            # used to become 80 (4 x 20)
    assert cpp["skill_name"] == "C++"
    assert ds["skill_name"] == "Data Structures"
    assert ds["specificity_score"] == 12.0              # missing parts fall back to overall, not 70
    assert ds["verdict"] == "suspicious"                # unreadable verdict is not a pass


def test_answer_feedback_uses_real_transcript_text():
    raw = [
        {"answer_number": 2, "rating": "WEAK", "feedback": "You did not attempt it.",
         "strong_answer_points": ["LIFO order", "push and pop are O(1)"]},
        {"answer_number": 2, "rating": "strong"},          # duplicate ignored
        {"answer_number": 9, "rating": "strong"},          # out of range ignored
        {"answer_number": "x"},                            # junk ignored
        {"answer_number": 1, "rating": "brilliant", "feedback": "Brief."},
    ]
    fb = InterviewManager.parse_answer_feedback(raw, HISTORY)
    assert [f["answer_number"] for f in fb] == [1, 2]
    assert fb[1]["question"] == "Explain a stack."
    assert fb[1]["answer"] == "I don't know."
    assert fb[1]["rating"] == "weak"
    assert fb[0]["rating"] == "partial"                    # unknown rating normalised
    assert fb[1]["strong_answer_points"] == ["LIFO order", "push and pop are O(1)"]


def test_feedback_included_in_evaluation():
    reply = json.dumps({
        "scores": [{"skill_name": "C++", "overall_skill_score": 20, "verdict": "suspicious"}],
        "answer_feedback": [{"answer_number": 1, "rating": "partial", "feedback": "Say more."}],
    })
    res = _evaluate(_manager(reply), ["C++"])
    assert res["answer_feedback"][0]["question"] == "Tell me about yourself."


# ── No fake grades ───────────────────────────────────────────────────────────

def test_unusable_ai_reply_raises_instead_of_guessing():
    with pytest.raises(ScoringUnavailable):
        _evaluate(_manager("sorry, I cannot help"), ["C++"])


def test_groq_unavailable_raises_scoring_unavailable():
    with pytest.raises(ScoringUnavailable):
        _evaluate(_manager(raise_unavailable=True), ["C++"])


def test_offline_mode_guess_is_labelled_and_never_verified():
    res = _evaluate(_manager("not json", enabled=False), ["C++"])
    assert res["simulated"] is True
    assert all(s["verdict"] == "suspicious" for s in res["scores"])
    assert all(s["llm_reasoning"].startswith("[SIMULATED") for s in res["scores"])


def test_simulated_scoring_reply_is_never_verified():
    client = GroqClient.__new__(GroqClient)
    long_answers = "I really do not know anything about this topic at all sorry " * 20
    out = json.loads(client._generate_simulated_response([
        {"role": "system", "content": "You are a database compiler."},
        {"role": "user", "content": f"skills: Python\nCandidate said {long_answers}"},
    ]))
    assert all(s["verdict"] == "suspicious" for s in out["scores"])


# ── Groq retry on rate limit ─────────────────────────────────────────────────

class _RateLimit(Exception):
    status_code = 429


def _groq_with(responses, monkeypatch):
    calls = []

    def create(**kw):
        calls.append(kw)
        r = responses.pop(0)
        if isinstance(r, Exception):
            raise r
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=r))])

    async def no_sleep(_):
        return None

    monkeypatch.setattr(groq_mod.asyncio, "sleep", no_sleep)
    c = GroqClient.__new__(GroqClient)
    c.enabled = True
    c.client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    return c, calls


def test_rate_limit_is_retried(monkeypatch):
    c, calls = _groq_with([_RateLimit("429"), "ok"], monkeypatch)
    out = asyncio.run(c.chat_completion([{"role": "user", "content": "hi"}], retries=2, allow_simulation=False))
    assert out == "ok" and len(calls) == 2


def test_persistent_failure_raises_when_simulation_not_allowed(monkeypatch):
    c, _ = _groq_with([_RateLimit("429"), _RateLimit("429")], monkeypatch)
    with pytest.raises(GroqUnavailable):
        asyncio.run(c.chat_completion([{"role": "user", "content": "hi"}], retries=1, allow_simulation=False))


# ── POST /score ──────────────────────────────────────────────────────────────

def _session(status="interview_done", scores=None):
    return SimpleNamespace(
        id=uuid.uuid4(), owner_id=None, status=status, scores=scores or [],
        extracted_skills=["C++"], extracted_role="c++", interview=SimpleNamespace(transcript=HISTORY),
    )


def test_already_scored_session_is_not_rescored(client, monkeypatch):
    sess = _session(status="scored", scores=[object()])

    async def get_session(db, sid):
        return sess

    async def must_not_score(*a, **k):
        raise AssertionError("re-scored an already scored session")

    async def report(db, sid):
        return {"session_id": str(sid), "metrics": {}}

    monkeypatch.setattr(score_ctrl.session_repo, "get_session", get_session)
    monkeypatch.setattr(score_ctrl, "score_session", must_not_score)
    monkeypatch.setattr(score_ctrl.report_service, "generate_verdict", report)
    r = client.post(f"/api/v1/score/{sess.id}")
    assert r.status_code == 200


def test_scoring_unavailable_returns_503_and_saves_nothing(client, monkeypatch):
    sess = _session()
    saved = []

    async def get_session(db, sid):
        return sess

    async def unavailable(sid, skills, history=None):
        raise ScoringUnavailable("rate limited")

    async def history(sid):
        return HISTORY

    async def save(*a, **k):
        saved.append(True)

    monkeypatch.setattr(score_ctrl.session_repo, "get_session", get_session)
    monkeypatch.setattr(score_ctrl.interview_manager, "get_history", history)
    monkeypatch.setattr(score_ctrl.interview_manager, "evaluate_interview", unavailable)
    monkeypatch.setattr(score_ctrl.score_repo, "bulk_create_scores", save)
    monkeypatch.setattr(score_ctrl.session_repo, "update_session_status", save)

    from app.database import get_db
    from app.main import app

    async def fake_db():
        yield SimpleNamespace()

    app.dependency_overrides[get_db] = fake_db
    try:
        r = client.post(f"/api/v1/score/{sess.id}")
    finally:
        app.dependency_overrides.pop(get_db, None)
    assert r.status_code == 503
    assert not saved
