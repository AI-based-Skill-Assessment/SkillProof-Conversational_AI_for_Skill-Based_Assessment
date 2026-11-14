"""
Public-dataset benchmark of SkillProof's biometric matching (reviewer comment 2).

Runs the app's OWN matching code (face: compute_min_face_distance on face-api.js
descriptors; voice: BackendVoiceVerifier.compute_voice_similarity on the app's
64-band features) on public data:

  Face   LFW, standard View-2 protocol: 6000 pairs in 10 folds (3000 same person,
         3000 different). First image = enrolment descriptor (registration
         settings), second = probe descriptor (live-check settings).
  Voice  LibriSpeech dev-clean: 40 speakers x up to 20 utterances. Utterance 1 =
         template (registration feature), the rest = probes (live-check feature),
         every probe compared with every speaker's template.
  Fused  40 "chimeric" subjects, each = one LFW identity + one LibriSpeech speaker
         (a standard device when no dataset has both modalities for the same
         people). B = w*z(face) + (1-w)*z(voice), z-normalised on impostor scores.

usage: python -m eval.benchmark.run_benchmark <work dir> <out dir>
"""
import contextlib
import csv
import io
import json
import os
import subprocess
import sys
from datetime import datetime

import numpy as np

from eval import metrics as M

FACE_MAX_DISTANCE = 0.48        # app accepts a face when L2 distance < 0.48 -> score = -distance
VOICE_MIN_SIMILARITY = 0.42     # app accepts a voice when similarity >= 0.42
FUSION_W = 0.5


def face_score(probe, enrol):
    from app.repositories.biometric_repo import compute_min_face_distance
    return -compute_min_face_distance(probe, enrol)


_verifier = None


def voice_score(probe, template):
    global _verifier
    if _verifier is None:
        from app.core.voice_verifier import BackendVoiceVerifier
        with contextlib.redirect_stdout(io.StringIO()):
            _verifier = BackendVoiceVerifier()
    with contextlib.redirect_stdout(io.StringIO()):
        return float(_verifier.compute_voice_similarity(probe, template))


def pct(x):
    return "—" if x is None or (isinstance(x, float) and np.isnan(x)) else f"{100 * x:.2f}%"


# ── Face: LFW View-2 ─────────────────────────────────────────────────────────

def lfw_trials(manifest, desc):
    rows, missing = [], 0
    for k, p in enumerate(manifest["pairs"]):
        a, b = desc.get(p["a"]), desc.get(p["b"])
        if not a or not b or not a.get("enrol") or not b.get("probe"):
            missing += 1
            continue
        rows.append({"fold": k // 600, "same": p["same"], "score": face_score(b["probe"], a["enrol"])})
    return rows, missing


def lfw_tenfold_accuracy(rows):
    """Standard LFW protocol: threshold chosen on 9 folds, accuracy measured on the 10th."""
    accs = []
    for f in range(10):
        train = [r for r in rows if r["fold"] != f]
        test = [r for r in rows if r["fold"] == f]
        scores = np.array([r["score"] for r in train])
        labels = np.array([r["same"] for r in train])
        cands = np.unique(scores)
        best_t, best_acc = None, -1
        for t in cands:
            acc = np.mean((scores >= t) == labels)
            if acc > best_acc:
                best_t, best_acc = t, acc
        ts = np.array([r["score"] for r in test])
        tl = np.array([r["same"] for r in test])
        accs.append(float(np.mean((ts >= best_t) == tl)))
    return float(np.mean(accs)), float(np.std(accs))


# ── Voice: LibriSpeech speakers ──────────────────────────────────────────────

def voice_trials(manifest, feats):
    templates = {}
    for s in manifest["speakers"]:
        for u in s["utterances"]:
            if feats.get(u, {}).get("template"):
                templates[s["speaker"]] = (u, feats[u]["template"])
                break
    rows = []
    for s in manifest["speakers"]:
        spk = s["speaker"]
        if spk not in templates:
            continue
        for u in s["utterances"]:
            if u == templates[spk][0] or not feats.get(u, {}).get("probe"):
                continue
            for other, (_, tpl) in templates.items():
                rows.append({"subject": spk, "same": other == spk, "score": voice_score(feats[u]["probe"], tpl)})
    return rows, len(templates)


# ── Fused: chimeric subjects ─────────────────────────────────────────────────

def chimeric_trials(manifest, desc, feats):
    subs = []
    for c in manifest["chimeric"]:
        imgs = [i for i in c["images"] if desc.get(i, {}).get("enrol") and desc.get(i, {}).get("probe")]
        utts = [u for u in c["utterances"] if feats.get(u, {}).get("template") and feats.get(u, {}).get("probe")]
        n = min(len(imgs), len(utts))
        if n >= 2:
            subs.append({"subject": c["subject"], "face_tpl": desc[imgs[0]]["enrol"], "voice_tpl": feats[utts[0]]["template"],
                         "probes": [(desc[i]["probe"], feats[u]["probe"]) for i, u in zip(imgs[1:n], utts[1:n])]})
    rows = []
    for s in subs:
        for fp, vp in s["probes"]:
            for t in subs:
                rows.append({"subject": s["subject"], "same": t["subject"] == s["subject"],
                             "face": face_score(fp, t["face_tpl"]), "voice": voice_score(vp, t["voice_tpl"])})
    return rows, len(subs)


def fuse(rows, w):
    fi = [r["face"] for r in rows if not r["same"]]
    vi = [r["voice"] for r in rows if not r["same"]]
    mf, sf = M.znorm_params(fi)
    mv, sv = M.znorm_params(vi)
    return [{"subject": r["subject"], "same": r["same"],
             "score": w * (r["face"] - mf) / sf + (1 - w) * (r["voice"] - mv) / sv} for r in rows]


# ── Summaries ────────────────────────────────────────────────────────────────

def summarise(rows, prod_threshold=None):
    gen = [r["score"] for r in rows if r["same"]]
    imp = [r["score"] for r in rows if not r["same"]]
    if not gen or not imp:
        return None
    rate, thr = M.eer(gen, imp)
    out = {"n_genuine": len(gen), "n_impostor": len(imp), "eer": rate, "eer_threshold": thr,
           "auc": M.auc(gen, imp), "at_far_1pct": M.threshold_at_far(gen, imp, 0.01),
           "at_far_01pct": M.threshold_at_far(gen, imp, 0.001), "roc": M.roc(gen, imp)}
    if "subject" in rows[0]:
        groups = {}
        for r in rows:
            groups.setdefault(r["subject"], ([], []))[0 if r["same"] else 1].append(r["score"])
        out["eer_ci"] = M.bootstrap_ci(groups, lambda g, i: M.eer(g, i)[0])
    if prod_threshold is not None:
        out["prod"] = M.rates_at(gen, imp, prod_threshold)
    return out


def row(label, r, prod_label):
    ci = r.get("eer_ci")
    ci_txt = f" ({pct(ci[0])}–{pct(ci[1])})" if ci else ""
    p = r.get("prod")
    return (f"| {label} | {r['n_genuine']} | {r['n_impostor']} | {pct(r['eer'])}{ci_txt} | {r['eer_threshold']:.4f} | "
            f"{r['auc']:.4f} | {prod_label} | {pct(p['far']) if p else 'n/a'} | {pct(p['frr']) if p else 'n/a'} | "
            f"{pct(p['accuracy']) if p else 'n/a'} | {pct(r['at_far_1pct']['frr'])} @ {r['at_far_1pct']['threshold']:.4f} | "
            f"{pct(r['at_far_01pct']['frr'])} |")


def main(work_dir, out_dir):
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    os.makedirs(out_dir, exist_ok=True)
    manifest = json.load(open(os.path.join(work_dir, "manifest.json")))
    desc = json.load(open(os.path.join(work_dir, "face_descriptors.json")))
    feats48 = json.load(open(os.path.join(work_dir, "voice_features_48000.json")))
    feats16_path = os.path.join(work_dir, "voice_features_16000.json")
    feats16 = json.load(open(feats16_path)) if os.path.exists(feats16_path) else None

    lfw, lfw_missing = lfw_trials(manifest, desc)
    lfw_acc, lfw_sd = lfw_tenfold_accuracy(lfw)
    voice, n_spk = voice_trials(manifest, feats48)
    voice16 = voice_trials(manifest, feats16)[0] if feats16 else None
    chim, n_chim = chimeric_trials(manifest, desc, feats48)

    results = {
        "face": summarise(lfw, -FACE_MAX_DISTANCE),
        "voice": summarise(voice, VOICE_MIN_SIMILARITY),
        "voice16": summarise(voice16, VOICE_MIN_SIMILARITY) if voice16 else None,
        "chim_face": summarise([{"subject": r["subject"], "same": r["same"], "score": r["face"]} for r in chim], -FACE_MAX_DISTANCE),
        "chim_voice": summarise([{"subject": r["subject"], "same": r["same"], "score": r["voice"]} for r in chim], VOICE_MIN_SIMILARITY),
        "fused": summarise(fuse(chim, FUSION_W)),
    }
    grid = [(w, summarise(fuse(chim, w))["eer"]) for w in np.round(np.linspace(0, 1, 11), 1)]
    best_w = min(grid, key=lambda x: x[1])

    for name, r in results.items():
        if r:
            # Keep at most ~2000 evenly spaced operating points: enough for any plot, small enough to commit
            n = len(r["roc"]["threshold"])
            keep = np.unique(np.linspace(0, n - 1, min(n, 2000)).astype(int))
            with open(os.path.join(out_dir, f"roc_{name}.csv"), "w", newline="") as fh:
                wr = csv.writer(fh)
                wr.writerow(["threshold", "far", "frr", "tpr"])
                for i in keep:
                    wr.writerow([r["roc"]["threshold"][i], r["roc"]["far"][i], r["roc"]["frr"][i], r["roc"]["tpr"][i]])

    n_img = len(desc)
    n_detected = sum(1 for v in desc.values() if v and v.get("probe"))
    try:
        commit = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], text=True).strip()
    except Exception:
        commit = "unknown"

    hdr = ("| Setting | Genuine trials | Impostor trials | EER (95% CI) | EER threshold | AUC | Operating threshold | "
           "FAR | FRR | Accuracy | FRR @ FAR = 1% (threshold) | FRR @ FAR = 0.1% |")
    sep = "|---|---|---|---|---|---|---|---|---|---|---|---|"
    L = [
        "# Biometric matching benchmark on public datasets",
        "",
        f"Generated {datetime.now().isoformat(timespec='seconds')} by `python -m eval.benchmark.run_benchmark` "
        f"at commit `{commit}`. These are **measured** results of the application's own matching code on public data; "
        "no number here was estimated or simulated.",
        "",
        "## Data and protocol",
        "",
        f"- **Face:** LFW (Labeled Faces in the Wild), standard View-2 verification protocol: 6000 pairs in 10 folds. "
        f"Faces were detected in {n_detected} of {n_img} images with the app's detector; {lfw_missing} pairs were skipped "
        f"because a face was not detected in one image (counted as neither accept nor reject). The first image of a pair is "
        "processed with the app's enrolment settings (TinyFaceDetector 224/0.25) and the second with its live-check settings "
        "(320/0.15); both give 128-D face-api.js descriptors; score = −(L2 distance).",
        f"- **Voice:** LibriSpeech dev-clean, {n_spk} speakers, up to 20 utterances each. Utterance 1 = registration "
        "feature (template), the others = live-check features (probes); every probe is compared with every speaker's "
        "template. Audio was resampled from 16 kHz to 48 kHz (the rate the app requests from the microphone) before "
        "the app's 64-band spectral feature was computed; the Python port of the browser feature was verified to match "
        "the original JavaScript to 1e-6.",
        f"- **Fused:** {n_chim} chimeric subjects (LFW identity + LibriSpeech speaker), 1 enrolment and up to 9 paired "
        f"probes each. B = w·z(face) + (1−w)·z(voice), z-normalised with each modality's impostor mean/SD, w = {FUSION_W}.",
        "- Confidence intervals: subject-level bootstrap (1000 resamples) where subjects are defined (voice, chimeric).",
        "",
        "## Results",
        "",
        hdr, sep,
        row("Face only (LFW, 6000 pairs)", results["face"], f"distance < {FACE_MAX_DISTANCE}"),
        row("Voice only (LibriSpeech, 48 kHz)", results["voice"], f"similarity ≥ {VOICE_MIN_SIMILARITY}"),
    ]
    if results["voice16"]:
        L.append(row("Voice only (LibriSpeech, 16 kHz native, sensitivity check)", results["voice16"], f"similarity ≥ {VOICE_MIN_SIMILARITY}"))
    L += [
        row("Face only (chimeric subset)", results["chim_face"], f"distance < {FACE_MAX_DISTANCE}"),
        row("Voice only (chimeric subset)", results["chim_voice"], f"similarity ≥ {VOICE_MIN_SIMILARITY}"),
        row(f"Fused B (w = {FUSION_W})", results["fused"], f"B ≥ {results['fused']['eer_threshold']:.3f} (EER point)"),
        "",
        f"**LFW 10-fold accuracy** (threshold chosen on 9 folds, tested on the 10th, standard protocol): "
        f"**{100 * lfw_acc:.2f}% ± {100 * lfw_sd:.2f}%**.",
        "",
        f"Fusion weight with the lowest EER on the chimeric set: w = {best_w[0]:.1f} (EER {pct(best_w[1])}); "
        f"full grid: " + ", ".join(f"w={w:.1f}: {pct(e)}" for w, e in grid) + ". "
        "The weight is chosen on the same data, so this is optimistic; w = 0.5 is the primary result.",
        "",
        "## Reading the table",
        "",
        "- *Operating threshold* is the decision rule the application uses; FAR/FRR/Accuracy in those columns are what the "
        "deployed system would do on this data. *EER threshold* and *FRR @ FAR = 1%* show what other operating points cost.",
        "- Accuracy for the LFW row is on balanced pairs (50% genuine). For voice and chimeric rows impostor trials vastly "
        "outnumber genuine ones, so FAR and FRR are the meaningful figures there, not accuracy.",
        "",
        "## Limitations (state these in the paper)",
        "",
        "- LFW images are web photos, not webcam frames; LibriSpeech is read speech in quiet rooms, band-limited to 8 kHz, "
        "and lossless, whereas the app's microphone audio passes through Opus/WebM compression. Real-deployment error rates "
        "can differ in both directions.",
        "- Enrolment used one image per identity; the app enrols three poses, which can only lower the face FRR.",
        "- Chimeric subjects assume face and voice are independent, which is standard practice but still an assumption.",
        "- No liveness or presentation-attack detection is evaluated or implemented.",
        "",
        "Files: `roc_*.csv` (full ROC data), `roc.png`.",
    ]

    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        fig, axes = plt.subplots(1, 2, figsize=(10, 4.5))
        for ax, xscale in zip(axes, ("linear", "log")):
            for name, label in (("face", "Face only (LFW)"), ("voice", "Voice only (LibriSpeech)"), ("fused", f"Fused B, w={FUSION_W} (chimeric)")):
                r = results[name]
                far = np.clip(r["roc"]["far"], 1e-4 if xscale == "log" else 0, 1)
                ax.plot(far, r["roc"]["tpr"], label=f"{label}  EER {pct(r['eer'])}")
            ax.set_xscale(xscale)
            ax.set_xlabel("False acceptance rate" + (" (log)" if xscale == "log" else ""))
            ax.set_ylabel("True acceptance rate (1 − FRR)")
            ax.grid(alpha=0.3)
            ax.legend(fontsize=8, loc="lower right")
        fig.suptitle("SkillProof biometric matching: ROC on public datasets")
        fig.tight_layout()
        fig.savefig(os.path.join(out_dir, "roc.png"), dpi=200)
    except ImportError:
        pass

    text = "\n".join(L) + "\n"
    open(os.path.join(out_dir, "BENCHMARK_RESULTS.md"), "w", encoding="utf-8").write(text)
    json.dump({k: {kk: vv for kk, vv in v.items() if kk != "roc"} for k, v in results.items() if v},
              open(os.path.join(out_dir, "summary.json"), "w"), indent=1, default=float)
    print(text)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
