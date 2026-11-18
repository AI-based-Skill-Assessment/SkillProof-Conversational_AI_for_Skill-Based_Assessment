"""
Benchmark SpeechBrain ECAPA-TDNN speaker embeddings on the same LibriSpeech
protocol as the browser spectral feature (40 speakers, utterance 1 = template,
the rest = probes, every probe vs every template; cosine similarity).

usage: python -m eval.benchmark.ecapa_voice <data dir> <work dir> <out dir>
Writes <work dir>/voice_ecapa.json (embeddings) and <out dir>/ECAPA_VOICE_RESULTS.md + roc_voice_ecapa.csv
"""
import csv
import json
import os
import sys
from datetime import datetime

import numpy as np

from eval import metrics as M


def main(data_dir, work_dir, out_dir):
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    from app.core.speaker_embedding import embed_waveform
    import soundfile as sf

    manifest = json.load(open(os.path.join(work_dir, "manifest.json")))
    cache_path = os.path.join(work_dir, "voice_ecapa.json")
    emb = json.load(open(cache_path)) if os.path.exists(cache_path) else {}
    utts = sorted({u for s in manifest["speakers"] for u in s["utterances"]})
    for i, u in enumerate(utts, 1):
        if u in emb:
            continue
        x, sr = sf.read(os.path.join(data_dir, u), dtype="float32", always_2d=True)
        emb[u] = embed_waveform(x.mean(axis=1), sr)
        if i % 50 == 0:
            json.dump(emb, open(cache_path, "w"))
            print(f"{i}/{len(utts)}", file=sys.stderr)
    json.dump(emb, open(cache_path, "w"))

    def cos(a, b):
        a, b = np.asarray(a), np.asarray(b)
        return float(a @ b / (np.linalg.norm(a) * np.linalg.norm(b)))

    templates = {s["speaker"]: emb[s["utterances"][0]] for s in manifest["speakers"]}
    rows = []
    for s in manifest["speakers"]:
        for u in s["utterances"][1:]:
            for spk, tpl in templates.items():
                rows.append((s["speaker"], spk == s["speaker"], cos(emb[u], tpl)))
    gen = [r[2] for r in rows if r[1]]
    imp = [r[2] for r in rows if not r[1]]
    rate, thr = M.eer(gen, imp)
    groups = {}
    for subj, same, sc in rows:
        groups.setdefault(subj, ([], []))[0 if same else 1].append(sc)
    ci = M.bootstrap_ci(groups, lambda g, i: M.eer(g, i)[0])
    at1 = M.threshold_at_far(gen, imp, 0.01)
    at01 = M.threshold_at_far(gen, imp, 0.001)

    os.makedirs(out_dir, exist_ok=True)
    r = M.roc(gen, imp)
    keep = np.unique(np.linspace(0, len(r["threshold"]) - 1, min(len(r["threshold"]), 2000)).astype(int))
    with open(os.path.join(out_dir, "roc_voice_ecapa.csv"), "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["threshold", "far", "frr", "tpr"])
        for k in keep:
            w.writerow([r["threshold"][k], r["far"][k], r["frr"][k], r["tpr"][k]])

    pct = lambda x: f"{100 * x:.2f}%"
    text = "\n".join([
        "# Voice verification with ECAPA-TDNN (LibriSpeech dev-clean)",
        "",
        f"Generated {datetime.now().isoformat(timespec='seconds')} by `python -m eval.benchmark.ecapa_voice`.",
        "Model: SpeechBrain `spkrec-ecapa-voxceleb` (192-d embeddings, trained on VoxCeleb), cosine similarity. "
        "Same protocol as the spectral feature in BENCHMARK_RESULTS.md: 40 speakers, utterance 1 = template, "
        f"others = probes; {len(gen)} genuine / {len(imp)} impostor trials.",
        "",
        "| Feature | EER (95% CI) | EER threshold | AUC | FRR @ FAR = 1% (threshold) | FRR @ FAR = 0.1% (threshold) |",
        "|---|---|---|---|---|---|",
        f"| ECAPA-TDNN | {pct(rate)} ({pct(ci[0])}–{pct(ci[1])}) | {thr:.4f} | {M.auc(gen, imp):.4f} | "
        f"{pct(at1['frr'])} @ {at1['threshold']:.4f} | {pct(at01['frr'])} @ {at01['threshold']:.4f} |",
        "| Browser spectral feature (previous) | 21.88% (18.68%–26.32%) | 0.8647 | 0.8601 | 84.47% | 96.84% |",
        "",
    ]) + "\n"
    open(os.path.join(out_dir, "ECAPA_VOICE_RESULTS.md"), "w", encoding="utf-8").write(text)
    print(text)


if __name__ == "__main__":
    main(*sys.argv[1:4])
