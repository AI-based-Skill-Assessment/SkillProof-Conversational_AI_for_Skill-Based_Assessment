# Response to Reviewers (draft)

**Paper:** SkillProof: Conversational AI for Skill-Based Assessment
**Placeholders:** **[[FILL: …]]** marks numbers from the user study (`backend/eval` outputs) and section or table numbers from the revised manuscript.

> **Before sending, check that every sentence describes what you actually did.** Where this draft offers alternatives (e.g. comment 1), keep only the one that is true and delete the rest.

---

We thank the reviewers for their careful reading and constructive comments. In response, we ran a user study with real participants and replaced the results section with measured results. We also aligned the method description and equations with the implemented system, and moderated claims that the system does not support. Our point-by-point responses follow; changes in the manuscript are highlighted.

---

### Comment 1: Experimental validation
> *The 98% identity verification and 95% skill assessment accuracies come from only ten simulated trials, and the values in Tables I–V rise in perfectly uniform steps…*

**Response.** We agree with the reviewer. *[Keep the one sentence that is true:]* The values in the original Section IV came from a small preliminary simulation (ten trials) and should not have been presented as measured accuracies. / The values in the original Section IV came from ten informal trials by the authors and were not a controlled measurement.

We have removed them and conducted a user study:
- **Participants:** N = **[[FILL]]** (**[[FILL: who, e.g. undergraduate students in computer science, age range]]**). Each enrolled their face and voice and completed **[[FILL]]** skill interviews.
- **Identity ground truth:** the enrolled identity of each participant. In addition, in **[[FILL]]** sessions a different participant deliberately took over the interview, which gives known impostor attempts.
- **Skill ground truth:** independent ratings of the anonymised transcripts by **[[FILL]]** human interviewers, using the same rubric as the system and blind to the AI scores.
- **Measurement:** all metrics are computed by open evaluation scripts released with the code.

The identity-verification accuracy is now reported with its definition, number of trials and confidence interval (Section **[[FILL]]**, Table **[[FILL]]**): **[[FILL: accuracy, FAR, FRR at the operating threshold, n trials]]**. The skill-assessment accuracy is now the agreement between the system's verdict and the human consensus: **[[FILL]]%** (n = **[[FILL]]**, weighted κ = **[[FILL]]**). The former Tables I–V have been replaced.

### Comment 2: Biometric evaluation
> *Report FAR, FRR, EER or ROC and state the matching threshold for the fused score B in Eq. (2)…*

**Response.** Table **[[FILL]]** now reports, for face-only, voice-only and the fused score B:
- the number of subjects, genuine and impostor trials
- EER with a 95% subject-level bootstrap confidence interval
- AUC
- FAR and FRR at the operating thresholds
- FRR at FAR = 1%

Figure **[[FILL]]** shows the ROC curves. Eq. (2) now defines B precisely: a weighted sum, with w = 0.5, of z-normalised face and voice scores.

In addition to the user study, we benchmarked the deployed matching code on public datasets so that the matchers are characterised on a larger sample (Section **[[FILL]]**, Table **[[FILL]]**): on LFW (View-2 protocol, 6000 pairs) the face matcher reaches EER 3.57% and 97.08 ± 0.52% 10-fold accuracy; on LibriSpeech dev-clean (40 speakers, 30,400 trials) the voice matcher reaches EER 21.88% (95% CI 18.7–26.3%), and at the deployed threshold (similarity ≥ 0.42) its FAR is 97.84%; score-level fusion on 40 chimeric subjects reaches EER 1.92% (95% CI 0.84–2.78%) versus 2.23% for face-only and 20.56% for voice-only. The fusion threshold τ_B is 1.336 at the EER and 1.474 at FAR = 1%. Fusion therefore reduces the EER relative to the better single modality. We state plainly that the voice feature is weak at its deployed operating point and describe the recalibration. The deployed system applies per-modality thresholds (face distance < 0.48, which on LFW gives FAR 0.00% and FRR 34.31%); fusion is reported as the evaluated alternative. User-study results under real capture conditions: **[[FILL from biometric_results.md]]**.

### Comment 3: Skill and adaptive scoring
> *Explain how T, C and P in Eq. (3) are assigned by the LLM, and whether they have been compared with human interviewer assessments. Also define γ in Eq. (4), avoid using S for several quantities, and explain the role of E_c in Eq. (1).*

**Response.** Section **[[FILL]]** now gives the full scoring procedure and the exact prompts (Appendix A).
- **Sub-scores:** the LLM (`qwen/qwen3.8-27b`, temperature 0.1) assigns three sub-scores per skill on a 0–100 scale with explicit anchors: specificity, depth and consistency. Eq. (3) has been corrected to these implemented dimensions.
- **Skill score:** computed by the system, not the LLM, as their mean, Q_j = (P_j + D_j + C_j)/3.
- **Comparison with humans:** **[[FILL]]** human interviewers rated the same transcripts blind. Table **[[FILL]]** reports Pearson r, Spearman ρ, MAE and ICC(2,1) per dimension, the human–human agreement as a reference, and verdict agreement with weighted Cohen's κ.
- **Notation:** S now denotes only **[[FILL / nothing]]**; skill scores use Q.
- **γ:** the system has no numeric adaptation parameter; questions adapt because each is generated from the full conversation history. Eq. (4) now states this / γ has been removed.
- **E_c:** **[[FILL: removed, because no such embedding exists in the system / defined as …]]**.

### Comment 4: Certificate validation
> *Distinguish document extraction from actual credential authenticity checking, and moderate the claims on forgery and deepfake resistance…*

**Response.** We agree. Section **[[FILL]]** now separates (i) extraction (OCR, QR decoding, field extraction) from (ii) plausibility checks: fetching the verification link printed on the certificate, company registry look-ups, and website existence. We state explicitly that these checks do not prove that the issuer produced the document; cryptographic or issuer-API verification is future work. We removed the claims of forgery and deepfake resistance and state that liveness and presentation-attack detection are not implemented.

### Comment 5: Biometrics in hiring
> *Discuss demographic bias, candidate consent, data retention, and how reliable the anti-spoofing and anti-cheating controls are.*

**Response.** A new section (**[[FILL]]**) covers these points.
- **Consent:** obtained at biometric registration and before results are shared with an organisation.
- **Data minimisation:** only numeric templates are stored; images and audio are not.
- **Retention:** per-assessment copies are deleted automatically after a fixed period (180 days by default), and candidates can delete all their biometric data at any time from their account. *These controls were implemented in the revised system.*
- **Human oversight:** biometric and proctoring outputs are signals for human review; no candidate is rejected automatically.
- **Bias:** **[[FILL: per-group FAR/FRR with n per group, or a statement that the sample was too small or homogeneous to assess bias]]**.
- **Reliability:** we list what the anti-cheating controls detect and what they do not (second screens, off-camera help, presentation attacks).

### Comment 6: Experimental details and tables
> *State the LLM, hardware and prompts, explain why question-generation time increases from T1 to T10, the Table II/III conflict, and define the Table V metrics.*

**Response.**
- **Setup:** Section **[[FILL]]** now states the LLM (`qwen/qwen3.8-27b` via the Groq API, temperatures 0.3 and 0.1), speech recognition (Whisper large-v3), the hardware (Intel Core i5-1235U, 16 GB RAM; LLM inference remote), the software versions and the commit. Appendix A gives the full prompts.
- **Interview length:** two fixed questions, then 3–5 AI follow-ups (5–7 questions in total). Observed in the study: **[[FILL]]**. This resolves the conflict between former Tables II and III.
- **Generation time:** now measured per question. Table **[[FILL]]** reports mean ± SD, median and p95 for each position. Because each question is generated with the whole conversation as context, the prompt grows each turn; prompt length and generation time correlated with r = **[[FILL]]**. *[If no trend: "No systematic increase was observed; the former T1–T10 values have been replaced."]*
- **Table V:** the undefined metrics (Recog., Clarity, Confid.) have been **[[FILL: removed / replaced by defined metrics: …]]**.

### Comment 7: Comparison with existing work
**Response.** Section **[[FILL]]** adds a feature-wise comparison with **[[FILL: systems]]** (Table **[[FILL]]**), based on their published descriptions. It also compares our measured AI–human agreement with values reported in **[[FILL: cite]]**, where available.

### Comment 8: Presentation
**Response.** We corrected the citations:
- **[[FILL: [7] and [10] replaced with … for AI interviews]]**
- **[[FILL: reference [14] added / removed]]**

We unified the table numbering (Table I, II, …), removed first-person wording (e.g. "my recommendation" in Algorithm Step 9), and proofread the manuscript.

---

We believe these revisions substantially strengthen the evidence for the framework, and we thank the reviewers again for their guidance.
