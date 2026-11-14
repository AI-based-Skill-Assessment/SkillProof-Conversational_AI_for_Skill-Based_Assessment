"""
eval/biometric_eval.py
Measured biometric verification performance (reviewer comment 2, and the
"identity verification accuracy" of comment 1).

For face-only, voice-only and fused (Eq. 2) verification it reports, from REAL
trials: FAR and FRR at the production thresholds, EER (+ 95% subject-level
bootstrap CI) and its threshold, threshold at FAR = 1%, AUC, accuracy, and the
full ROC curves (CSV, plus PNG when matplotlib is installed).

Trials (every probe is compared with every enrolled template):
  genuine            probe of person X  vs  X's template
  zero-effort        probe of person X  vs  another person's template
  deliberate attack  someone else sat in for X  vs  X's template  (reported separately too)

Run from the backend folder:
  python -m eval.biometric_eval                       # data from the database
  python -m eval.biometric_eval --json my_data.json   # or from a file
  python -m eval.biometric_eval --impostor-sessions impostors.csv   # mark deliberate attacks
"""
import argparse
import csv
import os
import sys
from collections import defaultdict
from datetime import datetime

import numpy as np

from eval import metrics as M
from eval.data import Dataset, load_db, load_json

# Production decision rules (keep in sync with app/repositories/biometric_repo.py)
FACE_MAX_DISTANCE = 0.48     # face accepted when L2 distance < 0.48  -> score = -distance
VOICE_MIN_SIMILARITY = 0.42  # voice accepted when similarity >= 0.42
FUSION_PAIR_WINDOW_S = 60    # a voice probe is fused with the nearest face probe within 60 s


def face_score(probe, template) -> float:
    from app.repositories.biometric_repo import compute_min_face_distance
    return -compute_min_face_distance(probe, template)


_voice = None


def voice_score(probe, template) -> float:
    global _voice
    if _voice is None:
        from app.core.voice_verifier import BackendVoiceVerifier
        _voice = BackendVoiceVerifier()
    import contextlib
    import io
    with contextlib.redirect_stdout(io.StringIO()):   # production code prints a debug line per comparison
        return float(_voice.compute_voice_similarity(probe, template))


SCORERS = {"face": face_score, "voice": voice_score}
PROD_THRESHOLD = {"face": -FACE_MAX_DISTANCE, "voice": VOICE_MIN_SIMILARITY}


def build_trials(ds: Dataset, modality: str):
    """[(score, is_genuine, probe_subject, kind)] where kind is genuine|zero_effort|attack."""
    trials = []
    score = SCORERS[modality]
    for p in ds.probes:
        if p.modality != modality:
            continue
        for subj, tpl in ds.templates.items():
            if modality not in tpl:
                continue
            if p.claimed != p.subject:                       # deliberate attack
                if subj == p.claimed:
                    trials.append((score(p.embedding, tpl[modality]), False, p.subject, "attack"))
                continue
            genuine = subj == p.subject
            trials.append((score(p.embedding, tpl[modality]), genuine, p.subject,
                           "genuine" if genuine else "zero_effort"))
    return trials


def fused_trials(ds: Dataset, face_imp, voice_imp, w: float):
    """Score-level fusion: B = w*z(face) + (1-w)*z(voice), z-normalised on impostor scores."""
    mf, sf = M.znorm_params(face_imp)
    mv, sv = M.znorm_params(voice_imp)
    faces = defaultdict(list)
    for p in ds.probes:
        if p.modality == "face" and p.session:
            faces[p.session].append(p)
    trials = []
    for v in ds.probes:
        if v.modality != "voice" or not v.session or not faces.get(v.session):
            continue
        cands = [f for f in faces[v.session] if f.time and v.time]
        if not cands:
            continue
        f = min(cands, key=lambda c: abs((c.time - v.time).total_seconds()))
        if abs((f.time - v.time).total_seconds()) > FUSION_PAIR_WINDOW_S:
            continue
        for subj, tpl in ds.templates.items():
            if "face" not in tpl or "voice" not in tpl:
                continue
            if v.claimed != v.subject:
                if subj != v.claimed:
                    continue
                kind, genuine = "attack", False
            else:
                genuine = subj == v.subject
                kind = "genuine" if genuine else "zero_effort"
            zf = (face_score(f.embedding, tpl["face"]) - mf) / sf
            zv = (voice_score(v.embedding, tpl["voice"]) - mv) / sv
            trials.append((w * zf + (1 - w) * zv, genuine, v.subject, kind))
    return trials


def summarise(trials, prod_threshold=None):
    gen = [s for s, g, _, _ in trials if g]
    imp = [s for s, g, _, _ in trials if not g]
    attacks = [s for s, g, _, k in trials if k == "attack"]
    if not gen or not imp:
        return None
    rate, thr = M.eer(gen, imp)
    groups = defaultdict(lambda: ([], []))
    for s, g, subj, _ in trials:
        groups[subj][0 if g else 1].append(s)
    ci = M.bootstrap_ci(dict(groups), lambda g, i: M.eer(g, i)[0])
    out = {
        "n_subjects": len({subj for _, _, subj, _ in trials}),
        "n_genuine": len(gen), "n_impostor": len(imp), "n_attack": len(attacks),
        "eer": rate, "eer_ci": ci, "eer_threshold": thr, "auc": M.auc(gen, imp),
        "at_far_1pct": M.threshold_at_far(gen, imp, 0.01),
        "roc": M.roc(gen, imp),
    }
    if prod_threshold is not None:
        out["at_production"] = M.rates_at(gen, imp, prod_threshold)
        if attacks:
            out["attack_acceptance"] = float(np.mean(np.asarray(attacks) >= prod_threshold))
    return out


def group_rates(trials, groups, threshold):
    """FAR/FRR at the production threshold per demographic group of the probe subject (comment 5)."""
    rows = []
    for g in sorted(set(groups.values())):
        gen = [s for s, ok, subj, _ in trials if ok and groups.get(subj) == g]
        imp = [s for s, ok, subj, _ in trials if not ok and groups.get(subj) == g]
        n_subj = len({subj for _, _, subj, _ in trials if groups.get(subj) == g})
        if gen and imp:
            r = M.rates_at(gen, imp, threshold)
            rows.append((g, n_subj, len(gen), len(imp), r["far"], r["frr"]))
    return rows


def pct(x):
    return "—" if x is None else f"{100 * x:.2f}%"


def write_report(results: dict, ds: Dataset, out_dir: str, fusion_w: float, best_w, by_group=None):
    os.makedirs(out_dir, exist_ok=True)
    for name, r in results.items():
        if not r:
            continue
        with open(os.path.join(out_dir, f"roc_{name}.csv"), "w", newline="") as fh:
            wr = csv.writer(fh)
            wr.writerow(["threshold", "far", "frr", "tpr"])
            for t, a, b, c in zip(r["roc"]["threshold"], r["roc"]["far"], r["roc"]["frr"], r["roc"]["tpr"]):
                wr.writerow([t, a, b, c])

    L = [
        "# Biometric verification results",
        "",
        f"Generated {datetime.now().isoformat(timespec='seconds')} by `python -m eval.biometric_eval`.",
        f"Data: {ds.summary()}.",
        "",
        "Scores: face = −(L2 distance between face-api.js descriptors), voice = similarity of voice embeddings; "
        "higher = more likely the same person. Fused B = w·z(face) + (1−w)·z(voice), each z-normalised with the "
        f"mean/SD of its impostor scores, w = {fusion_w}.",
        "",
        "| Modality | Subjects | Genuine trials | Impostor trials | EER (95% CI) | EER threshold | AUC | FAR @ prod. threshold | FRR @ prod. threshold | Accuracy @ prod. threshold | FRR @ FAR=1% |",
        "|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    labels = {"face": "Face only", "voice": "Voice only", "fused": f"Fused B (w={fusion_w})"}
    for name, r in results.items():
        if not r:
            L.append(f"| {labels[name]} | not enough data | | | | | | | | | |")
            continue
        ci = r["eer_ci"]
        ci_txt = f" ({pct(ci[0])}–{pct(ci[1])})" if ci else ""
        prod = r.get("at_production")
        L.append(
            f"| {labels[name]} | {r['n_subjects']} | {r['n_genuine']} | {r['n_impostor']} | {pct(r['eer'])}{ci_txt} | "
            f"{r['eer_threshold']:.4f} | {r['auc']:.4f} | {pct(prod['far']) if prod else 'n/a'} | "
            f"{pct(prod['frr']) if prod else 'n/a'} | {pct(prod['accuracy']) if prod else 'n/a'} | "
            f"{pct(r['at_far_1pct']['frr'])} |"
        )
    L += ["", "Production thresholds: face distance < "
          f"{FACE_MAX_DISTANCE} (score ≥ −{FACE_MAX_DISTANCE}); voice similarity ≥ {VOICE_MIN_SIMILARITY}. "
          "The fused score is evaluated offline; its threshold is reported as the EER threshold and the FAR=1% threshold above."]
    attack_rows = [(labels[n], r) for n, r in results.items() if r and r.get("n_attack")]
    if attack_rows:
        L += ["", "## Deliberate impostor attempts (someone else took the interview)", "",
              "| Modality | Attack trials | Accepted at production threshold |", "|---|---|---|"]
        for lab, r in attack_rows:
            L.append(f"| {lab} | {r['n_attack']} | {pct(r.get('attack_acceptance'))} |")
    if best_w is not None:
        L += ["", f"Fusion weight with the lowest EER on this data: w = {best_w[0]:.1f} (EER {pct(best_w[1])}). "
              "This is optimised on the same data and therefore optimistic; report w = "
              f"{fusion_w} as the primary result unless the weight is chosen on a separate set."]
    if by_group:
        L += ["", "## By demographic group (production thresholds)", "",
              "Groups are self-reported and optional. Small groups give unreliable rates: report n with every value.", "",
              "| Modality | Group | Subjects | Genuine | Impostor | FAR | FRR |", "|---|---|---|---|---|---|---|"]
        for mod, rows in by_group.items():
            for g, ns, ng, ni, far, frr in rows:
                L.append(f"| {labels[mod]} | {g} | {ns} | {ng} | {ni} | {pct(far)} | {pct(frr)} |")
    L += ["", "ROC curve data: `roc_face.csv`, `roc_voice.csv`, `roc_fused.csv`."]

    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        fig, ax = plt.subplots(figsize=(5, 5))
        for name, r in results.items():
            if r:
                ax.plot(r["roc"]["far"], r["roc"]["tpr"], label=f"{labels[name]} (EER {pct(r['eer'])})")
        ax.plot([0, 1], [0, 1], "k:", lw=0.8)
        ax.set_xlabel("False acceptance rate (FAR)")
        ax.set_ylabel("True acceptance rate (1 − FRR)")
        ax.set_title("SkillProof biometric verification ROC")
        ax.legend(loc="lower right", fontsize=8)
        fig.tight_layout()
        fig.savefig(os.path.join(out_dir, "roc.png"), dpi=200)
        L.append("ROC figure: `roc.png`.")
    except ImportError:
        L.append("(Install matplotlib to also get `roc.png`: `pip install matplotlib`.)")

    open(os.path.join(out_dir, "biometric_results.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")
    return "\n".join(L)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--json", help="Load data from a JSON file instead of the database")
    ap.add_argument("--impostor-sessions", help="CSV with columns session_id,true_subject for deliberate impostor sessions")
    ap.add_argument("--fusion-weight", type=float, default=0.5, help="Face weight w in B (default 0.5)")
    ap.add_argument("--groups", help="Optional CSV subject,group (self-reported, e.g. gender or skin-tone band) for per-group FAR/FRR")
    ap.add_argument("--out", default=os.path.join("eval_results", datetime.now().strftime("%Y%m%d_%H%M%S")))
    args = ap.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")   # Windows console

    if args.json:
        ds = load_json(args.json)
    else:
        imp = {}
        if args.impostor_sessions:
            for row in csv.DictReader(open(args.impostor_sessions, encoding="utf-8")):
                imp[row["session_id"].strip()] = row["true_subject"].strip()
        ds = load_db(imp)
    print(ds.summary())

    face = build_trials(ds, "face")
    voice = build_trials(ds, "voice")
    results = {
        "face": summarise(face, PROD_THRESHOLD["face"]),
        "voice": summarise(voice, PROD_THRESHOLD["voice"]),
        "fused": None,
    }
    best_w = None
    if face and voice:
        f_imp = [s for s, g, _, _ in face if not g]
        v_imp = [s for s, g, _, _ in voice if not g]
        results["fused"] = summarise(fused_trials(ds, f_imp, v_imp, args.fusion_weight))
        grid = []
        for w in np.round(np.linspace(0, 1, 11), 1):
            r = summarise(fused_trials(ds, f_imp, v_imp, float(w)))
            if r:
                grid.append((float(w), r["eer"]))
        if grid:
            best_w = min(grid, key=lambda x: x[1])

    by_group = None
    if args.groups:
        groups = {r["subject"].strip(): r["group"].strip()
                  for r in csv.DictReader(open(args.groups, encoding="utf-8-sig"))}
        by_group = {m: group_rates(t, groups, PROD_THRESHOLD[m]) for m, t in (("face", face), ("voice", voice)) if t}

    report = write_report(results, ds, args.out, args.fusion_weight, best_w, by_group)
    print(report)
    print(f"\nSaved to {args.out}")


if __name__ == "__main__":
    main()
