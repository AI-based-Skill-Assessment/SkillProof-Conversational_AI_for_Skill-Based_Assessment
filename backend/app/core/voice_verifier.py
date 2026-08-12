"""
app/core/voice_verifier.py
Backend Voice Verification Engine using SpeechBrain (ECAPA-TDNNVoxCeleb)
with fallback to spectral formant feature extraction if ML libraries are unavailable.
"""

import io
import math
import numpy as np
from typing import List, Optional, Dict, Any, Tuple


class BackendVoiceVerifier:
    def __init__(self) -> None:
        self._classifier = None
        self._ml_available = False
        self._init_speechbrain()

    def _init_speechbrain(self) -> None:
        """Initialize SpeechBrain pretrained ECAPA-TDNN speaker recognition model."""
        try:
            from speechbrain.inference.speaker import EncoderClassifier
            # Load pretrained ECAPA-TDNN VoxCeleb model
            self._classifier = EncoderClassifier.from_hparams(
                source="speechbrain/spkrec-ecapa-voxceleb",
                savedir="scratch/pretrained_models/spkrec-ecapa-voxceleb"
            )
            self._ml_available = True
            print("[BackendVoiceVerifier] SpeechBrain ECAPA-TDNN ML model loaded successfully!")
        except Exception as e:
            print(f"[BackendVoiceVerifier] SpeechBrain ML model unavailable ({e}). Using robust spectral formant fallback.")
            self._ml_available = False

    def extract_voice_embedding(self, audio_bytes: bytes) -> List[float]:
        """
        Extract speaker embedding from raw audio bytes (WAV / WebM).
        Uses SpeechBrain ECAPA-TDNN (192-dim) if available,
        otherwise falls back to 64-band spectral formant vector.
        """
        if self._ml_available and self._classifier is not None:
            try:
                import torch
                import torchaudio

                # Load audio from bytes stream
                signal, fs = torchaudio.load(io.BytesIO(audio_bytes))

                # Resample to 16kHz if needed
                if fs != 16000:
                    resampler = torchaudio.transforms.Resample(orig_freq=fs, new_freq=16000)
                    signal = resampler(signal)

                # Extract 192-dim ECAPA-TDNN embedding tensor
                embeddings = self._classifier.encode_batch(signal)
                emb_vector = embeddings.squeeze().detach().cpu().numpy().tolist()
                return [float(x) for x in emb_vector]
            except Exception as err:
                print(f"[BackendVoiceVerifier] SpeechBrain extraction error: {err}. Falling back to spectral formants.")

        # Fallback: Extract spectral vector from raw float PCM samples
        return self._fallback_spectral_extraction(audio_bytes)

    def _fallback_spectral_extraction(self, audio_bytes: bytes) -> List[float]:
        """High-precision 64-band spectral formant feature vector fallback."""
        try:
            # Try decoding raw float32 / pcm16 PCM bytes
            audio_arr = np.frombuffer(audio_bytes, dtype=np.float32)
            if len(audio_arr) < 512:
                audio_arr = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0

            if len(audio_arr) < 512:
                return []

            # 64-band log FFT power spectrum
            num_bands = 64
            frame_size = 512
            hop_size = 256
            bands = np.zeros(num_bands)
            count = 0

            for start in range(0, len(audio_arr) - frame_size, hop_size):
                frame = audio_arr[start:start + frame_size]
                fft_mag = np.abs(np.fft.rfft(frame))
                bins_per_band = len(fft_mag) // num_bands
                for b in range(num_bands):
                    band_sum = np.sum(fft_mag[b * bins_per_band:(b + 1) * bins_per_band])
                    bands[b] += band_sum / max(1, bins_per_band)
                count += 1

            if count == 0:
                return []

            avg_bands = bands / count
            max_val = np.max(avg_bands)
            if max_val > 0:
                avg_bands = avg_bands / max_val
            return avg_bands.tolist()
        except Exception as e:
            print(f"[BackendVoiceVerifier] Fallback extraction error: {e}")
            return []

    def compute_voice_similarity(self, vec_a: List[float], vec_b: List[float]) -> float:
        """
        Calculates speaker similarity score.
        Uses Pearson correlation on log formants for spectral vectors (len 64)
        or Cosine similarity for ECAPA-TDNN vectors (len 192).
        """
        if not vec_a or not vec_b:
            return 0.0

        # If vector dimensions differ (e.g. 64-dim vs 192-dim), resample to matching size
        if len(vec_a) != len(vec_b):
            target_len = max(len(vec_a), len(vec_b))
            vec_a = np.interp(np.linspace(0, 1, target_len), np.linspace(0, 1, len(vec_a)), vec_a).tolist()
            vec_b = np.interp(np.linspace(0, 1, target_len), np.linspace(0, 1, len(vec_b)), vec_b).tolist()

        if len(vec_a) == 192:
            # Cosine similarity for ECAPA-TDNN deep embeddings
            dot = sum(a * b for a, b in zip(vec_a, vec_b))
            mag_a = math.sqrt(sum(a * a for a in vec_a))
            mag_b = math.sqrt(sum(b * b for b in vec_b))
            if mag_a == 0 or mag_b == 0:
                return 0.0
            return dot / (mag_a * mag_b)

        # Pearson correlation for spectral formant vectors
        epsilon = 1e-8
        log_a = [math.log(max(0.0, float(x)) + epsilon) for x in vec_a]
        log_b = [math.log(max(0.0, float(x)) + epsilon) for x in vec_b]

        formants_a = [log_a[i+1] - log_a[i] for i in range(len(log_a) - 1)]
        formants_b = [log_b[i+1] - log_b[i] for i in range(len(log_b) - 1)]

        def smooth(vec: List[float], window: int = 7) -> List[float]:
            half = window // 2
            res = []
            for i in range(len(vec)):
                start = max(0, i - half)
                end = min(len(vec), i + half + 1)
                res.append(sum(vec[start:end]) / (end - start))
            return res

        smoothed_a = smooth(formants_a, window=7)
        smoothed_b = smooth(formants_b, window=7)

        n = len(smoothed_a)
        mu_a = sum(smoothed_a) / n
        mu_b = sum(smoothed_b) / n
        ca = [a - mu_a for a in smoothed_a]
        cb = [b - mu_b for b in smoothed_b]
        dot = sum(a * b for a, b in zip(ca, cb))
        mag_a = math.sqrt(sum(a * a for a in ca))
        mag_b = math.sqrt(sum(b * b for b in cb))
        sim = dot / (mag_a * mag_b)
        print(f"[DEBUG] Speaker comparison similarity: {sim:.4f}")
        return sim
