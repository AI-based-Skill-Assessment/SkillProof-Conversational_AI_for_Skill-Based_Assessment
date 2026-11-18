"""
MCA21 company lookup (data.gov.in), Tamil-English answers, and live (Pipecat) mode.
No network, Groq or database: the external calls are replaced by fakes.
"""
import asyncio
import io
import uuid
import wave
from types import SimpleNamespace

import pytest

from app.ai_engine import live_interview, multilingual
from app.core import verification_engine as ve
from app.main import app
from app.security.deps import get_current_user


def run(coro):
    return asyncio.run(coro)


# ── MCA21 ────────────────────────────────────────────────────────────────────

def test_mca_name_variants_spell_out_legal_suffix():
    assert ve.mca_name_variants("Infosys Ltd.") == ["INFOSYS LIMITED"]
    assert ve.mca_name_variants("Zoho Corporation Pvt. Ltd") == ["ZOHO CORPORATION PRIVATE LIMITED"]
    assert ve.mca_name_variants("abc solutions (P) Ltd") == ["ABC SOLUTIONS PRIVATE LIMITED"]
    assert ve.mca_name_variants("Savic Technologies") == [
        "SAVIC TECHNOLOGIES", "SAVIC TECHNOLOGIES PRIVATE LIMITED", "SAVIC TECHNOLOGIES LIMITED"]
    assert ve.mca_name_variants("") == []


def test_mca_name_lookup_tries_registry_spellings(monkeypatch):
    asked = []

    async def fake_query(field, value):
        asked.append((field, value))
        if value == "SAVIC TECHNOLOGIES PRIVATE LIMITED":
            return {"cin": "U72200TN2010PTC000001", "companyName": value, "companyStatus": "Active",
                    "registrationDate": "2010-01-01", "roc": "ROC Chennai", "source": "mca21_ogd"}
        return None

    monkeypatch.setattr(ve, "_mca_ogd_query", fake_query)
    rec = run(ve.verify_company_name_mca("Savic Technologies"))
    assert rec["cin"] == "U72200TN2010PTC000001"
    assert asked == [("CompanyName", "SAVIC TECHNOLOGIES"), ("CompanyName", "SAVIC TECHNOLOGIES PRIVATE LIMITED")]


def test_cin_lookup_uses_master_data(monkeypatch):
    async def fake_query(field, value):
        assert (field, value) == ("CIN", "L85110KA1981PLC013115")
        return {"cin": value, "companyName": "INFOSYS LIMITED", "companyStatus": "Active"}

    monkeypatch.setattr(ve, "_mca_ogd_query", fake_query)
    assert run(ve._verify_cin("l85110ka1981plc013115"))["companyName"] == "INFOSYS LIMITED"


def test_mca_record_mapping():
    rec = ve._mca_record_to_dict({"CIN": "X", "CompanyName": "A LIMITED", "CompanyStatus": "Strike Off",
                                  "CompanyRegistrationdate_date": "2001-02-03", "CompanyROCcode": "ROC Delhi"})
    assert rec == {"cin": "X", "companyName": "A LIMITED", "companyStatus": "Strike Off",
                   "registrationDate": "2001-02-03", "roc": "ROC Delhi", "companyClass": None,
                   "state": None, "source": "mca21_ogd"}


# ── Tamil-English ────────────────────────────────────────────────────────────

class FakeGroq:
    def __init__(self, transcript="naan React use pannen", language="tamil", translation="I used React.",
                 fail_translation=False):
        self.transcript, self.language = transcript, language
        self.translation, self.fail = translation, fail_translation
        self.calls = []

    async def transcribe_audio(self, audio, filename="a.webm"):
        self.calls.append("en")
        return "I used React."

    async def transcribe_audio_detailed(self, audio, filename="a.webm", language=None, prompt=None):
        self.calls.append(("detailed", language, bool(prompt)))
        return {"text": self.transcript, "language": self.language}

    async def chat_completion(self, messages, **kw):
        assert kw.get("allow_simulation") is False and kw.get("temperature") == 0.0
        if self.fail:
            raise multilingual.GroqUnavailable("down")
        return f"<think>reasoning</think>{self.translation}"


def test_english_mode_is_unchanged(monkeypatch):
    g = FakeGroq()
    monkeypatch.setattr(multilingual, "groq_client", g)
    r = run(multilingual.transcribe_answer(b"x", "a.webm", "en"))
    assert r == {"text": "I used React.", "original": None, "language": "english", "mode": "en", "translated": False}
    assert g.calls == ["en"]


def test_tamil_english_is_translated_and_original_kept(monkeypatch):
    g = FakeGroq()
    monkeypatch.setattr(multilingual, "groq_client", g)
    r = run(multilingual.transcribe_answer(b"x", "a.webm", "ta-en"))
    assert r["text"] == "I used React."                    # think tags stripped
    assert r["original"] == "naan React use pannen"
    assert r["translated"] is True and r["mode"] == "ta-en"
    assert g.calls == [("detailed", None, True)]          # language auto-detected, code-mixed prompt


def test_translation_failure_keeps_the_answer(monkeypatch):
    monkeypatch.setattr(multilingual, "groq_client", FakeGroq(fail_translation=True))
    r = run(multilingual.transcribe_answer(b"x", "a.webm", "ta-en"))
    assert r["text"] == "naan React use pannen" and r["translated"] is False


def test_unknown_language_falls_back_to_english():
    assert multilingual.normalise_mode("fr") == "en"
    assert multilingual.normalise_mode(" TA-EN ") == "ta-en"
    assert multilingual.has_tamil_script("நான் React") and not multilingual.has_tamil_script("naan React")


def test_original_answer_is_stored_in_transcript(monkeypatch):
    from app.ai_engine.interview_manager import InterviewManager
    m = InterviewManager()
    store = {}

    async def get_history(sid):
        return store.setdefault(sid, [{"role": "assistant", "content": "Q1"}])

    async def save(*a, **k):
        return None

    monkeypatch.setattr(m, "get_history", get_history)

    async def no_llm(*a, **k):
        raise RuntimeError("no network in tests")

    monkeypatch.setattr(m.groq, "chat_completion", no_llm)
    for name in ("save_history", "_save_history", "set_history"):
        if hasattr(m, name):
            monkeypatch.setattr(m, name, save)
    sid = uuid.uuid4()
    try:
        run(m.process_turn(sid, "I used React.", "Asha", ["React"], original_text="naan React use pannen",
                           answer_language="tamil"))
    except Exception:
        pass  # only the stored answer matters here, not question generation
    user = [x for x in store[sid] if x["role"] == "user"][0]
    assert user["content"] == "I used React."
    assert user["original"] == "naan React use pannen" and user["language"] == "tamil"


def test_transcribe_endpoint_requires_login(client):
    r = client.post("/api/v1/interview/transcribe", files={"audio": ("a.webm", b"0" * 200, "audio/webm")})
    assert r.status_code == 403            # no bearer token


# ── Live mode (Pipecat) ──────────────────────────────────────────────────────

def test_pcm16_to_wav_roundtrip():
    pcm = (b"\x01\x00" * 16000)
    with wave.open(io.BytesIO(live_interview.pcm16_to_wav(pcm, 16000))) as w:
        assert (w.getframerate(), w.getnchannels(), w.getsampwidth(), w.getnframes()) == (16000, 1, 2, 16000)


def test_answer_message_combines_transcript_and_voice_check(monkeypatch):
    import app.controllers.biometric as B
    from app.core import speaker_embedding as SE

    async def fake_transcribe(audio, filename, mode):
        return {"text": "I used React.", "original": "naan React use pannen", "language": "tamil", "translated": True}

    async def fake_verify(db, session_id, emb):
        return {"voice_match": True, "voice_confidence": 0.71}

    class FakeSession:
        async def __aenter__(self):
            return object()

        async def __aexit__(self, *a):
            return False

    monkeypatch.setattr(multilingual, "transcribe_answer", fake_transcribe)
    monkeypatch.setattr(B, "verify_session_voice", fake_verify)
    monkeypatch.setattr(SE, "embed_wav_bytes", lambda b: [0.0] * 192)
    monkeypatch.setattr("app.database.async_session_factory", lambda: FakeSession())
    msg = run(live_interview.process_answer_audio(uuid.uuid4(), b"wav", "ta-en"))
    assert msg == {"type": "answer", "text": "I used React.", "original": "naan React use pannen",
                   "language": "tamil", "translated": True, "voice": {"voice_match": True, "voice_confidence": 0.71}}


def test_answer_survives_a_failed_voice_check(monkeypatch):
    from app.core import speaker_embedding as SE

    async def fake_transcribe(audio, filename, mode):
        return {"text": "hello there", "original": None, "language": "english", "translated": False}

    def boom(b):
        raise SE.SpeakerModelUnavailable("no model")

    monkeypatch.setattr(multilingual, "transcribe_answer", fake_transcribe)
    monkeypatch.setattr(SE, "embed_wav_bytes", boom)
    msg = run(live_interview.process_answer_audio(uuid.uuid4(), b"wav", "en"))
    assert msg["type"] == "answer" and msg["text"] == "hello there" and msg["voice"]["voice_match"] is None


def test_live_offer_requires_login(client):
    r = client.post(f"/api/v1/live/{uuid.uuid4()}/offer", json={"sdp": "v=0", "type": "offer"})
    assert r.status_code == 403            # no bearer token


def test_live_offer_503_without_pipecat(client, monkeypatch):
    async def _user():
        return SimpleNamespace(id=uuid.uuid4())

    app.dependency_overrides[get_current_user] = _user
    monkeypatch.setattr(live_interview, "is_available", lambda: False)
    try:
        r = client.post(f"/api/v1/live/{uuid.uuid4()}/offer", json={"sdp": "v=0", "type": "offer"})
    finally:
        app.dependency_overrides.pop(get_current_user, None)
    assert r.status_code == 503
    assert client.get("/api/v1/live/status").json() == {"available": False}


def test_segmenter_joins_pauses_into_one_answer(monkeypatch):
    pytest.importorskip("pipecat")
    from pipecat.frames.frames import InputAudioRawFrame, VADUserStartedSpeakingFrame, VADUserStoppedSpeakingFrame

    sent = []
    seg = live_interview.build_answer_segmenter(SimpleNamespace(send_app_message=sent.append), uuid.uuid4(), "en")

    async def no_push(frame, direction=None):
        return None

    async def no_super(self, frame, direction):
        return None

    seg.push_frame = no_push
    monkeypatch.setattr(type(seg).__mro__[1], "process_frame", no_super)
    got = {}

    async def fake_process(session_id, wav, language):
        with wave.open(io.BytesIO(wav)) as w:
            got["secs"] = w.getnframes() / w.getframerate()
        return {"type": "answer", "text": "ok"}

    monkeypatch.setattr(live_interview, "process_answer_audio", fake_process)
    monkeypatch.setattr(live_interview, "TURN_END_SECS", 0.05)
    chunk = b"\x00\x01" * 320   # 20 ms at 16 kHz

    async def scenario():
        audio = lambda: InputAudioRawFrame(audio=chunk, sample_rate=16000, num_channels=1)
        await seg.process_frame(VADUserStartedSpeakingFrame(), None)
        for _ in range(50):                      # 1 s of speech
            await seg.process_frame(audio(), None)
        await seg.process_frame(VADUserStoppedSpeakingFrame(), None)
        await seg.process_frame(VADUserStartedSpeakingFrame(), None)   # resumes before the turn ends
        for _ in range(50):                      # 1 s more
            await seg.process_frame(audio(), None)
        await seg.process_frame(VADUserStoppedSpeakingFrame(), None)
        await asyncio.sleep(0.2)

    run(scenario())
    assert [m["type"] for m in sent] == ["speaking", "processing", "answer"]
    assert 1.9 <= got["secs"] <= 2.1             # both parts, one answer

    sent.clear()
    seg.set_listening(False)                     # question being read out: nothing is captured

    async def muted():
        await seg.process_frame(VADUserStartedSpeakingFrame(), None)
        await seg.process_frame(VADUserStoppedSpeakingFrame(), None)
        await asyncio.sleep(0.1)

    run(muted())
    assert sent == []


def test_mca_cascade_records_a_valid_db_path(monkeypatch):
    """Every verification_path the cascade returns must exist in the DB enum."""
    from app.models.document import VerificationPath

    async def active(name):
        return {"cin": "U1", "companyName": "SAVIC TECHNOLOGIES PRIVATE LIMITED", "companyStatus": "Active",
                "registrationDate": "2010-01-01", "roc": "ROC Chennai", "source": "mca21_ogd"}

    monkeypatch.setattr(ve, "verify_company_name_mca", active)
    r = run(ve.verify_company_mca21("Savic Technologies", None, raw_ocr_text="Savic Technologies certificate"))
    assert r["fetch_status"] == "verified"
    assert r["verification_path"] in {p.value for p in VerificationPath}
    assert "data.gov.in" in r["fetched_content_snippet"]
