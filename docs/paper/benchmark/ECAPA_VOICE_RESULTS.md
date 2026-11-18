# Voice verification with ECAPA-TDNN (LibriSpeech dev-clean)

Generated 2026-11-15T11:48:18 by `python -m eval.benchmark.ecapa_voice`.
Model: SpeechBrain `spkrec-ecapa-voxceleb` (192-d embeddings, trained on VoxCeleb), cosine similarity. Same protocol as the spectral feature in BENCHMARK_RESULTS.md: 40 speakers, utterance 1 = template, others = probes; 760 genuine / 29640 impostor trials.

| Feature | EER (95% CI) | EER threshold | AUC | FRR @ FAR = 1% (threshold) | FRR @ FAR = 0.1% (threshold) |
|---|---|---|---|---|---|
| ECAPA-TDNN | 2.63% (0.62%–4.34%) | 0.2961 | 0.9978 | 4.08% @ 0.3396 | 8.68% @ 0.4357 |
| Browser spectral feature (previous) | 21.88% (18.68%–26.32%) | 0.8647 | 0.8601 | 84.47% | 96.84% |


## Fusion with ECAPA voice (40 chimeric subjects, same protocol as BENCHMARK_RESULTS.md)

B = 0.5·z(face) + 0.5·z(voice), z-normalised with each modality's impostor mean/SD.

| Setting | Genuine trials | Impostor trials | EER (95% CI) | EER threshold | AUC | FRR @ FAR = 1% (threshold) |
|---|---|---|---|---|---|---|
| Face only | 358 | 13962 | 2.23% (1.38%–3.34%) | -0.6295 | 0.9934 | 4.19% @ -0.6038 |
| Voice only (ECAPA) | 358 | 13962 | 1.73% (0.43%–3.33%) | 0.3159 | 0.9987 | 3.07% @ 0.3391 |
| Fused B (w = 0.5) | 358 | 13962 | 0.28% (0.00%–0.56%) | 2.1126 | 1.0000 | 0.00% @ 1.7643 |

Fusion-weight grid (EER): w=0.0: 1.73%, 0.1: 1.33%, 0.2: 0.64%, 0.3: 0.28%, 0.4: 0.14%, 0.5: 0.28%, 0.6: 0.28%, 0.7: 0.56%, 0.8: 1.12%, 0.9: 1.40%, 1.0: 2.23% (optimistic: chosen on the same data; w = 0.5 is the primary result).

## Deployed decision rule

Voice accepted when ECAPA cosine similarity ≥ 0.34 (FAR 1%, FRR 4.1% on LibriSpeech). Embeddings are computed on the server from the uploaded audio (`app/core/speaker_embedding.py`).

## Pilot study (laptop microphone)

The pilot voice results in the paper (EER 38.9%, FAR 100%) were measured with the previous browser spectral feature, which this replaces. They must be re-measured with ECAPA after participants re-register their voices.

Live status (2026-11-15): one participant has re-registered with ECAPA. All 7 of their genuine voice samples were accepted (cosine 0.475–0.723, median 0.629, threshold 0.34). The live session after registration (06ab7df9) passed 4/4 voice checks. No ECAPA impostor trials exist yet, so pilot FAR and EER for ECAPA remain **[[FILL]]** until at least one other participant re-registers and an impostor session is run.
