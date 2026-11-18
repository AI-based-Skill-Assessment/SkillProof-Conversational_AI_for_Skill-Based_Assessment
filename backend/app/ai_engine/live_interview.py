"""
Live (hands-free) interview mode, built on Pipecat.

The browser streams the microphone to the server over WebRTC (Pipecat
SmallWebRTCTransport). Silero VAD detects speech; when the candidate has been
silent for TURN_END_SECS the answer is complete, and the server

1. transcribes it (Whisper large-v3, English or Tamil-English, see multilingual.py),
2. checks the speaker against the registered voice (ECAPA-TDNN) and records
   the result exactly like the per-answer voice check of the normal mode,
3. sends {"type": "answer", ...} to the browser over the WebRTC data channel.

The browser then submits the answer on the interview WebSocket, so the
question flow, transcript, proctoring and scoring are the same code path as
the normal mode. Questions are still spoken by the browser; the browser mutes
its microphone track while a question is being read out, so the question is
never picked up as an answer.

Pipecat is optional: it is imported lazily and the endpoint returns 503 when
it is not installed (requirements-live.txt).
"""
import asyncio
import io
import time
import wave
from collections import deque
from typing import Optional
from uuid import UUID

SAMPLE_RATE = 16000
VAD_STOP_SECS = 0.8          # silence before VAD reports "stopped speaking"
TURN_END_SECS = 1.6          # extra silence after that before the answer counts as finished
PRE_ROLL_SECS = 0.5          # audio kept from before VAD fired, so the first word isn't clipped
MIN_ANSWER_SECS = 1.0        # shorter segments (coughs, "uh") are ignored
MAX_ANSWER_SECS = 180        # hard cap per answer
STUN_SERVERS = ["stun:stun.l.google.com:19302"]


def is_available() -> bool:
    try:
        import pipecat  # noqa: F401
        from pipecat.audio.vad.silero import SileroVADAnalyzer  # noqa: F401
        from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection  # noqa: F401
        return True
    except Exception:
        return False


def pcm16_to_wav(pcm: bytes, sample_rate: int = SAMPLE_RATE) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(pcm)
    return buf.getvalue()


async def process_answer_audio(session_id: UUID, wav: bytes, language: str) -> dict:
    """Transcribe one answer and run the voice check. Returns the message for the browser."""
    from app.ai_engine import multilingual
    from app.controllers.biometric import verify_session_voice
    from app.core import speaker_embedding as SE
    from app.database import async_session_factory

    async def _transcribe():
        return await multilingual.transcribe_answer(wav, "answer.wav", language)

    async def _voice():
        try:
            emb = await asyncio.to_thread(SE.embed_wav_bytes, wav)
        except Exception as e:  # model missing, audio too short, ...
            return {"voice_match": None, "error": str(e)}
        try:
            async with async_session_factory() as db:
                return await verify_session_voice(db, session_id, emb)
        except Exception as e:  # never lose the answer because the voice check failed
            print(f"[Live] Voice check failed: {e}")
            return {"voice_match": None, "error": "voice check unavailable"}

    stt, voice = await asyncio.gather(_transcribe(), _voice())
    if not stt or not stt.get("text"):
        return {"type": "no_speech", "voice": voice}
    return {"type": "answer", "text": stt["text"], "original": stt.get("original"),
            "language": stt.get("language"), "translated": stt.get("translated", False), "voice": voice}


def build_answer_segmenter(connection, session_id: UUID, language: str):
    """Pipecat processor that cuts the audio stream into answers (defined here so Pipecat stays optional)."""
    from pipecat.frames.frames import (
        Frame, InputAudioRawFrame, VADUserStartedSpeakingFrame, VADUserStoppedSpeakingFrame,
    )
    from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

    class AnswerSegmenter(FrameProcessor):
        def __init__(self):
            super().__init__()
            self.listening = True
            self.capturing = False
            self.buffer = bytearray()
            self.pre_roll = deque()
            self.pre_roll_bytes = 0
            self.finish_task: Optional[asyncio.Task] = None
            self.busy = False
            self.language = language
            self.rate = SAMPLE_RATE      # actual input sample rate, taken from the frames

        def send(self, message: dict):
            try:
                connection.send_app_message(message)
            except Exception as e:
                print(f"[Live] Could not send message to browser: {e}")

        def set_listening(self, on: bool):
            self.listening = on
            if not on:
                self._cancel_finish()
                self.capturing = False
                self.buffer = bytearray()

        def _cancel_finish(self):
            if self.finish_task and not self.finish_task.done():
                self.finish_task.cancel()
            self.finish_task = None

        async def _finish_after_pause(self):
            try:
                await asyncio.sleep(TURN_END_SECS)
            except asyncio.CancelledError:
                return
            pcm = bytes(self.buffer)
            rate = self.rate
            self.capturing = False
            self.buffer = bytearray()
            secs = len(pcm) / (2 * rate)
            if secs < MIN_ANSWER_SECS or self.busy:
                return
            self.busy = True
            self.send({"type": "processing", "seconds": round(secs, 1)})
            t0 = time.perf_counter()
            try:
                msg = await process_answer_audio(session_id, pcm16_to_wav(pcm, rate), self.language)
                msg["latency_ms"] = int((time.perf_counter() - t0) * 1000)
                msg["seconds"] = round(secs, 1)
                self.send(msg)
            except Exception as e:
                print(f"[Live] Answer processing failed: {e}")
                self.send({"type": "error", "message": "Could not process that answer. Please repeat it."})
            finally:
                self.busy = False

        async def process_frame(self, frame: Frame, direction: FrameDirection):
            await super().process_frame(frame, direction)
            if isinstance(frame, InputAudioRawFrame):
                if frame.num_channels == 1:
                    if frame.sample_rate != self.rate and not self.capturing:
                        self.rate = frame.sample_rate
                        self.pre_roll.clear()
                        self.pre_roll_bytes = 0
                    self.pre_roll.append(frame.audio)
                    self.pre_roll_bytes += len(frame.audio)
                    while self.pre_roll_bytes > PRE_ROLL_SECS * self.rate * 2 and self.pre_roll:
                        self.pre_roll_bytes -= len(self.pre_roll.popleft())
                    if self.capturing and len(self.buffer) < MAX_ANSWER_SECS * self.rate * 2:
                        self.buffer.extend(frame.audio)
            elif isinstance(frame, VADUserStartedSpeakingFrame):
                if self.listening and not self.busy:
                    self._cancel_finish()
                    if not self.capturing:
                        self.capturing = True
                        self.buffer = bytearray(b"".join(self.pre_roll))
                        self.send({"type": "speaking"})
            elif isinstance(frame, VADUserStoppedSpeakingFrame):
                if self.capturing:
                    self._cancel_finish()
                    self.finish_task = asyncio.create_task(self._finish_after_pause())
            await self.push_frame(frame, direction)

    return AnswerSegmenter()


async def run_live_bot(connection, session_id: UUID, language: str):
    """Run the Pipecat pipeline for one browser connection until it disconnects."""
    from pipecat.audio.vad.silero import SileroVADAnalyzer
    from pipecat.audio.vad.vad_analyzer import VADParams
    from pipecat.pipeline.pipeline import Pipeline
    from pipecat.pipeline.worker import PipelineParams, PipelineWorker
    from pipecat.processors.audio.vad_processor import VADProcessor
    from pipecat.transports.base_transport import TransportParams
    from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
    from pipecat.workers.runner import WorkerRunner

    transport = SmallWebRTCTransport(
        webrtc_connection=connection,
        params=TransportParams(audio_in_enabled=True, audio_in_sample_rate=SAMPLE_RATE, audio_out_enabled=False),
    )
    vad = VADProcessor(vad_analyzer=SileroVADAnalyzer(sample_rate=SAMPLE_RATE, params=VADParams(stop_secs=VAD_STOP_SECS)))
    segmenter = build_answer_segmenter(connection, session_id, language)

    worker = PipelineWorker(
        Pipeline([transport.input(), vad, segmenter]),
        params=PipelineParams(audio_in_sample_rate=SAMPLE_RATE),
        enable_rtvi=False,
        idle_timeout_secs=None,   # answers can be minutes apart
    )

    @transport.event_handler("on_client_connected")
    async def _connected(_transport, _client):
        segmenter.send({"type": "ready"})

    @transport.event_handler("on_client_disconnected")
    async def _disconnected(_transport, _client):
        await worker.cancel()

    @transport.event_handler("on_app_message")
    async def _app_message(_transport, message, _sender=None):
        # {"type": "listen", "on": bool}: browser is (not) waiting for an answer
        # {"type": "language", "value": "en" | "ta-en"}
        if not isinstance(message, dict):
            return
        if message.get("type") == "listen":
            segmenter.set_listening(bool(message.get("on")))
        elif message.get("type") == "language":
            from app.ai_engine.multilingual import normalise_mode
            segmenter.language = normalise_mode(message.get("value"))

    runner = WorkerRunner(handle_sigint=False)
    await runner.run(worker)
