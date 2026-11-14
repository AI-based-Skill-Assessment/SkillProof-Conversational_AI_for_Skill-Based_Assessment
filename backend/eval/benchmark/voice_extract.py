"""
Compute the app's voice features for every LibriSpeech utterance in the manifest.

usage: python -m eval.benchmark.voice_extract <data dir> <work dir> [--rate 48000|16000]
Writes <work dir>/voice_features_<rate>.json:
  { "<utterance path>": {"template": [64], "probe": [64], "seconds": float} }

Rate 48000 reproduces the app (it requests a 48 kHz microphone stream; the 64
bands then span 0-24 kHz). LibriSpeech is band-limited to 8 kHz, so at 48 kHz
the upper bands carry almost no energy. --rate 16000 is a sensitivity check
with the feature computed at the recording's native rate.
"""
import argparse
import json
import os
import sys

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

from eval.benchmark import voice_features as V


def load(path, rate):
    x, sr = sf.read(path, dtype="float32", always_2d=True)
    x = x.mean(axis=1)
    if sr != rate:
        from math import gcd
        g = gcd(rate, sr)
        x = resample_poly(x, rate // g, sr // g).astype(np.float32)
    return x


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("data_dir")
    ap.add_argument("work_dir")
    ap.add_argument("--rate", type=int, default=48000)
    a = ap.parse_args(argv)
    manifest = json.load(open(os.path.join(a.work_dir, "manifest.json")))
    utts = sorted({u for s in manifest["speakers"] for u in s["utterances"]})
    out_path = os.path.join(a.work_dir, f"voice_features_{a.rate}.json")
    out = json.load(open(out_path)) if os.path.exists(out_path) else {}
    for i, u in enumerate(utts, 1):
        if u in out:
            continue
        x = load(os.path.join(a.data_dir, u), a.rate)
        out[u] = {"template": V.template_feature(x, a.rate), "probe": V.probe_feature(x, a.rate),
                  "seconds": round(len(x) / a.rate, 2)}
        if i % 100 == 0 or i == len(utts):
            json.dump(out, open(out_path, "w"))
            print(f"{i}/{len(utts)}", file=sys.stderr)
    json.dump(out, open(out_path, "w"))
    print(f"{len(out)} utterances -> {out_path}")


if __name__ == "__main__":
    main()
