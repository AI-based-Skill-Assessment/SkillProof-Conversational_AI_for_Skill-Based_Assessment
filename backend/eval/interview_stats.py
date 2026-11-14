"""
eval/interview_stats.py
Measured interview statistics (reviewer comment 6).

From the transcripts saved in the database it reports:
  - questions per interview and the number of AI-generated follow-ups
    (min / max / mean: settles the "2-5 vs 3-12 follow-ups" table conflict)
  - question-generation time per question position T1..Tn (mean, SD, median, p95)
    and its correlation with prompt length (the conversation grows each turn,
    so a rising trend should be explained by context length, not assumed)
  - the LLM model(s) actually used, and how many questions came from the
    offline simulation (should be 0 in a valid study)
  - interview duration

Generation times are recorded for interviews run after this was added
(transcript entries carry "gen_ms"); older interviews only count questions.

Run from the backend folder:  python -m eval.interview_stats [--since 2026-11-15]
"""
import argparse
import asyncio
import csv
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone

from eval import metrics as M


async def _load(since):
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.database import async_session_factory
    from app.models.session import VerificationSession

    async with async_session_factory() as db:
        stmt = select(VerificationSession).options(selectinload(VerificationSession.interview))
        if since:
            stmt = stmt.where(VerificationSession.created_at >= since)
        rows = (await db.execute(stmt)).scalars().all()
        return [(str(s.id), getattr(s.status, "value", s.status), s.interview.transcript or [])
                for s in rows if s.interview and s.interview.transcript]


def analyse(interviews):
    """interviews: [(session_id, status, transcript)] -> stats dict."""
    per_interview = []
    latency_by_pos = defaultdict(list)
    lat_vs_prompt = []
    models = Counter()
    sources = Counter()
    for sid, status, tr in interviews:
        q = [m for m in tr if m.get("role") == "assistant"]
        answers = [m for m in tr if m.get("role") == "user" and str(m.get("content", "")).strip()]
        ai_q = [m for m in q if m.get("source") == "ai"]
        has_source = any("source" in m for m in q)
        # Q1 and Q2 are fixed; everything after Q2 except the closing line is an AI follow-up
        follow_ups = len(ai_q) if has_source else max(0, len(q) - 2)
        times = [datetime.fromisoformat(m["timestamp"]) for m in tr if m.get("timestamp")]
        per_interview.append({
            "session_id": sid, "status": status, "questions": len(q), "answers": len(answers),
            "ai_follow_ups": follow_ups, "timed": has_source,
            "duration_min": round((max(times) - min(times)).total_seconds() / 60, 2) if len(times) > 1 else None,
        })
        for pos, m in enumerate(q, start=1):
            if m.get("source"):
                sources[m["source"]] += 1
            if m.get("source") == "ai" and isinstance(m.get("gen_ms"), (int, float)):
                latency_by_pos[pos].append(m["gen_ms"])
                if m.get("prompt_chars"):
                    lat_vs_prompt.append((m["prompt_chars"], m["gen_ms"]))
            if m.get("model"):
                models[m["model"]] += 1
    return per_interview, latency_by_pos, lat_vs_prompt, models, sources


def report(per_interview, latency_by_pos, lat_vs_prompt, models, sources, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    completed = [p for p in per_interview if p["answers"] > 0]
    L = ["# Interview statistics", "",
         f"Generated {datetime.now().isoformat(timespec='seconds')} by `python -m eval.interview_stats`.",
         f"Interviews with a transcript: {len(per_interview)} ({len(completed)} with at least one answer).", ""]

    def row(name, vals):
        d = M.describe(vals)
        if not d.get("n"):
            return f"| {name} | 0 | | | | |"
        return f"| {name} | {d['n']} | {d['min']:.0f} | {d['max']:.0f} | {d['mean']:.2f} | {d['sd']:.2f} |"

    L += ["## Questions per interview", "", "| Measure | Interviews | Min | Max | Mean | SD |", "|---|---|---|---|---|---|",
          row("Questions asked (incl. 2 fixed + closing)", [p["questions"] for p in completed]),
          row("AI-generated follow-up questions", [p["ai_follow_ups"] for p in completed]),
          row("Answers given", [p["answers"] for p in completed]),
          row("Duration (minutes)", [p["duration_min"] for p in completed if p["duration_min"] is not None]),
          "", "Design limits in code: 2 fixed opening questions, then AI follow-ups until 5 to 7 questions "
          "in total (`_MIN_QUESTIONS = 5`, `_MAX_QUESTIONS = 7` in `app/ai_engine/interview_manager.py`).", ""]

    L += ["## Question-generation time by position (milliseconds)", ""]
    if latency_by_pos:
        L += ["| Question | n | Mean | SD | Median | p95 |", "|---|---|---|---|---|---|"]
        for pos in sorted(latency_by_pos):
            d = M.describe(latency_by_pos[pos])
            L.append(f"| T{pos} | {d['n']} | {d['mean']:.0f} | {d['sd']:.0f} | {d['median']:.0f} | {d['p95']:.0f} |")
        if len(lat_vs_prompt) >= 3:
            x, y = zip(*lat_vs_prompt)
            L += ["", f"Correlation between prompt length (characters) and generation time: "
                  f"Pearson r = {M.pearson(x, y):.3f}, Spearman ρ = {M.spearman(x, y):.3f} (n = {len(x)}). "
                  "Each question is generated with the whole conversation so far, so the prompt grows with every turn."]
    else:
        L.append("No timed questions yet: run interviews with the current code (it records `gen_ms` per question).")

    L += ["", "## Model and question source", ""]
    L += [f"- Model `{k}`: {v} AI questions" for k, v in models.most_common()] or ["- (no model recorded yet)"]
    L += [f"- Source `{k}`: {v} questions" for k, v in sources.most_common()]
    if sources.get("simulated"):
        L.append(f"- WARNING: {sources['simulated']} questions came from the offline simulation (Groq unavailable). "
                 "Exclude those interviews from the study.")

    with open(os.path.join(out_dir, "interviews.csv"), "w", newline="") as fh:
        wr = csv.DictWriter(fh, fieldnames=list(per_interview[0].keys()) if per_interview else ["session_id"])
        wr.writeheader()
        wr.writerows(per_interview)
    text = "\n".join(L) + "\n"
    open(os.path.join(out_dir, "interview_stats.md"), "w", encoding="utf-8").write(text)
    return text


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--since", help="Only interviews on/after this date (YYYY-MM-DD), e.g. the study start")
    ap.add_argument("--out", default=os.path.join("eval_results", datetime.now().strftime("%Y%m%d_%H%M%S")))
    args = ap.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    since = datetime.fromisoformat(args.since).replace(tzinfo=timezone.utc) if args.since else None
    interviews = asyncio.run(_load(since))
    print(report(*analyse(interviews), args.out))
    print(f"Saved to {args.out}")


if __name__ == "__main__":
    main()
