# =============================================================================
# app/core/voice_verifier.py
# Voice Pattern Analyzer for SkillProof
#
# diagnose_voice_pattern() examines per-segment speaker-similarity scores
# in ORDER and returns a pattern label with fraud signal assessment.
#
# Called after the speaker-verification pipeline produces segment scores.
# The pattern label goes into the notes field of SkillScore and is displayed
# in the final report card.
# =============================================================================

from typing import List, Tuple


# ── Thresholds ────────────────────────────────────────────────────────────────
HIGH_THRESHOLD = 0.82     # above → confirmed same speaker
LOW_THRESHOLD  = 0.62     # below → likely different speaker / noise
VOLATILITY_STD = 0.08     # std deviation → "volatile" if above this
MIN_SEGMENTS   = 3        # minimum segments for trend analysis


def _std_dev(values: List[float]) -> float:
    """Compute population standard deviation."""
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((x - mean) ** 2 for x in values) / len(values)
    return variance ** 0.5


def _is_declining(scores: List[float]) -> bool:
    """Return True if scores have a consistent downward trend."""
    if len(scores) < MIN_SEGMENTS:
        return False
    # Count pairs where next < prev
    declines = sum(1 for i in range(1, len(scores)) if scores[i] < scores[i - 1])
    return declines >= (len(scores) - 1) * 0.7   # 70 %+ of pairs declining


def _is_improving(scores: List[float]) -> bool:
    """Return True if scores have a consistent upward trend."""
    if len(scores) < MIN_SEGMENTS:
        return False
    improvements = sum(1 for i in range(1, len(scores)) if scores[i] > scores[i - 1])
    return improvements >= (len(scores) - 1) * 0.7


def _is_proxy_switch(scores: List[float]) -> bool:
    """
    Proxy switch: first half averages HIGH, second half averages LOW.
    Someone else joined mid-interview.
    """
    if len(scores) < MIN_SEGMENTS:
        return False
    mid = len(scores) // 2
    first_half  = scores[:mid]
    second_half = scores[mid:]
    first_avg   = sum(first_half)  / len(first_half)
    second_avg  = sum(second_half) / len(second_half)
    return first_avg > HIGH_THRESHOLD and second_avg < LOW_THRESHOLD


def diagnose_voice_pattern(
    segment_scores: List[float]
) -> Tuple[str, bool, str]:
    """
    Analyze per-segment speaker-similarity scores (in order) and return:
        (pattern_label, voice_fraud_signal, human_readable_note)

    Pattern labels
    ──────────────
    "stable_confirmed"   → all scores > 0.82      (clean, same speaker throughout)
    "stable_uncertain"   → all in 0.62–0.82       (possibly ill voice, still likely same person)
    "stable_mismatch"    → all scores < 0.62       (strong proxy signal)
    "declining"          → scores drop progressively (fatigue or proxy took over)
    "improving"          → scores rise progressively (nerves at start → settled)
    "volatile"           → high std deviation       (bad audio / unstable connection)
    "proxy_switch"       → confirmed early, mismatch late (HIGHEST RISK — different person joined)

    Returns
    ───────
    pattern_label      : str
    voice_fraud_signal : bool  ("proxy_switch" or "stable_mismatch" force this True)
    note               : str   human-readable explanation for report card
    """
    if not segment_scores:
        return "no_data", False, "No voice segments were recorded."

    n = len(segment_scores)

    # ── Single-segment shortcut ──────────────────────────────────────────────
    if n == 1:
        s = segment_scores[0]
        if s > HIGH_THRESHOLD:
            return "stable_confirmed", False, f"Single segment score {s:.2f} — confirmed match."
        elif s >= LOW_THRESHOLD:
            return "stable_uncertain", False, f"Single segment score {s:.2f} — uncertain match."
        else:
            return "stable_mismatch", True, f"Single segment score {s:.2f} — voice mismatch detected."

    avg   = sum(segment_scores) / n
    stdev = _std_dev(segment_scores)

    # ── PROXY SWITCH (check first — highest priority) ────────────────────────
    if _is_proxy_switch(segment_scores):
        note = (
            f"⚠️ PROXY SWITCH DETECTED — Speaker confirmed in early segments "
            f"(first-half avg {sum(segment_scores[:n//2])/(n//2):.2f}) but voice "
            f"changed in later segments (second-half avg "
            f"{sum(segment_scores[n//2:])/(n-n//2):.2f}). "
            f"Different person likely joined mid-interview."
        )
        return "proxy_switch", True, note

    # ── STABLE CONFIRMED ─────────────────────────────────────────────────────
    if all(s > HIGH_THRESHOLD for s in segment_scores):
        note = (
            f"✅ Speaker consistently verified across all {n} segments "
            f"(avg {avg:.2f}, σ={stdev:.2f})."
        )
        return "stable_confirmed", False, note

    # ── IMPROVING ────────────────────────────────────────────────────────────
    if _is_improving(segment_scores):
        note = (
            f"📈 Scores improved progressively ({segment_scores[0]:.2f} → "
            f"{segment_scores[-1]:.2f}) — candidate likely nervous at start, "
            f"then settled. Normal behaviour. avg={avg:.2f}."
        )
        return "improving", False, note

    # ── DECLINING ────────────────────────────────────────────────────────────
    if _is_declining(segment_scores):
        fraud = avg < LOW_THRESHOLD   # declining AND low average → suspicious
        note = (
            f"📉 Scores declined progressively ({segment_scores[0]:.2f} → "
            f"{segment_scores[-1]:.2f}). "
            f"{'Possible proxy takeover mid-interview.' if fraud else 'Could be fatigue or audio degradation.'} "
            f"avg={avg:.2f}."
        )
        return "declining", fraud, note

    # ── STABLE MISMATCH ──────────────────────────────────────────────────────
    if all(s < LOW_THRESHOLD for s in segment_scores):
        note = (
            f"🚫 Voice mismatch across ALL {n} segments "
            f"(avg {avg:.2f}, σ={stdev:.2f}). Strong proxy signal."
        )
        return "stable_mismatch", True, note

    # ── STABLE UNCERTAIN ─────────────────────────────────────────────────────
    if all(LOW_THRESHOLD <= s <= HIGH_THRESHOLD for s in segment_scores):
        note = (
            f"⚠️ All {n} segments in the uncertain band (avg {avg:.2f}, σ={stdev:.2f}). "
            f"Possible illness, bad microphone, or accent variation. "
            f"Manual review recommended."
        )
        return "stable_uncertain", False, note

    # ── VOLATILE ─────────────────────────────────────────────────────────────
    if stdev > VOLATILITY_STD:
        note = (
            f"🔄 High volatility (σ={stdev:.2f}) across {n} segments. "
            f"Likely unstable audio connection or background noise. "
            f"avg={avg:.2f}."
        )
        return "volatile", False, note


    # ── DEFAULT FALLBACK ─────────────────────────────────────────────────────
    fraud = avg < LOW_THRESHOLD
    note = (
        f"Mixed voice pattern across {n} segments (avg={avg:.2f}, σ={stdev:.2f}). "
        f"{'Low average — review recommended.' if fraud else 'Within acceptable range.'}"
    )
    return "stable_uncertain", fraud, note


# ── Convenience wrapper ───────────────────────────────────────────────────────

def voice_verdict_summary(segment_scores: List[float]) -> dict:
    """
    Returns a complete dict ready to merge into the score/report model.
    """
    label, fraud_signal, note = diagnose_voice_pattern(segment_scores)
    avg = sum(segment_scores) / len(segment_scores) if segment_scores else 0.0

    return {
        "voice_pattern":      label,
        "voice_fraud_signal": fraud_signal,
        "voice_avg_score":    round(avg, 4),
        "voice_notes":        note,
        "segment_count":      len(segment_scores),
    }
