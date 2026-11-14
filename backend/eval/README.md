# SkillProof evaluation kit

Tools that turn a real user study into the measurements the IEEE reviewers asked for. **Every number in the paper's results section must come from these outputs on real participants.** Synthetic data is only used in the tests, to check that the code works.

| Reviewer request | Produced by | Output file |
|---|---|---|
| 1. How identity-verification accuracy was measured, number of real candidates, ground truth | `biometric_eval` | `biometric_results.md` (accuracy, FAR and FRR at the production thresholds, n subjects and trials) |
| 1, 3. Skill-assessment accuracy and comparison with human interviewers | `export_for_raters` → humans rate → `scoring_agreement` | `scoring_agreement.md` |
| 2. FAR, FRR, EER, ROC for face-only, voice-only and fused B, plus the B threshold | `biometric_eval` | `biometric_results.md`, `roc_*.csv`, `roc.png` |
| 5. Demographic differences | `biometric_eval --groups` | "By demographic group" table |
| 6. Questions and follow-ups per interview, generation time T1..Tn, model used | `interview_stats` | `interview_stats.md`, `interviews.csv` |

Run every command from the `backend` folder with the virtual environment active. Each writes to a new `eval_results/<timestamp>/` folder; add `--out <folder>` to choose one.

---

## 1. Before the study

1. **Ethics and consent.** Get approval or an exemption from your institution's ethics committee if it requires one. Every participant signs a consent form covering:
   - face and voice templates are stored for the study
   - live samples taken during the interview are stored for analysis
   - how long data is kept, and that they can withdraw and have it deleted
   - that human raters will read their anonymised transcripts
   - optionally, a self-reported demographic group for the bias analysis
2. **Start the code you will report.** Use the current `main` branch. Write the commit hash in the paper.
3. **Switch on study mode** in `backend/.env`, then restart the backend:
   ```
   RESEARCH_LOGGING=true
   ```
   While this is on, every live face and voice sample checked during an interview is saved in `biometric_probes`. FAR and FRR can't be measured without them. Turn it off after the study.
4. **Keep a study log** (a spreadsheet): participant code, date, session, any deliberate impostor sessions (step 2.3), and optional group.

## 2. Running the study

Recommended size: **at least 30 participants** (more is better; every extra person adds many impostor comparisons), with a mix of skill levels.

1. **Enrolment.** Each participant creates an account and registers face and voice normally.
2. **Genuine interviews.** Each participant takes 1–2 skill interviews on a skill they actually have, at their real level. Use the same skill set for everyone, or record it.
3. **Deliberate impostor sessions** (about 10 or more). A participant starts an interview on their own account, and a *different* participant then sits in front of the camera and answers. Record the session ID and the real person in `impostors.csv`:
   ```
   session_id,true_subject
   2b9c...-....,<user id of the person who actually sat in>
   ```
   Zero-effort impostor trials (every sample compared with every *other* person's template) are generated automatically and need no extra sessions.
4. **Optional groups.** For the demographic analysis, write `groups.csv`:
   ```
   subject,group
   <user id>,female
   ```
   Only use what participants volunteered. Small groups give unreliable rates, so always report n.

## 3. Measurements

### Biometrics (comments 1, 2, 5)
```
python -m eval.biometric_eval --impostor-sessions impostors.csv --groups groups.csv
pip install matplotlib   # optional, to also get roc.png
```
Reports, for **face-only, voice-only and fused B**:
- EER, with a 95% subject-level bootstrap confidence interval, and the threshold at the EER
- AUC
- FAR, FRR and accuracy at the production thresholds
- FRR at FAR = 1%, with its threshold
- the deliberate-impostor acceptance rate

The fused score is B = w·z(face) + (1−w)·z(voice), with w = 0.5. Each score is z-normalised with the mean and SD of its impostor scores. The fusion weight that minimises EER on the same data is also printed, but it's optimistic: report it only as secondary.

### Interview statistics (comment 6)
```
python -m eval.interview_stats --since 2026-11-20      # the study start date
```
Generation time per question is recorded for interviews run with the current code, in the `gen_ms` field of each transcript entry.

### AI vs human interviewers (comments 1, 3)
1. `python -m eval.export_for_raters --since 2026-11-20` creates `raters_blind.csv`, `ai_scores.csv` and `key.csv`.
2. Give **two or more** qualified human interviewers each their own copy of `raters_blind.csv`. They must **not** see `ai_scores.csv`. Each fills in `rater_id` and the human columns using the guide below, independently, without discussing.
3. `python -m eval.scoring_agreement --ai ai_scores.csv --raters rater1.csv rater2.csv`

Report the human–human agreement next to the AI–human agreement: it shows how much humans themselves agree, which is the realistic ceiling.

## 4. Rating guide (give this to human raters)

Rate each interview transcript for the skill named in the row. Score **only what the candidate actually said**. Give no credit for confidence, politeness or length.

| Column | Meaning |
|---|---|
| `human_specificity` (0–100) | How specific and detailed the answers were (concrete examples, tools, steps) |
| `human_depth` (0–100) | Technical depth: correct explanation of how and why |
| `human_consistency` (0–100) | Whether the answers agree with each other and with the claimed experience |
| `human_overall` (0–100) | Your overall judgement of the skill |
| `human_verdict` | `verified`, `suspicious` or `likely_fraudulent` |

Scale for every score:

| Score | Meaning |
|---|---|
| 0–15 | No real answer ("I don't know", off-topic, refuses, or only apologises) |
| 16–40 | Names terms but cannot explain them, or explains them wrongly |
| 41–60 | Basic, partly correct explanations with little detail |
| 61–80 | Correct explanations with some concrete examples or hands-on detail |
| 81–100 | Precise, in-depth answers with specific real-world experience |

Verdicts:
- **verified:** overall 60+ and consistent with the claimed skill
- **suspicious:** weak or inconsistent
- **likely_fraudulent:** claims the skill but clearly cannot explain the basics

The AI is given the same scale (see `app/ai_engine/interview_context.py`).

## 5. Public-dataset benchmark (no participants needed)

`eval/benchmark/` measures the app's **own** face and voice matching code on public datasets, which gives citable FAR/FRR/EER/ROC figures for face-only, voice-only and fused B independently of the user study. Results: `docs/paper/benchmark/BENCHMARK_RESULTS.md`.

To reproduce (from `backend`, about 40 minutes, mostly face extraction):

```bash
# 1. Data (public): LFW + View-2 pairs, LibriSpeech dev-clean
mkdir -p bench/data && cd bench/data
curl -L -o lfw.tgz https://ndownloader.figshare.com/files/5976018 && tar -xzf lfw.tgz
curl -L -o pairs.txt https://ndownloader.figshare.com/files/5976006
curl -L -o dev-clean.tar.gz https://www.openslr.org/resources/12/dev-clean.tar.gz && tar -xzf dev-clean.tar.gz
cd ../..

# 2. Manifest (6000 LFW pairs, 40 chimeric subjects, 800 utterances)
python -m eval.benchmark.prepare_lists bench/data bench/work

# 3. Face descriptors with the app's face-api.js models, in a headless browser
mkdir -p bench/web && cp ../frontend/public/face-api.min.js eval/benchmark/face_page.html bench/web/ && cp -r ../frontend/public/models bench/web/models
python -I -m http.server 8765 --bind 127.0.0.1 --directory bench &      # serves /web and /data
npm i playwright-core   # once; needs Edge or Chrome installed (BROWSER_CHANNEL=chrome to use Chrome)
node eval/benchmark/face_extract.cjs http://127.0.0.1:8765 bench/work/face_list.txt bench/work/face_descriptors.json

# 4. Voice features (Python port of the browser feature, verified against the JS)
python -m eval.benchmark.voice_extract bench/data bench/work --rate 48000
python -m eval.benchmark.voice_extract bench/data bench/work --rate 16000   # sensitivity check

# 5. Metrics, tables and ROC figure
python -m eval.benchmark.run_benchmark bench/work ../docs/paper/benchmark
```

## 6. After the study

- Set `RESEARCH_LOGGING=false`.
- Study samples are erased automatically after `BIOMETRIC_RETENTION_DAYS` (default 180). Participants can delete their data at any time in **Settings → Delete biometric data**.
- Keep `key.csv` and the rating files private; they link anonymised items back to sessions.
