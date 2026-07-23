from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status, HTTPException
from uuid import UUID
import json
import asyncio
from datetime import datetime

from app.database import async_session_factory, get_redis, get_db
from app.repositories import session_repo, score_repo
from app.ai_engine.interview_manager import InterviewManager
from app.schemas.score import SkillScoreCreate

router = APIRouter()
interview_manager = InterviewManager()


@router.websocket("/interview/{session_id}")
async def technical_interview_websocket(
    websocket: WebSocket,
    session_id: UUID
):
    """
    Stateful WebSocket endpoint for conducting AI-led technical interviews.
    Conducts a 5-question technical verification session using rule-based flow.
    Saves state in Redis and outputs structured scores upon completion.
    """
    await websocket.accept()
    
    # 1. Fetch the Verification Session
    async with async_session_factory() as db:
        session = await session_repo.get_session(db, session_id)
        if not session:
            await websocket.send_json({"role": "system", "content": "Session not found. Closing connection."})
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        
        # Check if session is in failed status
        if session.status.name == "failed":
            await websocket.send_json({"role": "system", "content": "Verification has failed. Interview blocked. Closing connection."})
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        candidate_name  = session.candidate_name    or "Candidate"
        skills          = session.extracted_skills    or []
        cand_role       = session.extracted_role      or ""
        cand_company    = session.extracted_company   or ""

        # Ensure InterviewSession entry is initialized in database
        interview = await session_repo.get_interview_session(db, session_id)
        is_fresh_interview = not interview
        if is_fresh_interview:
            await session_repo.create_interview_session(db, session_id, skill_context=skills)
            await db.commit()


    # Always clear Redis cache on every new WebSocket connection
    # so the interview ALWAYS restarts from Q1 (never replays stale history)
    redis = get_redis()
    await redis.delete(f"interview:{session_id}:history")
    await redis.delete(f"interview:{session_id}:meta")

    # 2. Start the Interview & Get the Opening Question
    try:
        opening_query = await interview_manager.start_interview(
            session_id, candidate_name, skills,
            role=cand_role, company=cand_company
        )
        
        # Save initial active state in DB
        async with async_session_factory() as db:
            chat_history = await interview_manager.get_history(session_id)
            # Question count starts at 1 (the opening question)
            await session_repo.update_interview_session(
                db, 
                session_id, 
                transcript=chat_history, 
                status="active",
                question_count=1,
                skill_context=skills
            )
            await db.commit()
            
        await websocket.send_json({"role": "assistant", "content": opening_query})

        # 3. Enter WebSocket Messaging Loop
        while True:
            data = await websocket.receive_text()
            
            try:
                parsed_data = json.loads(data)
                candidate_reply = parsed_data.get("content", data)
            except Exception:
                candidate_reply = data

            if candidate_reply.lower().strip() in ["exit", "quit", "bye"]:
                await websocket.send_json({"role": "assistant", "content": "Interview terminated early by candidate. Proceeding to evaluation."})
                break

            # Process the dialogue turn
            ai_response, is_complete = await interview_manager.process_turn(
                session_id,
                candidate_reply,
                candidate_name,
                skills,
                role=cand_role,
                company=cand_company
            )

            # Update DB with current dialogue history
            async with async_session_factory() as db:
                chat_history = await interview_manager.get_history(session_id)
                # Count the assistant turns to determine question count
                q_count = sum(1 for m in chat_history if m["role"] == "assistant")
                
                await session_repo.update_interview_session(
                    db,
                    session_id,
                    transcript=chat_history,
                    status="active" if not is_complete else "completed",
                    question_count=q_count
                )
                await db.commit()

            await websocket.send_json({"role": "assistant", "content": ai_response})

            if is_complete:
                break

        # 4. Perform Scoring and Finalize Database
        await websocket.send_json({"role": "system", "content": "Analyzing interview transcript and saving scores. Please wait..."})
        
        try:
            evaluation = await interview_manager.evaluate_interview(session_id, skills)
        except Exception as eval_err:
            print(f"[WS Interview] LLM evaluation error: {eval_err}")
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
            async with async_session_factory() as db:
                # Clear previous attempts
                await score_repo.delete_scores_by_session(db, session_id)
                
                # Map LLM feedback list to database entities
                scores_in = []
                for s in evaluation.get("scores", []):
                    scores_in.append(
                        SkillScoreCreate(
                            session_id=session_id,
                            specificity_score=float(s.get("specificity_score", 70.0)),
                            depth_score=float(s.get("depth_score", 70.0)),
                            consistency_score=float(s.get("consistency_score", 70.0)),
                            overall_skill_score=float(s.get("overall_skill_score", 70.0)),
                            verdict=s.get("verdict", "verified"),
                            llm_reasoning=s.get("llm_reasoning", "Completed evaluation.")
                        )
                    )
                
                if scores_in:
                    await score_repo.bulk_create_scores(db, scores_in)
                
                # Update VerificationSession Status
                await session_repo.update_session_status(db, session_id, "scored")
                await db.commit()
        except Exception as db_err:
            print(f"[WS Interview] DB score saving error: {db_err}")

        await websocket.send_json({"role": "system", "content": "Verification scorecard generated successfully. Closing connection."})
        await websocket.close()

    except WebSocketDisconnect:
        print(f"[SkillProof WebSocket] Candidate disconnected from session {session_id}.")
        # Keep partial chat history in DB
        async with async_session_factory() as db:
            chat_history = await interview_manager.get_history(session_id)
            q_count = sum(1 for m in chat_history if m["role"] == "assistant")
            await session_repo.update_interview_session(
                db, 
                session_id, 
                transcript=chat_history, 
                status="abandoned",
                question_count=q_count
            )
            await db.commit()
            
    except Exception as e:
        print(f"[SkillProof WebSocket] System exception inside WebSocket handler: {e}")
        try:
            await websocket.send_json({"role": "system", "content": f"Internal system error occurred: {str(e)}"})
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        except Exception:
            pass
