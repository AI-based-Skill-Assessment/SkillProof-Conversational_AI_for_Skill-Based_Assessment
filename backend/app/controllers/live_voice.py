"""
Live (hands-free) interview mode: WebRTC signalling for the Pipecat pipeline.

POST /api/v1/live/{session_id}/offer   {sdp, type, language}  -> {sdp, type, pc_id}

The browser sends an SDP offer (microphone track + data channel, ICE gathered
up front, so no trickle endpoint is needed); the server answers and starts a
Pipecat pipeline for that connection (app/ai_engine/live_interview.py).
"""
import asyncio
from typing import Dict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai_engine import live_interview
from app.ai_engine.multilingual import normalise_mode
from app.database import get_db
from app.security.deps import ensure_session_access, get_current_user

router = APIRouter()

# pc_id -> (session_id, connection); one live connection per interview session
_connections: Dict[str, tuple] = {}
_tasks: set = set()


class OfferRequest(BaseModel):
    sdp: str = Field(..., max_length=100_000)
    type: str = "offer"
    language: str = "en"


@router.get("/live/status", summary="Is live (hands-free) interview mode available on this server?")
async def live_status():
    return {"available": live_interview.is_available()}


@router.post("/live/{session_id}/offer", summary="Start live (hands-free) interview audio over WebRTC")
async def live_offer(
    session_id: UUID,
    body: OfferRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not live_interview.is_available():
        raise HTTPException(status_code=503, detail="Live mode is not installed on this server (pip install -r requirements-live.txt).")
    if body.type != "offer":
        raise HTTPException(status_code=400, detail="Expected an SDP offer.")
    await ensure_session_access(db, session_id, current_user)

    from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection

    # Close a previous live connection for the same interview (page reload, reconnect)
    for pc_id, (sid, conn) in list(_connections.items()):
        if sid == session_id:
            _connections.pop(pc_id, None)
            try:
                await conn.disconnect()
            except Exception:
                pass

    conn = SmallWebRTCConnection(ice_servers=live_interview.STUN_SERVERS)
    await conn.initialize(sdp=body.sdp, type=body.type)
    answer = conn.get_answer()
    pc_id = answer["pc_id"]
    _connections[pc_id] = (session_id, conn)

    @conn.event_handler("closed")
    async def _closed(c):
        _connections.pop(pc_id, None)

    async def _run():
        try:
            await live_interview.run_live_bot(conn, session_id, normalise_mode(body.language))
        except Exception as e:
            print(f"[Live] Pipeline for session {session_id} ended with error: {e}")
        finally:
            _connections.pop(pc_id, None)

    task = asyncio.create_task(_run())
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    return answer
