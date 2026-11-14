"""
Public-dataset benchmark code: protocol parsing, the LFW 10-fold rule, fusion,
and the Python port of the browser voice feature against the original JavaScript.
"""
import json
import os
import shutil
import subprocess

import numpy as np
import pytest

from eval.benchmark import run_benchmark as RB
from eval.benchmark import voice_features as V

HERE = os.path.dirname(os.path.abspath(__file__))
FRONTEND_SRC = os.path.abspath(os.path.join(HERE, "..", "..", "frontend", "src"))


# ── Manifest ─────────────────────────────────────────────────────────────────

def test_prepare_lists_parses_lfw_pairs_and_libri(tmp_path, monkeypatch):
    from eval.benchmark import prepare_lists as P
    monkeypatch.setattr(P, "CHIMERIC_SUBJECTS", 2)
    monkeypatch.setattr(P, "IMAGES_PER_SUBJECT", 2)
    data = tmp_path / "data"
    for name, n in (("Ann_A", 3), ("Bob_B", 2), ("Cy_C", 1)):
        d = data / "lfw" / name
        d.mkdir(parents=True)
        for i in range(1, n + 1):
            (d / f"{name}_{i:04d}.jpg").write_bytes(b"")
    (data / "pairs.txt").write_text("1\t2\nAnn_A\t1\t2\nBob_B\t1\t2\nAnn_A\t1\tCy_C\t1\nBob_B\t2\tAnn_A\t3\n")
    for spk, chap in (("11", "1"), ("22", "2")):
        d = data / "LibriSpeech" / "dev-clean" / spk / chap
        d.mkdir(parents=True)
        for k in range(3):
            (d / f"{spk}-{chap}-{k:04d}.flac").write_bytes(b"")
    out = tmp_path / "work"
    P.main(str(data), str(out))
    m = json.load(open(out / "manifest.json"))
    assert len(m["pairs"]) == 4 and sum(p["same"] for p in m["pairs"]) == 2
    assert m["pairs"][2] == {"a": "/data/lfw/Ann_A/Ann_A_0001.jpg", "b": "/data/lfw/Cy_C/Cy_C_0001.jpg", "same": False}
    assert [c["lfw_person"] for c in m["chimeric"]] == ["Ann_A", "Bob_B"]     # most images first
    assert len(open(out / "face_list.txt").read().split()) == 6             # unique images


# ── LFW protocol ─────────────────────────────────────────────────────────────

def test_lfw_tenfold_uses_held_out_fold():
    rows = []
    rng = np.random.default_rng(0)
    for k in range(6000):
        same = k % 2 == 0
        rows.append({"fold": k // 600, "same": same, "score": rng.normal(1.0 if same else -1.0, 0.5)})
    acc, sd = RB.lfw_tenfold_accuracy(rows)
    assert 0.95 < acc <= 1.0 and 0 <= sd < 0.05


def test_lfw_pairs_skip_undetected_faces():
    manifest = {"pairs": [{"a": "/x", "b": "/y", "same": True}, {"a": "/x", "b": "/z", "same": False}]}
    desc = {"/x": {"enrol": [0.0] * 128, "probe": [0.0] * 128}, "/y": {"enrol": None, "probe": [0.1] * 128}, "/z": None}
    rows, missing = RB.lfw_trials(manifest, desc)
    assert len(rows) == 1 and missing == 1
    assert rows[0]["score"] == pytest.approx(-np.sqrt(128 * 0.01))


# ── Fusion ───────────────────────────────────────────────────────────────────

def test_fusion_znormalises_on_impostors_and_improves_separable_case():
    rng = np.random.default_rng(1)
    rows = []
    for s in range(5):
        for _ in range(4):
            for t in range(5):
                same = s == t
                rows.append({"subject": f"s{s}", "same": same,
                             "face": rng.normal(-0.3 if same else -0.7, 0.15),
                             "voice": rng.normal(0.7 if same else 0.3, 0.15)})
    fused = RB.fuse(rows, 0.5)
    imp = [r["score"] for r in fused if not r["same"]]
    assert abs(np.mean(imp)) < 1e-9                                        # impostor mean is 0 after z-norm
    # each modality has impostor SD 1 after z-norm: their average has SD <= 1 (= 1 only if perfectly correlated)
    assert 0.5 < np.std(imp) <= 1.0 + 1e-9
    face_only = RB.fuse(rows, 1.0)
    assert abs(np.std([r["score"] for r in face_only if not r["same"]]) - 1.0) < 1e-9
    e_face = RB.summarise([{"subject": r["subject"], "same": r["same"], "score": r["face"]} for r in rows])["eer"]
    e_fused = RB.summarise(fused)["eer"]
    assert e_fused <= e_face


# ── Voice feature port ───────────────────────────────────────────────────────

def _synthetic_speech(seconds=2.0, sr=48000):
    t = np.arange(int(seconds * sr)) / sr
    rng = np.random.default_rng(2)
    x = 0.3 * np.sin(2 * np.pi * 140 * t) * (1 + 0.5 * np.sin(2 * np.pi * 3 * t))
    x += 0.1 * np.sin(2 * np.pi * 900 * t) + 0.02 * rng.normal(size=t.size)
    x[: sr // 4] *= 0.05                                     # a quiet stretch, so the noise floor matters
    return x.astype(np.float32)


def test_voice_features_have_expected_shape_and_range():
    x = _synthetic_speech()
    for fn in (V.template_feature, V.probe_feature):
        f = fn(x, 48000)
        assert len(f) == 64 and max(f) == pytest.approx(1.0) and min(f) >= 0


@pytest.mark.skipif(shutil.which("node") is None or not os.path.isdir(FRONTEND_SRC),
                    reason="needs node and the frontend sources")
def test_voice_port_matches_original_javascript(tmp_path):
    x = _synthetic_speech()
    raw = tmp_path / "s.f32"
    x.astype("<f4").tofile(raw)
    script = os.path.join(HERE, "..", "eval", "benchmark", "js_voice_reference.cjs")
    for mode, fn in (("template", V.template_feature), ("probe", V.probe_feature)):
        js = json.loads(subprocess.check_output(["node", script, FRONTEND_SRC, str(raw), "48000", mode], text=True))
        py = fn(x, 48000)
        assert np.abs(np.array(py) - np.array(js)).max() < 1e-5, mode
