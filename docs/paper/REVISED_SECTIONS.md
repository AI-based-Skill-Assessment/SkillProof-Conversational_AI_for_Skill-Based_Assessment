# SkillProof: revised paper sections (draft)

Text to adapt into the IEEE manuscript. It describes the system **exactly as implemented** in this repository. Placeholders look like **[[FILL: …]]**; fill every one from the evaluation kit's output files (`backend/eval/README.md`) after the user study. Don't publish any number that wasn't measured.

Equation numbers below are suggestions. Match them to your manuscript, and remove or rename any symbol your current Eq. (1)–(4) uses that isn't defined here (see the notes in §3 and §4).

---

## 1. Implementation and experimental setup (reviewer comment 6)

**Software.** The backend is written in Python 3.11 (FastAPI 0.111, PostgreSQL 15, Redis) and the frontend in React 18 (Vite). Source revision: **[[FILL: git commit hash used for the study]]**.

**Language models.** Interview questions and scoring use `qwen/qwen3.8-27b` served through the Groq API, with temperature 0.3 for question generation and 0.1 for scoring. Speech is transcribed with Whisper large-v3 through the same API. If the API rate-limits a scoring request, the system waits and retries (up to 4 times). If scoring still fails, no score is stored and the attempt is repeated later. No simulated or fallback scores are used in the reported results; `interview_stats` confirms that 0 questions came from the offline simulation.

**Hardware.** All server components ran on a laptop with an Intel Core i5-1235U (10 cores, 12 threads), 16 GB RAM and integrated graphics, under Windows 11. LLM inference runs remotely on Groq's servers. Face detection and face-descriptor extraction run in the candidate's web browser.

**Prompts.** The full system prompt for question generation and the scoring prompt are in Appendix A; source: `backend/app/ai_engine/interview_context.py`.

**Interview structure.** Every interview has two fixed opening questions:
- Q1: self-introduction.
- Q2: a project in which the candidate used the assessed skills.

After that, the LLM generates follow-up questions conditioned on the full conversation, until the interview reaches between 5 and 7 questions in total. **This gives 3–5 AI-generated follow-ups per interview.** In the study, the observed number of follow-ups was **[[FILL: min–max, mean ± SD from interview_stats.md]]**. *(This replaces the inconsistent ranges in former Tables II and III.)*

**Question-generation time.** Generation time is measured for every AI question as the wall-clock duration of the LLM call. **[[FILL: Table of T3…T7 mean ± SD, median, p95 from interview_stats.md]]**. Each question is generated with the whole conversation so far as context, so the prompt grows with every turn. The correlation between prompt length and generation time was **[[FILL: Pearson r / Spearman ρ]]**. *(If no rising trend appears in the measurements, say so instead of describing one.)*

## 2. Biometric verification (reviewer comments 2 and 5)

**Enrolment templates (Eq. 1).** At registration the system stores:

- **Face:** three 128-dimensional face descriptors e_f^(k), k ∈ {frontal, left, right}, computed in the browser with face-api.js. It uses TinyFaceDetector (input size 320, score threshold 0.15), 68-point landmarks, and the ResNet-based FaceRecognitionNet.
- **Voice:** a 64-dimensional long-term average spectrum e_v. The FFT magnitude spectrum (512-sample frames, about 64 frames) is averaged into 64 equal-width bands and normalised by its maximum. This is a simple spectral profile, not a learned speaker embedding. *(The code can use SpeechBrain ECAPA-TDNN 192-dimensional embeddings instead, but they were [[FILL: not]] used in the reported configuration.)*

Only these numeric vectors are stored. Raw images and recordings are not stored.

> **Note on E_c:** the current manuscript's Eq. (1) contains an embedding E_c. If E_c is a certificate or context embedding, the implementation contains no such vector; certificates are processed as text (§5). Remove E_c, or define precisely what it is and where it is computed.

**Matching scores and decision (Eq. 2).** For a live face descriptor x_f and a live voice profile x_v:

- d_f = min_k ‖x_f − e_f^(k)‖₂, and the face score is s_f = −d_f
- s_v = 0.35 · max(0, 1 − ‖x_v − e_v‖₂ / 1.3) + 0.65 · max(0, ρ(x_v, e_v)), where ρ is the Pearson correlation
- **B = w · (s_f − μ_f) / σ_f + (1 − w) · (s_v − μ_v) / σ_v**, where μ and σ are the mean and SD of each modality's impostor scores (z-normalisation) and w = 0.5. Accept if B ≥ τ_B.

The deployed system applies **independent** decisions per modality: face accepted if d_f < 0.48, voice accepted if s_v ≥ 0.42. The face is checked every 2.5 s during the interview and the voice after every answer. A single non-matching frame is ignored, and two consecutive mismatches open one mismatch incident. Fusion B was evaluated offline on the same trials. Its threshold τ_B = **[[FILL: EER threshold]]** (at the EER) and **[[FILL]]** (at FAR = 1%).

**Evaluation protocol.**
- **Participants:** N = **[[FILL]]** (**[[FILL: brief description, e.g. undergraduate students; age range]]**).
- **Enrolment:** each enrolled once.
- **Live samples:** these were captured during **[[FILL]]** interviews.
- **Genuine trials:** a participant's live samples compared with their own template.
- **Zero-effort impostor trials:** every live sample compared with every other participant's template.
- **Deliberate impostor trials:** in **[[FILL]]** sessions, a different participant took over the interview, and their samples were compared with the account owner's template.
- **Confidence intervals:** 95% intervals come from a subject-level bootstrap (1000 resamples).

**Table [[N]]: Biometric verification performance (user study).** **[[FILL: paste the table from biometric_results.md]]**. Columns: subjects, genuine and impostor trials, EER (95% CI), AUC, FAR and FRR at the operating threshold, and FRR at FAR = 1%. One row each for face-only, voice-only and fused B.

**Figure [[N]]: ROC curves** for face-only, voice-only and fused B (`roc.png`).

*Interpretation, written after seeing the data:* state whether fusion lowered the EER relative to the better single modality. If it didn't, say so.

**Benchmark on public datasets (measured; usable now).** To characterise the matchers independently of the study sample, we ran the deployed matching code on public data (full protocol and files: `docs/paper/benchmark/`):

- *Face (LFW, View-2 protocol, 6000 pairs, 5933 scored):* EER **3.57%**, AUC 0.989, **10-fold accuracy 97.08 ± 0.52%** (threshold chosen on nine folds, tested on the tenth). At the deployed threshold (d_f < 0.48): FAR **0.00%**, FRR **34.31%**, i.e. the operating point is conservative. FRR at FAR = 1% is 4.75% (threshold d_f < 0.616).
- *Voice (LibriSpeech dev-clean, 40 speakers, 760 genuine / 29,640 impostor trials):* EER **21.88%** (95% CI 18.7–26.3%), AUC 0.860. At the deployed threshold (s_v ≥ 0.42): FAR **97.84%**, FRR 0.00%. The 64-band spectral profile is therefore a weak speaker feature at the deployed operating point; the EER threshold is s_v ≥ 0.865. A sensitivity check at the native 16 kHz rate gives EER 23.29%.
- *Fused B (40 chimeric subjects, 358 genuine / 13,962 impostor trials, w = 0.5):* EER **1.92%** (95% CI 0.84–2.78%), AUC 0.997, versus 2.23% for face-only and 20.56% for voice-only on the same subjects. τ_B = 1.336 at the EER and 1.474 at FAR = 1% (FRR 1.96%). Fusion therefore lowers the EER relative to the better single modality, even though the voice modality alone is weak. Weights w ∈ [0.5, 0.7] perform similarly (EER 1.68–1.92%).

**Table [[N]]: Benchmark results.** Paste the results table from `docs/paper/benchmark/BENCHMARK_RESULTS.md`. **Figure [[N]]:** `docs/paper/benchmark/roc.png` (linear and log-FAR ROC curves).

*Limitations of the benchmark (state them):* LFW photographs and LibriSpeech read speech differ from webcam and microphone capture (LibriSpeech is band-limited to 8 kHz and lossless, whereas the app's audio is Opus-compressed); enrolment used one image, not three poses; chimeric subjects assume face and voice are independent. The user study measures the same quantities under real capture conditions.

> **Action taken on the product:** given FAR ≈ 98% at s_v ≥ 0.42, voice mismatches are reported as low-weight signals pending recalibration on the study's microphone data, and the voice threshold is **[[FILL: kept at 0.42 / raised to …]]**.

## 3. Skill scoring (reviewer comment 3)

The LLM receives the full transcript, with each candidate answer marked as untrusted data, plus the list of assessed skills. For each skill j it returns three sub-scores on 0–100, using the explicit scale in Appendix A:
- specificity, P_j: concrete detail
- depth, D_j: correctness of technical explanation
- consistency, C_j: agreement across answers and with the claimed experience

It also returns a verdict (verified, suspicious or likely fraudulent) and written feedback for every answer. The system, **not the LLM**, computes the skill score:

**(Eq. 3)**  Q_j = (P_j + D_j + C_j) / 3,  and the assessment score is Q = (1/m) Σ_j Q_j over the m assessed skills.

> **Notation:** use Q (not S) for skill scores. S should then be used for nothing else, or for one other quantity only. If your current Eq. (3) uses technical knowledge T, communication C and problem-solving P with weights, replace it with the definitions above: those are the dimensions the system actually scores. If you prefer T, C and P, the scoring prompt must be changed and the study re-run.

> **Note on γ (Eq. 4):** the implementation has no explicit adaptation parameter. Adaptation happens because each question is generated with the full conversation history H_t: q_{t+1} = LLM(prompt(skills, H_t)). The system prompt asks the model to probe basics when the candidate shows little experience, and never to repeat a question. Either remove γ, or define it as exactly this mechanism, without a numeric parameter.

**Comparison with human interviewers.**
- **Raters:** **[[FILL: number]]** interviewers with **[[FILL: experience]]**.
- **Procedure:** each independently rated the anonymised transcripts on the same scale. They did not see the AI scores and were given items in shuffled order.
- **Ground truth:** the human consensus verdict, with ties assigned to "suspicious".

**Table [[N]]: AI–human agreement.** **[[FILL: from scoring_agreement.md]]**. Report per dimension: Pearson r, Spearman ρ, MAE, ICC(2,1) for AI with humans, and ICC(2,1) for humans only. For the verdict: agreement with the human consensus, pass/fail accuracy, weighted Cohen's κ (AI vs consensus), and human–human κ.

> The "skill assessment accuracy" reported in the abstract must be the measured verdict agreement with the human consensus (n = **[[FILL]]**), not the former 95%.

**Integrity score (Eq. 5).** I = max(0, 100 − Σ_k p_k · n_k). Here n_k is the number of recorded incidents of type k and p_k its penalty:

| Incident type | Penalty p_k |
|---|---|
| Face mismatch | 15 |
| Another person on camera | 15 |
| Voice mismatch | 12 |
| Tab switch | 6 |
| Second speaker | 6 |
| Copy/paste | 5 |
| Camera absence | 4 |
| Window blur | 3 |
| Looking away | 2 |

The proctoring incidents are defined as follows:
- **Another person on camera:** two or more faces visible for at least 1.5 s.
- **Camera absence:** no face visible for at least 5 s.
- **Looking away:** head yaw ratio outside [0.25, 0.75] or pitch ratio outside [0.18, 0.78], computed from 68-point landmarks, for at least 4 s.

Each type is counted at most once per 30 s.

## 4. Certificate processing: extraction vs authenticity (reviewer comment 4)

Certificate processing has two separate stages, and only the first is fully automatic.

1. **Extraction.** Text is read with PDF parsing or OCR (Tesseract), and QR codes are decoded. The candidate's name, issuing organisation, role, skills and any verification URL are then extracted.
2. **Plausibility checks, not authenticity proof.** The system tries three checks. A *successful* check shows that the issuer and details are *consistent* with public information; it does not prove that the issuer produced this document. Proof would need issuer-signed credentials, institutional APIs or a registry such as a blockchain anchor, which is future work.
   - **Verification link:** fetch the URL printed on the certificate (public internet addresses only) and check whether the page mentions the candidate and the credential.
   - **Company registry:** look the issuing company up in public registries (MCA21 company records by CIN, GST registration).
   - **Company website:** confirm the company's website exists.

**Moderated claims.**
- **Forgery:** replace claims of forgery resistance with: "SkillProof flags certificates whose details cannot be corroborated. It cannot detect a well-made forgery of a real, verifiable issuer."
- **Deepfakes and spoofing:** remove claims of deepfake resistance. Liveness detection and presentation-attack detection are **not implemented**: a printed photo, a replayed video or a synthetic voice is not specifically detected (§6).

## 5. Ethics: bias, consent, retention and reliability (reviewer comment 5)

**Purpose and human oversight.** SkillProof's biometric and proctoring outputs are signals for human review. Organisations see the scores, incidents and transcript, and make shortlisting decisions themselves. No candidate is rejected automatically.

**Consent.** Candidates register their face and voice deliberately. Before joining an organisation's assessment drive, they are told that their result and proctoring report will be shared with that organisation only.

**Data minimisation and retention.**
- **What is stored:** only numeric templates, never raw images or audio. Answer audio is sent for transcription and not stored.
- **Per-assessment copies:** erased automatically after a retention period (default 180 days, configurable).
- **Candidate control:** candidates can delete all their biometric data at any time from their account settings. Scores and reports contain no biometric data and are kept.
- **Study samples:** live samples collected for this study were kept only for the study period and are erased with the same retention rule.

**Demographic bias.** Face-recognition error rates are known to differ across demographic groups and capture conditions. **[[FILL: if participants volunteered group information, report the per-group FAR/FRR table from biometric_results.md with n per group; otherwise state that the sample was too small or homogeneous to assess bias, which is a limitation]]**. Because of this, mismatches only produce reviewable incidents, never automatic rejection.

**Reliability of the anti-cheating controls.**
- **Covered:** the controls detect another visible person, absence from the camera, sustained head turning, tab and window switching, and copy/paste.
- **Not covered:** a second screen outside the camera's view, an assistant out of view or out of earshot, audio prompting through earphones, and presentation attacks (photos, replayed or synthetic video and voice).
- **Spectral voice limit:** the spectral voice profile is a weak speaker feature compared with learned speaker embeddings; see its error rates in Table [[N]].

## 6. Limitations

- **Sample:** the study sample (N = **[[FILL]]**) is small and drawn from **[[FILL: population]]**, so the results may not generalise to real recruitment.
- **No liveness:** there is no liveness or presentation-attack detection.
- **Voice feature:** the voice profile is a long-term average spectrum, not a trained speaker model.
- **Plausibility, not proof:** certificate checks establish plausibility, not authenticity.
- **One LLM, one domain:** the LLM scores were compared with **[[FILL]]** human raters on one model only. Results may change with other models or other skill domains.

## 7. Comparison with existing systems (reviewer comment 7)

Fill the other columns **only from cited sources** (papers, or vendor documentation with access dates). Put "not reported" when a source doesn't say.

| Capability | SkillProof | [[System A + cite]] | [[System B + cite]] | [[Research system + cite]] |
|---|---|---|---|---|
| Conversational interview adapted to the candidate's answers | ✓ (LLM, 5–7 questions) | | | |
| Interview restricted to declared or required skills | ✓ | | | |
| Certificate text extraction (OCR/QR) | ✓ | | | |
| Certificate plausibility checks (link, registry, website) | ✓ | | | |
| Cryptographic certificate authenticity | ✗ (future work) | | | |
| Face verification against enrolment during interview | ✓ (128-D descriptors) | | | |
| Voice verification during interview | ✓ (spectral profile) | | | |
| Liveness / anti-spoofing | ✗ | | | |
| Proctoring (multiple faces, absence, head pose, tab switch, copy/paste) | ✓ | | | |
| Per-answer feedback to candidate | ✓ | | | |
| Tamper-evident signed result (HMAC) | ✓ | | | |
| Candidate-controlled biometric deletion | ✓ | | | |
| Measured agreement with human interviewers reported | ✓ (this paper) | | | |

## Appendix A: Prompts

Copy these verbatim from the source at the commit you report:
- **Question generation:** `InterviewContextBuilder.build_system_prompt` in `backend/app/ai_engine/interview_context.py`
- **Scoring:** `InterviewContextBuilder.build_scoring_prompt` in the same file. It includes the 0–100 scale and the verdict definitions.
- **Fixed questions:** Q1 and Q2 in `backend/app/ai_engine/interview_manager.py`
