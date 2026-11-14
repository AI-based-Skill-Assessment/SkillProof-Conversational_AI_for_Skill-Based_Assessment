"""
Python port of the app's two browser voice features (frontend/src/pages/user/):

  template_feature(x, sr)  VoiceRegistration.jsx  extractVoiceEmbedding
      150 Hz one-pole high-pass; 512-sample frames with hop = max(256, (N-512)//64);
      no window; |FFT|/N; 64 bands of 4 bins averaged; mean over frames; max-normalised.

  probe_feature(x, sr)     InterviewSession.jsx  extractVoiceEmbedding
      90 Hz one-pole high-pass; 512-sample frames, hop 256; frame RMS; noise floor =
      20th-percentile RMS; keep frames with RMS >= max(0.003, 1.6 x floor);
      Hann window (N-1 form); |FFT|/N; 64 bands; mean over kept frames; max-normalised.
      Falls back to all frames (no window) when none pass.

Both return 64 values rounded to 6 decimals, exactly like the JS. The port is
validated against the original JavaScript by js_voice_reference.cjs (see
test_benchmark_voice_port in tests). The only known difference is float32
rounding inside the JS arrays, which changes values at the 1e-5 level.
"""
import numpy as np

FRAME = 512
BANDS = 64
BIN_PER_BAND = (FRAME // 2) // BANDS   # 4


def _one_pole_highpass(x: np.ndarray, sr: float, cutoff_hz: float) -> np.ndarray:
    """JS: y[0] = x[0];  y[i] = alpha * (y[i-1] + x[i] - x[i-1])."""
    from scipy.signal import lfilter
    rc = 1.0 / (2 * np.pi * cutoff_hz)
    alpha = rc / (rc + 1.0 / sr)
    # Same recurrence with zero initial state gives y[0] = alpha*x[0]; the JS starts
    # at y[0] = x[0]. The recurrence is linear, so that offset decays as alpha**i.
    y = lfilter([alpha, -alpha], [1.0, -alpha], x)
    y += (1.0 - alpha) * x[0] * alpha ** np.arange(len(x))
    return y


def _band_energies(frame: np.ndarray) -> np.ndarray:
    mag = np.abs(np.fft.rfft(frame, n=FRAME))[: FRAME // 2] / FRAME
    return mag[: BANDS * BIN_PER_BAND].reshape(BANDS, BIN_PER_BAND).mean(axis=1)


def _finish(acc: np.ndarray, frames: int) -> list:
    if frames == 0:
        return []
    avg = acc / frames
    m = avg.max()
    return [float(f"{v / m:.6f}") if m > 0 else 0.0 for v in avg]


def template_feature(x: np.ndarray, sr: float) -> list:
    x = np.asarray(x, dtype=np.float64)
    f = _one_pole_highpass(x, sr, 150.0)
    n = len(f)
    hop = max(256, (n - FRAME) // 64)
    acc = np.zeros(BANDS)
    frames = 0
    for start in range(0, n, hop):
        if start + FRAME >= n:
            break
        acc += _band_energies(f[start:start + FRAME])
        frames += 1
    return _finish(acc, frames)


def probe_feature(x: np.ndarray, sr: float) -> list:
    x = np.asarray(x, dtype=np.float64)
    f = _one_pole_highpass(x, sr, 90.0)
    n = len(f)
    hop = 256
    starts = [s for s in range(0, n, hop) if s + FRAME < n]
    if not starts:
        return []
    energies = np.array([np.sqrt(np.mean(f[s:s + FRAME] ** 2)) for s in starts])
    floor = np.sort(energies)[int(np.floor(len(energies) * 0.20))] or 0.001
    thresh = max(0.003, floor * 1.6)
    hann = 0.5 * (1 - np.cos(2 * np.pi * np.arange(FRAME) / (FRAME - 1)))
    acc = np.zeros(BANDS)
    frames = 0
    for s, e in zip(starts, energies):
        if e < thresh:
            continue
        acc += _band_energies(f[s:s + FRAME] * hann)
        frames += 1
    if frames == 0:
        for s in starts:
            acc += _band_energies(f[s:s + FRAME])
            frames += 1
    return _finish(acc, frames)


def load_audio_48k(path: str) -> np.ndarray:
    """Read a FLAC/WAV file, mix to mono, resample to 48 kHz (the rate the app requests from the mic)."""
    import soundfile as sf
    from scipy.signal import resample_poly
    x, sr = sf.read(path, dtype="float32", always_2d=True)
    x = x.mean(axis=1)
    if sr != 48000:
        from math import gcd
        g = gcd(48000, sr)
        x = resample_poly(x, 48000 // g, sr // g).astype(np.float32)
    return x
