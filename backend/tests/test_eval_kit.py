"""
Evaluation kit: statistics checked against published reference values, and
each script exercised end to end on small synthetic inputs (code check only:
synthetic numbers are never results).
"""
import json
from datetime import datetime, timedelta

import numpy as np
import pytest

from eval import metrics as M


# ── Statistics vs reference values ───────────────────────────────────────────

def test_eer_and_auc_reference_cases():
    assert M.eer([.9, .8, .7], [.1, .2, .3])[0] == 0.0
    assert M.auc([.9, .8, .7], [.1, .2, .3]) == 1.0
    rate, thr = M.eer([.4, .6, .8], [.3, .5, .7])
    assert rate == pytest.approx(1 / 3) and thr == pytest.approx(0.6)
    assert M.auc([.4, .6, .8], [.3, .5, .7]) == pytest.approx(6 / 9)    # = P(genuine > impostor)


def test_rates_at_threshold():
    r = M.rates_at([.4, .6, .8], [.3, .5, .7], 0.6)
    assert r["far"] == pytest.approx(1 / 3) and r["frr"] == pytest.approx(1 / 3)
    assert r["accuracy"] == pytest.approx(4 / 6)


def test_icc_matches_shrout_fleiss_1979():
    data = [[9, 2, 5, 8], [6, 1, 3, 2], [8, 4, 6, 8], [7, 1, 2, 6], [10, 5, 6, 9], [6, 2, 4, 7]]
    assert round(M.icc_2_1(data), 2) == 0.29


def test_kappa_and_spearman_reference():
    assert M.cohen_kappa([1, 1, 0, 0], [1, 0, 0, 0], [0, 1]) == pytest.approx(0.5)
    assert M.spearman([1, 2, 2, 3], [1, 2, 3, 4]) == pytest.approx(0.9487, abs=1e-4)


# ── Biometric evaluation end to end ──────────────────────────────────────────

def test_biometric_eval_runs_on_overlapping_data(tmp_path):
    from eval import biometric_eval as B
    from eval.data import load_json

    rng = np.random.default_rng(3)
    subjects = [f"p{i}" for i in range(5)]
    face = {s: rng.normal(0, .12, 128) for s in subjects}
    voice = {s: rng.random(64) for s in subjects}
    t0 = datetime(2026, 11, 20, 10)
    probes = []
    for k, s in enumerate(subjects):
        for j in range(3):
            t = t0 + timedelta(minutes=10 * k, seconds=30 * j)
            # large noise so genuine and impostor scores overlap
            probes.append({"subject": s, "modality": "face", "session": f"s{k}", "time": t.isoformat(),
                           "embedding": (face[s] + rng.normal(0, .12, 128)).tolist()})
            probes.append({"subject": s, "modality": "voice", "session": f"s{k}",
                           "time": (t + timedelta(seconds=5)).isoformat(),
                           "embedding": (voice[s] + rng.normal(0, .3, 64)).clip(0).tolist()})
    probes.append({"subject": "p4", "claimed": "p0", "modality": "face", "session": "atk", "time": t0.isoformat(),
                   "embedding": (face["p4"] + rng.normal(0, .05, 128)).tolist()})
    path = tmp_path / "data.json"
    path.write_text(json.dumps({"templates": [{"subject": s, "face": face[s].tolist(), "voice": voice[s].tolist()}
                                              for s in subjects], "probes": probes}))
    ds = load_json(str(path))
    face_trials = B.build_trials(ds, "face")
    assert sum(g for _, g, _, _ in face_trials) == 15                    # 5 people x 3 genuine probes
    assert sum(1 for *_, k in face_trials if k == "attack") == 1
    r = B.summarise(face_trials, B.PROD_THRESHOLD["face"])
    assert 0.0 <= r["eer"] <= 1.0 and 0.0 <= r["auc"] <= 1.0
    out = tmp_path / "out"
    B.main(["--json", str(path), "--out", str(out)])
    text = (out / "biometric_results.md").read_text(encoding="utf-8")
    assert "Face only" in text and "Voice only" in text and "Fused B" in text
    assert (out / "roc_fused.csv").exists()


# ── Scoring agreement ────────────────────────────────────────────────────────

def test_perfect_agreement_scores_one():
    from eval.scoring_agreement import analyse
    ai = [{"item_id": f"I{i}", "skill": "Python", "ai_overall": v, "ai_specificity": v, "ai_depth": v,
           "ai_consistency": v, "ai_verdict": verdict}
          for i, (v, verdict) in enumerate([(10, "likely_fraudulent"), (50, "suspicious"), (80, "verified"), (90, "verified")])]
    rater = [{"rater_id": "r1", "item_id": a["item_id"], "skill": "Python",
              "human_overall": a["ai_overall"], "human_specificity": a["ai_overall"], "human_depth": a["ai_overall"],
              "human_consistency": a["ai_overall"], "human_verdict": a["ai_verdict"]} for a in ai]
    res = analyse(ai, [("r1.csv", rater)])
    assert res["dims"]["overall"]["pearson"] == pytest.approx(1.0)
    assert res["dims"]["overall"]["mae"] == 0
    assert res["verdict"]["agreement"] == 1.0
    assert res["verdict"]["kappa_w"] == pytest.approx(1.0)


def test_consensus_ties_go_to_middle():
    from eval.scoring_agreement import consensus
    assert consensus(["verified", "likely_fraudulent"]) == "suspicious"
    assert consensus(["verified", "verified", "suspicious"]) == "verified"


# ── Interview statistics ─────────────────────────────────────────────────────

def test_interview_stats_counts_follow_ups_and_latency(tmp_path):
    from eval.interview_stats import analyse, report
    ts = lambda s: (datetime(2026, 11, 20, 10) + timedelta(seconds=s)).isoformat()
    tr = [
        {"role": "assistant", "content": "Q1", "timestamp": ts(0)},
        {"role": "user", "content": "a", "timestamp": ts(10)},
        {"role": "assistant", "content": "Q2", "timestamp": ts(11), "source": "fixed", "gen_ms": 0},
        {"role": "user", "content": "b", "timestamp": ts(30)},
        {"role": "assistant", "content": "Q3", "timestamp": ts(32), "source": "ai", "gen_ms": 900, "prompt_chars": 2000, "model": "m"},
        {"role": "user", "content": "c", "timestamp": ts(50)},
        {"role": "assistant", "content": "Q4", "timestamp": ts(52), "source": "ai", "gen_ms": 1100, "prompt_chars": 2600, "model": "m"},
    ]
    per, lat, lvp, models, sources = analyse([("s1", "scored", tr)])
    assert per[0]["ai_follow_ups"] == 2 and per[0]["questions"] == 4
    assert lat[3] == [900] and lat[4] == [1100]
    assert models["m"] == 2
    text = report(per, lat, lvp, models, sources, str(tmp_path))
    assert "| T3 | 1 | 900 |" in text


def test_rater_export_removes_candidate_name():
    from eval.export_for_raters import format_transcript
    tr = [{"role": "assistant", "content": "Hello Asha Kumar, tell me about yourself."},
          {"role": "user", "content": "I am asha, a student."}]
    text = format_transcript(tr, "Asha Kumar")
    assert "asha" not in text.lower() and "kumar" not in text.lower()
    assert text.startswith("Interviewer:") and "Candidate: I am [Candidate]" in text
