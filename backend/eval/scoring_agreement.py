"""
eval/scoring_agreement.py
How closely do the LLM's scores match human interviewers? (reviewer comments 1 and 3)

Inputs: ai_scores.csv (from export_for_raters) and one filled-in copy of
raters_blind.csv per human rater.

Reports, per scoring dimension (specificity, depth, consistency, overall):
  AI vs mean human: Pearson r, Spearman rho, MAE, ICC(2,1)
  human vs human:   ICC(2,1)  (the agreement ceiling to compare the AI against)
and for the verdict (verified / suspicious / likely_fraudulent):
  agreement with the human consensus ("skill assessment accuracy"),
  quadratic-weighted Cohen's kappa, pass/fail accuracy, confusion matrix,
  and human-human kappa.

Run from the backend folder:
  python -m eval.scoring_agreement --ai ai_scores.csv --raters rater1.csv rater2.csv
"""
import argparse
import csv
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime

import numpy as np

from eval import metrics as M

DIMS = ["specificity", "depth", "consistency", "overall"]
VERDICTS = ["likely_fraudulent", "suspicious", "verified"]   # ordinal: worst -> best


def _num(v):
    try:
        return float(str(v).strip())
    except (TypeError, ValueError):
        return None


def _verdict(v):
    v = str(v or "").strip().lower().replace(" ", "_")
    if v.startswith("likely") or "fraud" in v:
        return "likely_fraudulent"
    if v.startswith("susp"):
        return "suspicious"
    if v.startswith("verif"):
        return "verified"
    return None


def consensus(verdicts):
    """Majority verdict; ties resolved to the middle category (suspicious)."""
    c = Counter(v for v in verdicts if v)
    if not c:
        return None
    top = c.most_common()
    if len(top) > 1 and top[0][1] == top[1][1]:
        return "suspicious"
    return top[0][0]


def analyse(ai_rows, rater_files):
    ai = {(r["item_id"], r["skill"]): r for r in ai_rows}
    human = defaultdict(dict)                      # key -> rater -> row
    for path, rows in rater_files:
        for r in rows:
            key = (r["item_id"], r["skill"])
            rater = (r.get("rater_id") or os.path.basename(path)).strip()
            if key in ai:
                human[key][rater] = r
    raters = sorted({rt for d in human.values() for rt in d})
    keys = [k for k in ai if human.get(k)]
    res = {"n_items": len(keys), "raters": raters, "dims": {}, "verdict": {}}

    for d in DIMS:
        a_vals, h_means, matrix_h, matrix_all = [], [], [], []
        for k in keys:
            av = _num(ai[k].get(f"ai_{d}"))
            hv = [_num(human[k][rt].get(f"human_{d}")) for rt in raters if rt in human[k]]
            hv = [x for x in hv if x is not None]
            if av is None or not hv:
                continue
            a_vals.append(av)
            h_means.append(float(np.mean(hv)))
            full = [_num(human[k].get(rt, {}).get(f"human_{d}")) for rt in raters]
            if all(x is not None for x in full):
                matrix_h.append(full)
                matrix_all.append([av] + full)
        res["dims"][d] = {
            "n": len(a_vals),
            "pearson": M.pearson(a_vals, h_means), "spearman": M.spearman(a_vals, h_means),
            "mae": M.mae(a_vals, h_means) if a_vals else float("nan"),
            "icc_ai_vs_humans": M.icc_2_1(matrix_all) if len(matrix_all) >= 2 else float("nan"),
            "icc_humans": M.icc_2_1(matrix_h) if len(matrix_h) >= 2 and len(raters) >= 2 else float("nan"),
            "ai_mean": float(np.mean(a_vals)) if a_vals else float("nan"),
            "human_mean": float(np.mean(h_means)) if h_means else float("nan"),
        }

    ai_v, cons_v, per_rater = [], [], defaultdict(dict)
    for k in keys:
        av = _verdict(ai[k].get("ai_verdict"))
        hv = {rt: _verdict(human[k][rt].get("human_verdict")) for rt in human[k]}
        cv = consensus(hv.values())
        if av and cv:
            ai_v.append(av)
            cons_v.append(cv)
        for rt, v in hv.items():
            if v:
                per_rater[rt][k] = v
    if ai_v:
        agree = float(np.mean([a == c for a, c in zip(ai_v, cons_v)]))
        pf = float(np.mean([(a == "verified") == (c == "verified") for a, c in zip(ai_v, cons_v)]))
        conf = {(t, p): 0 for t in VERDICTS for p in VERDICTS}
        for a, c in zip(ai_v, cons_v):
            conf[(c, a)] += 1
        res["verdict"] = {"n": len(ai_v), "agreement": agree, "pass_fail_accuracy": pf,
                          "kappa_w": M.cohen_kappa(ai_v, cons_v, VERDICTS, "quadratic"), "confusion": conf}
    if len(raters) >= 2:
        pairs = []
        for i in range(len(raters)):
            for j in range(i + 1, len(raters)):
                common = sorted(set(per_rater[raters[i]]) & set(per_rater[raters[j]]))
                if common:
                    a = [per_rater[raters[i]][k] for k in common]
                    b = [per_rater[raters[j]][k] for k in common]
                    pairs.append((raters[i], raters[j], len(common), M.cohen_kappa(a, b, VERDICTS, "quadratic"),
                                  float(np.mean([x == y for x, y in zip(a, b)]))))
        res["verdict"]["human_pairs"] = pairs
    return res


def report(res, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    f = lambda x: "—" if x is None or (isinstance(x, float) and np.isnan(x)) else f"{x:.3f}"
    L = ["# AI vs human interviewer agreement", "",
         f"Generated {datetime.now().isoformat(timespec='seconds')} by `python -m eval.scoring_agreement`.",
         f"Rated items (interview × skill): {res['n_items']}; human raters: {len(res['raters'])} ({', '.join(res['raters'])}).",
         "", "## Scores (0–100)", "",
         "| Dimension | n | AI mean | Human mean | Pearson r | Spearman ρ | MAE | ICC(2,1) AI+humans | ICC(2,1) humans only |",
         "|---|---|---|---|---|---|---|---|---|"]
    for d, r in res["dims"].items():
        L.append(f"| {d} | {r['n']} | {f(r['ai_mean'])} | {f(r['human_mean'])} | {f(r['pearson'])} | "
                 f"{f(r['spearman'])} | {f(r['mae'])} | {f(r['icc_ai_vs_humans'])} | {f(r['icc_humans'])} |")
    v = res.get("verdict") or {}
    if v.get("n"):
        L += ["", "## Verdict", "",
              f"- Items with both an AI and a human consensus verdict: {v['n']}",
              f"- **Agreement with human consensus (skill assessment accuracy): {100 * v['agreement']:.1f}%**",
              f"- Pass/fail accuracy (verified vs not verified): {100 * v['pass_fail_accuracy']:.1f}%",
              f"- Quadratic-weighted Cohen's κ (AI vs consensus): {f(v['kappa_w'])}",
              "", "Confusion matrix (rows = human consensus, columns = AI):", "",
              "| Human \\ AI | " + " | ".join(VERDICTS) + " |", "|---|" + "---|" * len(VERDICTS)]
        for t in VERDICTS:
            L.append(f"| {t} | " + " | ".join(str(v["confusion"][(t, p)]) for p in VERDICTS) + " |")
        for a, b, n, k, agr in v.get("human_pairs", []):
            L.append(f"\nHuman–human ({a} vs {b}, n={n}): agreement {100 * agr:.1f}%, weighted κ {f(k)}")
    text = "\n".join(L) + "\n"
    open(os.path.join(out_dir, "scoring_agreement.md"), "w", encoding="utf-8").write(text)
    return text


def _read(path):
    with open(path, encoding="utf-8-sig") as fh:
        return list(csv.DictReader(fh))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ai", required=True, help="ai_scores.csv from export_for_raters")
    ap.add_argument("--raters", nargs="+", required=True, help="filled raters_blind.csv copies, one per rater")
    ap.add_argument("--out", default=os.path.join("eval_results", datetime.now().strftime("%Y%m%d_%H%M%S")))
    args = ap.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    res = analyse(_read(args.ai), [(p, _read(p)) for p in args.raters])
    print(report(res, args.out))
    print(f"Saved to {args.out}")


if __name__ == "__main__":
    main()
