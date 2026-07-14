import pytest
from app.core.voice_verifier import diagnose_voice_pattern, voice_verdict_summary

def test_stable_confirmed():
    scores = [0.85, 0.90, 0.88, 0.92]
    label, fraud, note = diagnose_voice_pattern(scores)
    assert label == "stable_confirmed"
    assert not fraud
    assert "consistently verified" in note.lower()

def test_stable_uncertain():
    scores = [0.70, 0.72, 0.75, 0.68]
    label, fraud, note = diagnose_voice_pattern(scores)
    assert label == "stable_uncertain"
    assert not fraud
    assert "uncertain band" in note.lower()

def test_stable_mismatch():
    scores = [0.50, 0.45, 0.55, 0.48]
    label, fraud, note = diagnose_voice_pattern(scores)
    assert label == "stable_mismatch"
    assert fraud
    assert "voice mismatch" in note.lower()

def test_proxy_switch():
    # First half high, second half low
    scores = [0.90, 0.92, 0.50, 0.45]
    label, fraud, note = diagnose_voice_pattern(scores)
    assert label == "proxy_switch"
    assert fraud
    assert "proxy switch detected" in note.lower()

def test_improving():
    scores = [0.65, 0.72, 0.80, 0.88]
    label, fraud, note = diagnose_voice_pattern(scores)
    assert label == "improving"
    assert not fraud
    assert "improved progressively" in note.lower()

def test_declining_suspicious():
    # Declining and low average
    scores = [0.60, 0.55, 0.48, 0.40]
    label, fraud, note = diagnose_voice_pattern(scores)
    assert label == "declining"
    assert fraud
    assert "declined progressively" in note.lower()

def test_volatile():
    scores = [0.90, 0.40, 0.85, 0.35]
    label, fraud, note = diagnose_voice_pattern(scores)
    assert label == "volatile"
    assert not fraud
    assert "high volatility" in note.lower()

def test_voice_summary_helper():
    scores = [0.90, 0.92, 0.50, 0.45]
    summary = voice_verdict_summary(scores)
    assert summary["voice_pattern"] == "proxy_switch"
    assert summary["voice_fraud_signal"] is True
    assert summary["voice_avg_score"] == 0.6925
    assert "PROXY SWITCH" in summary["voice_notes"]
