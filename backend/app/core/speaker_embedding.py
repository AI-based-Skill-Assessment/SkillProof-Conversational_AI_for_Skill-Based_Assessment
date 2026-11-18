"""
app/core/speaker_embedding.py
Speaker embeddings with SpeechBrain ECAPA-TDNN (trained on VoxCeleb).

Replaces the browser's 64-band average spectrum, which measured the microphone
and room more than the person: in the pilot, a participant's voice scored the
same against their own template as against other people's. ECAPA produces a
192-d embedding per recording; two recordings of the same speaker have high
cosine similarity.

The server computes embeddings from the uploaded audio itself, so a client can
no longer submit an arbitrary "voice vector".

Audio is expected as WAV (the browser converts its recording before upload; no
ffmpeg needed). The model (~80 MB) downloads once on first use.
"""
import io
import threading
from typing import List, Optional

import numpy as np

ECAPA_DIM = 192
TARGET_SR = 16000
MIN_SECONDS = 1.0

_model = None
_lock = threading.Lock()


class SpeakerModelUnavailable(RuntimeError):
    pass


def _get_model():
    global _model
    if _model is None:
        with _lock:
            if _model is None:
                try:
                    from speechbrain.inference.speaker import EncoderClassifier
                    from speechbrain.utils.fetching import LocalStrategy
                except Exception as e:   # not installed
                    raise SpeakerModelUnavailable(f"SpeechBrain is not installed: {e}")
                import os
                save = os.path.join(os.path.dirname(__file__), "..", "..", "pretrained_models", "spkrec-ecapa-voxceleb")
                try:
                    _model = EncoderClassifier.from_hparams(
                        source="speechbrain/spkrec-ecapa-voxceleb", savedir=os.path.abspath(save),
                        run_opts={"device": "cpu"}, local_strategy=LocalStrategy.COPY,
                    )
                except TypeError:   # older SpeechBrain without local_strategy
                    _model = EncoderClassifier.from_hparams(
                        source="speechbrain/spkrec-ecapa-voxceleb", savedir=os.path.abspath(save),
                        run_opts={"device": "cpu"},
                    )
    return _model


def is_available() -> bool:
    try:
        _get_model()
        return True
    except Exception as e:
        print(f"[SpeakerEmbedding] unavailable: {e}")
        return False


def embed_waveform(x: np.ndarray, sr: int) -> List[float]:
    """Mono float waveform -> L2-normalised 192-d ECAPA embedding."""
    import torch
    x = np.asarray(x, dtype=np.float32)
    if x.ndim > 1:
        x = x.mean(axis=1)
    if sr != TARGET_SR:
        from math import gcd
        from scipy.signal import resample_poly
        g = gcd(TARGET_SR, sr)
        x = resample_poly(x, TARGET_SR // g, sr // g).astype(np.float32)
    if len(x) < MIN_SECONDS * TARGET_SR:
        raise ValueError("Recording too short for voice verification (need at least 1 second).")
    with torch.no_grad():
        e = _get_model().encode_batch(torch.from_numpy(x).unsqueeze(0)).squeeze().cpu().numpy()
    e = e / (np.linalg.norm(e) or 1.0)
    return [float(v) for v in e]


def embed_wav_bytes(data: bytes) -> List[float]:
    """WAV/FLAC/OGG bytes (anything libsndfile reads) -> 192-d embedding."""
    import soundfile as sf
    x, sr = sf.read(io.BytesIO(data), dtype="float32", always_2d=True)
    return embed_waveform(x.mean(axis=1), sr)


def is_ecapa(vec: Optional[list]) -> bool:
    return bool(vec) and len(vec) == ECAPA_DIM


def cosine(a, b) -> float:
    a, b = np.asarray(a, dtype=np.float64), np.asarray(b, dtype=np.float64)
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    return float(a @ b / (na * nb)) if na and nb else 0.0
