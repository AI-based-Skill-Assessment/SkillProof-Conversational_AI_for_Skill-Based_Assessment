"""
eval/export_for_raters.py
Prepare a BLIND human-rating task (reviewer comment 3).

Writes three files:
  raters_blind.csv  give ONE COPY TO EACH human interviewer. Contains the
                    transcript only (candidate name removed, no AI scores) and
                    empty columns to fill in using RATING_GUIDE in eval/README.md.
  ai_scores.csv     the AI's scores for the same items. Do NOT show to raters.
  key.csv           item_id -> session_id. Keep private.

Then run:  python -m eval.scoring_agreement --ai ai_scores.csv --raters rater1.csv rater2.csv

Run from the backend folder:  python -m eval.export_for_raters [--since 2026-11-15]
"""
import argparse
import asyncio
import csv
import os
import random
import re
import sys
from datetime import datetime, timezone

RATER_COLUMNS = ["rater_id", "human_specificity", "human_depth", "human_consistency",
                 "human_overall", "human_verdict", "notes"]


async def _load(since):
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.database import async_session_factory
    from app.models.session import SessionStatus, VerificationSession

    async with async_session_factory() as db:
        stmt = (select(VerificationSession)
                .where(VerificationSession.status == SessionStatus.scored)
                .options(selectinload(VerificationSession.interview), selectinload(VerificationSession.scores)))
        if since:
            stmt = stmt.where(VerificationSession.created_at >= since)
        return (await db.execute(stmt)).scalars().all()


def format_transcript(transcript, candidate_name=None) -> str:
    lines = []
    for m in transcript or []:
        text = " ".join(str(m.get("content", "")).split())
        if candidate_name:
            for part in {candidate_name, *candidate_name.split()}:
                if len(part) > 2:
                    text = re.sub(re.escape(part), "[Candidate]", text, flags=re.IGNORECASE)
        who = "Interviewer" if m.get("role") == "assistant" else "Candidate"
        lines.append(f"{who}: {text}")
    return "\n".join(lines)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--since", help="Only sessions on/after this date (YYYY-MM-DD)")
    ap.add_argument("--out", default=os.path.join("eval_results", "rating_" + datetime.now().strftime("%Y%m%d_%H%M%S")))
    ap.add_argument("--seed", type=int, default=11, help="Shuffle seed (items are shuffled so order gives nothing away)")
    args = ap.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    since = datetime.fromisoformat(args.since).replace(tzinfo=timezone.utc) if args.since else None

    sessions = [s for s in asyncio.run(_load(since))
                if s.interview and any(m.get("role") == "user" for m in (s.interview.transcript or []))]
    random.Random(args.seed).shuffle(sessions)
    os.makedirs(args.out, exist_ok=True)

    blind, ai, key = [], [], []
    for n, s in enumerate(sessions, start=1):
        item = f"I{n:03d}"
        key.append({"item_id": item, "session_id": str(s.id)})
        transcript = format_transcript(s.interview.transcript, s.candidate_name)
        scores = list(s.scores or [])
        skills = list(s.extracted_skills or []) or ["General"]
        for k, sc in enumerate(scores):
            skill = getattr(sc, "skill_name", None) or (skills[k] if k < len(skills) else skills[0])
            blind.append({"item_id": item, "skill": skill, "transcript": transcript, **{c: "" for c in RATER_COLUMNS}})
            ai.append({"item_id": item, "skill": skill,
                       "ai_specificity": sc.specificity_score, "ai_depth": sc.depth_score,
                       "ai_consistency": sc.consistency_score, "ai_overall": sc.overall_skill_score,
                       "ai_verdict": getattr(sc.verdict, "value", sc.verdict)})

    def write(name, rows, fields):
        with open(os.path.join(args.out, name), "w", newline="", encoding="utf-8-sig") as fh:
            w = csv.DictWriter(fh, fieldnames=fields)
            w.writeheader()
            w.writerows(rows)

    write("raters_blind.csv", blind, ["item_id", "skill", "transcript"] + RATER_COLUMNS)
    write("ai_scores.csv", ai, ["item_id", "skill", "ai_specificity", "ai_depth", "ai_consistency", "ai_overall", "ai_verdict"])
    write("key.csv", key, ["item_id", "session_id"])
    print(f"{len(sessions)} interviews, {len(blind)} skill ratings to do. Files in {args.out}")
    print("Give each rater their own copy of raters_blind.csv; keep ai_scores.csv and key.csv private.")


if __name__ == "__main__":
    main()
