"""
eval/metrics.py
Statistics for the SkillProof evaluation (no SciPy needed).

Biometric scores follow one convention: HIGHER = MORE LIKELY THE SAME PERSON,
and a trial is ACCEPTED when score >= threshold.
  FAR(t) = share of impostor trials accepted      (false acceptance rate)
  FRR(t) = share of genuine trials rejected       (false rejection rate)
  EER    = the rate where FAR == FRR (interpolated)
"""
from typing import Dict, List, Optional, Sequence, Tuple

import numpy as np


# ─────────────────────────────────────────────────────────────────────────────
# Biometric verification
# ─────────────────────────────────────────────────────────────────────────────

def roc(genuine: Sequence[float], impostor: Sequence[float]) -> Dict[str, np.ndarray]:
    """FAR and FRR at every distinct threshold (plus both extremes)."""
    g = np.sort(np.asarray(genuine, dtype=float))
    i = np.sort(np.asarray(impostor, dtype=float))
    if g.size == 0 or i.size == 0:
        raise ValueError("Need at least one genuine and one impostor trial")
    thresholds = np.unique(np.concatenate([g, i]))[::-1]          # high -> low
    thresholds = np.concatenate([[np.inf], thresholds, [-np.inf]])
    far = (i.size - np.searchsorted(i, thresholds, side="left")) / i.size   # impostor >= t
    frr = np.searchsorted(g, thresholds, side="left") / g.size              # genuine < t
    return {"threshold": thresholds, "far": far, "frr": frr, "tpr": 1.0 - frr}


def eer(genuine: Sequence[float], impostor: Sequence[float]) -> Tuple[float, float]:
    """(EER, threshold at the EER). Linear interpolation between ROC points."""
    r = roc(genuine, impostor)
    far, frr, thr = r["far"], r["frr"], r["threshold"]
    diff = far - frr                      # goes from -1 (t=+inf) up to +1 (t=-inf)
    idx = int(np.argmax(diff >= 0))
    if diff[idx] == 0 or idx == 0:
        t = thr[idx] if np.isfinite(thr[idx]) else (thr[idx + 1] if idx + 1 < len(thr) else 0.0)
        return float(far[idx]), float(t)
    j = idx - 1
    w = -diff[j] / (diff[idx] - diff[j])  # fraction of the way from point j to idx
    rate = far[j] + w * (far[idx] - far[j])
    t_j = thr[j] if np.isfinite(thr[j]) else thr[idx]
    t_i = thr[idx] if np.isfinite(thr[idx]) else thr[j]
    return float(rate), float(t_j + w * (t_i - t_j))


def auc(genuine: Sequence[float], impostor: Sequence[float]) -> float:
    """Area under the ROC curve (TPR vs FAR)."""
    r = roc(genuine, impostor)
    order = np.argsort(r["far"], kind="mergesort")
    trapezoid = getattr(np, "trapezoid", None) or np.trapz   # numpy < 2.0 only has trapz
    return float(trapezoid(r["tpr"][order], r["far"][order]))


def rates_at(genuine: Sequence[float], impostor: Sequence[float], threshold: float) -> Dict[str, float]:
    """FAR, FRR and accuracies when accepting score >= threshold."""
    g = np.asarray(genuine, dtype=float)
    i = np.asarray(impostor, dtype=float)
    far = float(np.mean(i >= threshold))
    frr = float(np.mean(g < threshold))
    correct = np.sum(g >= threshold) + np.sum(i < threshold)
    return {
        "threshold": float(threshold),
        "far": far,
        "frr": frr,
        "accuracy": float(correct / (g.size + i.size)),
        "balanced_accuracy": 1.0 - (far + frr) / 2.0,
        "n_genuine": int(g.size),
        "n_impostor": int(i.size),
    }


def threshold_at_far(genuine: Sequence[float], impostor: Sequence[float], target_far: float) -> Dict[str, float]:
    """Lowest threshold whose FAR is <= target (i.e. the most permissive one meeting it)."""
    r = roc(genuine, impostor)
    ok = np.where(r["far"] <= target_far)[0]
    k = ok[-1]
    t = r["threshold"][k]
    if not np.isfinite(t):
        t = float(np.max(np.concatenate([np.asarray(genuine), np.asarray(impostor)]))) + 1e-9
    return rates_at(genuine, impostor, float(t))


def znorm_params(impostor: Sequence[float]) -> Tuple[float, float]:
    """Mean and SD of the impostor distribution (z-normalisation for score fusion)."""
    a = np.asarray(impostor, dtype=float)
    sd = float(np.std(a))
    return float(np.mean(a)), (sd if sd > 0 else 1.0)


def bootstrap_ci(groups: Dict[str, Tuple[List[float], List[float]]], stat, n_boot: int = 1000,
                 seed: int = 7, alpha: float = 0.05) -> Optional[Tuple[float, float]]:
    """
    Subject-level percentile bootstrap. `groups` maps subject -> (genuine scores,
    impostor scores) for trials where that subject is the probe. Subjects are
    resampled with replacement (trials of one person are not independent).
    """
    keys = list(groups)
    if len(keys) < 3:
        return None
    rng = np.random.default_rng(seed)
    vals = []
    for _ in range(n_boot):
        pick = rng.choice(len(keys), size=len(keys), replace=True)
        g = [s for k in pick for s in groups[keys[k]][0]]
        i = [s for k in pick for s in groups[keys[k]][1]]
        if g and i:
            vals.append(stat(g, i))
    if not vals:
        return None
    lo, hi = np.percentile(vals, [100 * alpha / 2, 100 * (1 - alpha / 2)])
    return float(lo), float(hi)


# ─────────────────────────────────────────────────────────────────────────────
# Agreement between AI scores and human raters
# ─────────────────────────────────────────────────────────────────────────────

def _ranks(x: np.ndarray) -> np.ndarray:
    order = np.argsort(x, kind="mergesort")
    ranks = np.empty(len(x), dtype=float)
    ranks[order] = np.arange(1, len(x) + 1)
    for v in np.unique(x):                      # average ranks for ties
        m = x == v
        if m.sum() > 1:
            ranks[m] = ranks[m].mean()
    return ranks


def pearson(a: Sequence[float], b: Sequence[float]) -> float:
    a, b = np.asarray(a, float), np.asarray(b, float)
    if a.size < 2 or np.std(a) == 0 or np.std(b) == 0:
        return float("nan")
    return float(np.corrcoef(a, b)[0, 1])


def spearman(a: Sequence[float], b: Sequence[float]) -> float:
    return pearson(_ranks(np.asarray(a, float)), _ranks(np.asarray(b, float)))


def mae(a: Sequence[float], b: Sequence[float]) -> float:
    return float(np.mean(np.abs(np.asarray(a, float) - np.asarray(b, float))))


def cohen_kappa(a: Sequence, b: Sequence, labels: Sequence, weights: Optional[str] = None) -> float:
    """Cohen's kappa; weights=None (nominal) or 'quadratic' (ordinal labels in order)."""
    idx = {l: k for k, l in enumerate(labels)}
    n = len(labels)
    obs = np.zeros((n, n))
    for x, y in zip(a, b):
        obs[idx[x], idx[y]] += 1
    total = obs.sum()
    if total == 0:
        return float("nan")
    obs /= total
    exp = np.outer(obs.sum(1), obs.sum(0))
    if weights == "quadratic":
        w = np.array([[(r - c) ** 2 for c in range(n)] for r in range(n)], float) / max(1, (n - 1) ** 2)
    else:
        w = 1.0 - np.eye(n)
    denom = (w * exp).sum()
    return float(1.0 - (w * obs).sum() / denom) if denom > 0 else float("nan")


def icc_2_1(matrix: Sequence[Sequence[float]]) -> float:
    """
    ICC(2,1): two-way random effects, absolute agreement, single rater
    (Shrout & Fleiss). Rows = items (interviews), columns = raters (or AI + humans).
    """
    x = np.asarray(matrix, dtype=float)
    n, k = x.shape
    if n < 2 or k < 2:
        return float("nan")
    grand = x.mean()
    ms_r = k * np.sum((x.mean(1) - grand) ** 2) / (n - 1)
    ms_c = n * np.sum((x.mean(0) - grand) ** 2) / (k - 1)
    sse = np.sum((x - x.mean(1, keepdims=True) - x.mean(0, keepdims=True) + grand) ** 2)
    ms_e = sse / ((n - 1) * (k - 1))
    denom = ms_r + (k - 1) * ms_e + k * (ms_c - ms_e) / n
    return float((ms_r - ms_e) / denom) if denom != 0 else float("nan")


def describe(values: Sequence[float]) -> Dict[str, float]:
    a = np.asarray(values, dtype=float)
    if a.size == 0:
        return {"n": 0}
    return {
        "n": int(a.size), "mean": float(a.mean()), "sd": float(a.std(ddof=1)) if a.size > 1 else 0.0,
        "median": float(np.median(a)), "p95": float(np.percentile(a, 95)),
        "min": float(a.min()), "max": float(a.max()),
    }
