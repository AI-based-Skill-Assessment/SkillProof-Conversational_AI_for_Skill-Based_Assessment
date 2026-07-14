"""
app/controllers/voice_interview.py
WebSocket-based real-time interview endpoint.

- NO file upload needed
- Connect via WebSocket at /api/v1/interview/{session_id}/ws
- Send JSON text messages with your answer
- Receive JSON messages with the next question spoken aloud (TTS on client)
- A companion CLI script (voice_cli.py at project root) records your
  microphone in real-time, sends transcribed text here, and speaks
  the questions back aloud — all without any browser/frontend.
"""

import json
import asyncio
from uuid import UUID
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, async_session_factory
from app.repositories import session_repo, score_repo
from app.ai_engine.interview_manager import InterviewManager
from app.schemas.score import SkillScoreCreate

router = APIRouter()
interview_manager = InterviewManager()


# ─────────────────────────────────────────────────────────────────────────────
# WebSocket Real-Time Interview
# ─────────────────────────────────────────────────────────────────────────────

@router.websocket("/interview/{session_id}/ws")
async def realtime_interview_ws(
    websocket: WebSocket,
    session_id: UUID,
):
    """
    Real-time interview via WebSocket.

    Protocol (all messages are JSON):

    CLIENT → SERVER:
      { "type": "answer", "text": "My answer here" }
      { "type": "ping" }      ← heartbeat

    SERVER → CLIENT:
      { "type": "question",   "text": "...", "q_index": 1, "total": 5 }
      { "type": "complete",   "message": "...", "scores": {...} }
      { "type": "error",      "message": "..." }
      { "type": "pong" }      ← heartbeat reply
      { "type": "ready",      "candidate": "...", "skills": [...] }
    """
    await websocket.accept()

    async with async_session_factory() as db:
        # Load the session
        session = await session_repo.get_session(db, session_id)
        if not session:
            await websocket.send_json({
                "type": "error",
                "message": f"Session {session_id} not found."
            })
            await websocket.close(code=1008)
            return

        # Ensure interview session exists
        interview = await session_repo.get_interview_session(db, session_id)
        if not interview:
            interview = await session_repo.create_interview_session(
                db, session_id,
                skill_context=session.extracted_skills or []
            )
            await db.commit()

        candidate_name = session.candidate_name or "Candidate"
        skills = session.extracted_skills or []

        # Send ready message with first question
        opening_response, _ = await interview_manager.process_turn(
            session_id,
            "__START__",         # sentinel — tells manager to emit opening question
            candidate_name,
            skills
        )
        await websocket.send_json({
            "type": "ready",
            "candidate": candidate_name,
            "skills": skills,
            "first_question": opening_response
        })

        # Main receive loop
        try:
            while True:
                raw = await websocket.receive_text()

                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Invalid JSON. Send { \"type\": \"answer\", \"text\": \"...\" }"
                    })
                    continue

                msg_type = msg.get("type", "answer")

                # Heartbeat
                if msg_type == "ping":
                    await websocket.send_json({"type": "pong"})
                    continue

                # Process answer
                if msg_type == "answer":
                    answer_text = (msg.get("text") or "").strip()
                    if not answer_text:
                        await websocket.send_json({
                            "type": "error",
                            "message": "Empty answer received."
                        })
                        continue

                    ai_response, is_complete = await interview_manager.process_turn(
                        session_id, answer_text, candidate_name, skills
                    )

                    # Persist chat history
                    chat_history = await interview_manager.get_history(session_id)
                    q_count = sum(1 for m in chat_history if m["role"] == "assistant")

                    await session_repo.update_interview_session(
                        db, session_id,
                        transcript=chat_history,
                        status="completed" if is_complete else "active",
                        question_count=q_count
                    )

                    if is_complete:
                        evaluation = await interview_manager.evaluate_interview(
                            session_id, skills
                        )
                        await score_repo.delete_scores_by_session(db, session_id)

                        scores_in = []
                        for s in evaluation.get("scores", []):
                            scores_in.append(SkillScoreCreate(
                                session_id=session_id,
                                specificity_score=float(s.get("specificity_score", 75.0)),
                                depth_score=float(s.get("depth_score", 75.0)),
                                consistency_score=float(s.get("consistency_score", 75.0)),
                                overall_skill_score=float(s.get("overall_skill_score", 75.0)),
                                verdict=s.get("verdict", "verified"),
                                llm_reasoning=s.get("llm_reasoning", "Completed via WebSocket.")
                            ))

                        if scores_in:
                            await score_repo.bulk_create_scores(db, scores_in)

                        await session_repo.update_session_status(db, session_id, "scored")
                        await db.commit()

                        await websocket.send_json({
                            "type": "complete",
                            "message": ai_response,
                            "evaluation": evaluation
                        })
                        break  # close after interview is done
                    else:
                        await db.commit()
                        await websocket.send_json({
                            "type": "question",
                            "text": ai_response,
                            "q_index": q_count
                        })

        except WebSocketDisconnect:
            print(f"[WS] Client disconnected from session {session_id}")
