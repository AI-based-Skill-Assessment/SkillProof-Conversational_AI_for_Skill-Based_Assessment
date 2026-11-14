# Instructions for human raters

Thank you for helping evaluate SkillProof. You will read anonymised transcripts of short technical interviews and rate how well each candidate demonstrated the named skill. Your ratings are the reference against which the AI's scores are compared, so please rate carefully and independently.

**Time needed:** about 3–5 minutes per transcript.

## Rules
1. Work **alone**. Do not discuss transcripts or scores with the other rater(s) until everyone has finished.
2. Rate **only what the candidate actually said**. Give no credit for confidence, politeness or long answers.
3. Fill in **every row** of your copy of `raters_blind.csv`. Each row is one interview and one skill; if an interview covers two skills it appears twice, rate each skill separately.
4. Put your name or initials in `rater_id` on every row.
5. Do not change the `item_id`, `skill` or `transcript` columns.
6. Save the file as CSV (keep the name, add your initials, e.g. `raters_blind_AK.csv`).

## What to fill in

| Column | Meaning | Range |
|---|---|---|
| `human_specificity` | How specific and detailed the answers were: concrete examples, tools, steps | 0–100 |
| `human_depth` | Technical depth: correct explanation of *how* and *why* | 0–100 |
| `human_consistency` | Do the answers agree with each other and with the experience the candidate claims? | 0–100 |
| `human_overall` | Your overall judgement of the candidate's level in this skill | 0–100 |
| `human_verdict` | `verified`, `suspicious` or `likely_fraudulent` | one word |
| `notes` | Optional | free text |

## Scale for every 0–100 score

| Score | Use when the candidate… |
|---|---|
| 0–15 | gave no real answer ("I don't know", off-topic, refused, only apologised) |
| 16–40 | named terms or concepts but could not explain them, or explained them wrongly |
| 41–60 | gave basic, partly correct explanations with little detail |
| 61–80 | gave correct explanations with some concrete examples or hands-on detail |
| 81–100 | gave precise, in-depth answers with specific real-world experience |

## Verdict

- **verified:** overall 60 or above, and the answers are consistent with the claimed skill.
- **suspicious:** weak or inconsistent answers.
- **likely_fraudulent:** claims the skill but clearly cannot explain its basics.

If you are unsure between two verdicts, choose the lower one.

## Notes
- Transcripts come from speech recognition, so small transcription errors are normal; judge the content, not the spelling.
- Candidate names have been removed. If you recognise a candidate anyway, rate as usual and mention it in `notes`.
- The first question is always a self-introduction; weigh the technical questions more.
