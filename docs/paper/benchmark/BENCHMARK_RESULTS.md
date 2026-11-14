# Biometric matching benchmark on public datasets

Generated 2026-11-14T13:10:48 by `python -m eval.benchmark.run_benchmark` at commit `7985fe7`. These are **measured** results of the application's own matching code on public data; no number here was estimated or simulated.

## Data and protocol

- **Face:** LFW (Labeled Faces in the Wild), standard View-2 verification protocol: 6000 pairs in 10 folds. Faces were detected in 8017 of 8035 images with the app's detector; 67 pairs were skipped because a face was not detected in one image (counted as neither accept nor reject). The first image of a pair is processed with the app's enrolment settings (TinyFaceDetector 224/0.25) and the second with its live-check settings (320/0.15); both give 128-D face-api.js descriptors; score = −(L2 distance).
- **Voice:** LibriSpeech dev-clean, 40 speakers, up to 20 utterances each. Utterance 1 = registration feature (template), the others = live-check features (probes); every probe is compared with every speaker's template. Audio was resampled from 16 kHz to 48 kHz (the rate the app requests from the microphone) before the app's 64-band spectral feature was computed; the Python port of the browser feature was verified to match the original JavaScript to 1e-6.
- **Fused:** 40 chimeric subjects (LFW identity + LibriSpeech speaker), 1 enrolment and up to 9 paired probes each. B = w·z(face) + (1−w)·z(voice), z-normalised with each modality's impostor mean/SD, w = 0.5.
- Confidence intervals: subject-level bootstrap (1000 resamples) where subjects are defined (voice, chimeric).

## Results

| Setting | Genuine trials | Impostor trials | EER (95% CI) | EER threshold | AUC | Operating threshold | FAR | FRR | Accuracy | FRR @ FAR = 1% (threshold) | FRR @ FAR = 0.1% |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Face only (LFW, 6000 pairs) | 2970 | 2963 | 3.57% | -0.6643 | 0.9890 | distance < 0.48 | 0.00% | 34.31% | 82.82% | 4.75% @ -0.6163 | 13.33% |
| Voice only (LibriSpeech, 48 kHz) | 760 | 29640 | 21.88% (18.68%–26.32%) | 0.8647 | 0.8601 | similarity ≥ 0.42 | 97.84% | 0.00% | 4.61% | 84.47% @ 0.9494 | 96.84% |
| Voice only (LibriSpeech, 16 kHz native, sensitivity check) | 760 | 29640 | 23.29% (18.10%–28.16%) | 0.7326 | 0.8519 | similarity ≥ 0.42 | 87.44% | 0.66% | 14.73% | 79.47% @ 0.8879 | 96.18% |
| Face only (chimeric subset) | 358 | 13962 | 2.23% (1.38%–3.34%) | -0.6295 | 0.9934 | distance < 0.48 | 0.00% | 28.21% | 99.29% | 4.19% @ -0.6038 | 8.94% |
| Voice only (chimeric subset) | 358 | 13962 | 20.56% (17.41%–24.75%) | 0.8693 | 0.8775 | similarity ≥ 0.42 | 97.92% | 0.00% | 4.53% | 84.92% @ 0.9488 | 96.09% |
| Fused B (w = 0.5) | 358 | 13962 | 1.92% (0.84%–2.78%) | 1.3364 | 0.9972 | B ≥ 1.336 (EER point) | n/a | n/a | n/a | 1.96% @ 1.4738 | 5.03% |

**LFW 10-fold accuracy** (threshold chosen on 9 folds, tested on the 10th, standard protocol): **97.08% ± 0.52%**.

Fusion weight with the lowest EER on the chimeric set: w = 0.6 (EER 1.68%); full grid: w=0.0: 20.56%, w=0.1: 10.33%, w=0.2: 5.32%, w=0.3: 3.63%, w=0.4: 2.23%, w=0.5: 1.92%, w=0.6: 1.68%, w=0.7: 1.68%, w=0.8: 1.86%, w=0.9: 2.22%, w=1.0: 2.23%. The weight is chosen on the same data, so this is optimistic; w = 0.5 is the primary result.

## Reading the table

- *Operating threshold* is the decision rule the application uses; FAR/FRR/Accuracy in those columns are what the deployed system would do on this data. *EER threshold* and *FRR @ FAR = 1%* show what other operating points cost.
- Accuracy for the LFW row is on balanced pairs (50% genuine). For voice and chimeric rows impostor trials vastly outnumber genuine ones, so FAR and FRR are the meaningful figures there, not accuracy.

## Limitations (state these in the paper)

- LFW images are web photos, not webcam frames; LibriSpeech is read speech in quiet rooms, band-limited to 8 kHz, and lossless, whereas the app's microphone audio passes through Opus/WebM compression. Real-deployment error rates can differ in both directions.
- Enrolment used one image per identity; the app enrols three poses, which can only lower the face FRR.
- Chimeric subjects assume face and voice are independent, which is standard practice but still an assumption.
- No liveness or presentation-attack detection is evaluated or implemented.

Files: `roc_*.csv` (full ROC data), `roc.png`.
