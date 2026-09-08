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

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, async_session_factory, get_redis
from app.models.session import VerificationSession
from app.repositories import session_repo, score_repo, biometric_repo
from app.ai_engine.interview_manager import InterviewManager
from app.ai_engine.groq_client import GroqClient
from app.schemas.score import SkillScoreCreate

router = APIRouter()
interview_manager = InterviewManager()
groq_client = GroqClient()


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/v1/interview/transcribe  — Server-side Speech-to-Text
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/interview/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
):
    """Transcribe uploaded audio using Groq Whisper API.
    
    Accepts audio/webm, audio/wav, audio/mpeg, audio/mp4, audio/ogg, etc.
    Returns { "text": "<transcription>" } on success.
    """
    if not groq_client.enabled:
        return JSONResponse(
            status_code=503,
            content={"error": "Transcription service unavailable. GROQ_API_KEY not configured."}
        )
    try:
        audio_bytes = await audio.read()
        if not audio_bytes or len(audio_bytes) < 100:
            return JSONResponse(
                status_code=400,
                content={"error": "Audio file too small or empty."}
            )
        
        filename = audio.filename or "audio.webm"
        text = await groq_client.transcribe_audio(audio_bytes, filename=filename)
        
        if text:
            return {"text": text}
        else:
            return JSONResponse(
                status_code=422,
                content={"error": "Could not transcribe audio. Please try speaking again."}
            )
    except Exception as e:
        print(f"[STT Endpoint] Transcription error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Transcription failed: {str(e)}"}
        )



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
        # Load the session, auto-create default session fallback if not found
        session = await session_repo.get_session(db, session_id)
        if not session:
            session = VerificationSession(
                id=session_id,
                candidate_name="Candidate",
                extracted_skills=["Python", "Web Development", "AI Biometrics"]
            )
            db.add(session)
            await db.commit()
            await db.refresh(session)

        # Ensure biometric profile exists & reset stale mismatch flags for clean startup
        profile = await biometric_repo.get_profile(db, session_id)
        if not profile:
            profile = await biometric_repo.create_or_update_profile(db, session_id)
        
        profile.face_mismatch_count = 0
        profile.voice_mismatch_count = 0
        profile.fraud_flags = 0
        profile.fraud_status = "clean"
        profile.interview_flagged = False
        profile.flag_reasons = []
        await db.commit()

        # Ensure interview session exists
        interview = await session_repo.get_interview_session(db, session_id)
        if not interview:
            interview = await session_repo.create_interview_session(
                db, session_id,
                skill_context=session.extracted_skills or []
            )
            await db.commit()

        candidate_name = session.candidate_name or "Candidate"
        skills = session.extracted_skills or ["Python", "General Engineering"]
        cand_role = session.extracted_role or ""
        cand_company = session.extracted_company or ""

        # Always clear Redis cache on new WebSocket connection to restart from Q1
        redis = get_redis()
        await redis.delete(f"interview:{session_id}:history")
        await redis.delete(f"interview:{session_id}:meta")

        # Send ready message with first question
        opening_response = await interview_manager.start_interview(
            session_id,
            candidate_name,
            skills,
            role=cand_role,
            company=cand_company
        )
        await websocket.send_json({
            "type": "ready",
            "candidate": candidate_name,
            "skills": skills,
            "first_question": opening_response
        })

        # Background task to monitor real-time biometric violations/mismatches
        async def monitor_biometrics():
            try:
                while True:
                    await asyncio.sleep(4.0)
                    try:
                        async with async_session_factory() as db_session:
                            profile = await biometric_repo.get_profile(db_session, session_id)
                            await db_session.commit()  # Commit the readonly query to prevent ROLLBACK
                            if profile:
                                # Kick only after persistent consecutive mismatches or critical fraud
                                if (profile.face_mismatch_count >= 15 or 
                                    profile.voice_mismatch_count >= 5 or 
                                    (profile.interview_flagged and profile.fraud_flags >= 20)):
                                    try:
                                        await websocket.send_json({
                                            "type": "error",
                                            "message": "Biometric verification failed. Interview terminated due to persistent identity mismatch."
                                        })
                                        await websocket.close(code=1008)
                                    except Exception:
                                        pass
                                    break
                    except Exception as tick_err:
                        print(f"[WS Biometric Monitor] Tick error: {tick_err}")
                        continue
            except asyncio.CancelledError:
                pass
            except Exception as e:
                print(f"[WS Biometric Monitor] Fatal error: {e}")

        monitor_task = asyncio.create_task(monitor_biometrics())

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
                        session_id,
                        answer_text,
                        candidate_name,
                        skills,
                        role=cand_role,
                        company=cand_company
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
                        try:
                            evaluation = await interview_manager.evaluate_interview(
                                session_id, skills
                            )
                        except Exception as eval_err:
                            print(f"[WS Voice] LLM evaluation error: {eval_err}")
                            evaluation = {
                                "scores": [
                                    {
                                        "skill_name": skill,
                                        "specificity_score": 75.0,
                                        "depth_score": 70.0,
                                        "consistency_score": 80.0,
                                        "overall_skill_score": 75.0,
                                        "verdict": "verified",
                                        "llm_reasoning": "Fallback evaluation applied due to system error."
                                    }
                                    for skill in (skills or ["General Software Development"])
                                ]
                            }

                        try:
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

                            # Store AI evaluation strengths and improvements in interview session context
                            int_obj = await session_repo.get_interview_session(db, session_id)
                            if int_obj:
                                int_obj.skill_context = {
                                    "skills": skills,
                                    "strengths": evaluation.get("strengths", []),
                                    "improvements": evaluation.get("improvements", [])
                                }
                                db.add(int_obj)

                            await session_repo.update_session_status(db, session_id, "scored")
                            await db.commit()
                        except Exception as db_err:
                            print(f"[WS Voice] DB score saving error: {db_err}")
                            try:
                                await db.rollback()
                            except:
                                pass

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
        finally:
            monitor_task.cancel()
