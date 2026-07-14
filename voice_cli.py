"""
voice_cli.py — Real-Time Terminal Voice Interview for SkillProof
================================================================
Runs a live voice interview entirely from your terminal — NO browser/frontend needed.

HOW IT WORKS:
  1. Connects to the FastAPI WebSocket (/api/v1/interview/{session_id}/ws)
  2. Speaks each question aloud using pyttsx3 (offline TTS)
  3. Records your answer from the microphone using sounddevice
  4. Transcribes it with SpeechRecognition (Google STT — free, no key)
  5. Sends the text to the server and waits for the next question
  6. Repeats until interview is complete, then prints the score report

DEPENDENCIES (install once):
  pip install websockets sounddevice scipy speechrecognition pyttsx3

USAGE:
  python voice_cli.py --session <SESSION_UUID>
  python voice_cli.py --session <SESSION_UUID> --url ws://127.0.0.1:8000

Press ENTER after each answer to confirm you're done speaking.
Or let it auto-detect silence after 5 seconds.
"""

import asyncio
import json
import sys
import argparse
import time
import tempfile
import os
import wave

try:
    import websockets
except ImportError:
    print("ERROR: Install websockets → pip install websockets")
    sys.exit(1)

try:
    import sounddevice as sd
    import numpy as np
    HAS_AUDIO = True
except ImportError:
    HAS_AUDIO = False
    print("⚠  sounddevice not installed — text-only mode will be used.")
    print("   To enable voice: pip install sounddevice scipy\n")

try:
    import speech_recognition as sr
    HAS_SR = True
except ImportError:
    HAS_SR = False
    print("⚠  speechrecognition not installed — text-only mode will be used.")
    print("   To enable voice: pip install speechrecognition\n")

try:
    import pyttsx3
    _tts_engine = pyttsx3.init()
    _tts_engine.setProperty("rate", 160)   # words per minute
    HAS_TTS = True
except Exception:
    HAS_TTS = False
    print("⚠  pyttsx3 not installed — questions will be shown as text only.")
    print("   To enable TTS: pip install pyttsx3\n")

# ─────────────────────────────────────────────────────────────────────────────
SAMPLE_RATE     = 16000   # Hz — what Google STT expects
RECORD_SECONDS  = 10      # max seconds to record per answer (extend if needed)
SILENCE_THRESH  = 0.01    # RMS threshold below which = silence
SILENCE_SECONDS = 2.5     # stop after this many consecutive silent seconds
# ─────────────────────────────────────────────────────────────────────────────

BLUE   = "\033[94m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
BOLD   = "\033[1m"
RESET  = "\033[0m"


def speak(text: str):
    """Speak text aloud using pyttsx3 (blocking)."""
    print(f"\n{BLUE}🤖 Interviewer:{RESET} {text}\n")
    if HAS_TTS:
        try:
            _tts_engine.say(text)
            _tts_engine.runAndWait()
        except Exception as e:
            print(f"   [TTS error: {e}]")


def record_audio_silence_detect() -> bytes:
    """
    Record from mic until SILENCE_SECONDS of silence, or RECORD_SECONDS total.
    Returns raw PCM bytes (int16, mono, 16 kHz).
    """
    print(f"{YELLOW}🎙  Recording... (speak now, auto-stop after {SILENCE_SECONDS}s silence){RESET}")
    frames = []
    silent_frames = 0
    chunk_size = int(SAMPLE_RATE * 0.1)   # 100ms chunks
    silence_limit = int(SILENCE_SECONDS / 0.1)
    max_chunks = int(RECORD_SECONDS / 0.1)

    with sd.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype="int16") as stream:
        for i in range(max_chunks):
            chunk, _ = stream.read(chunk_size)
            frames.append(chunk.copy())
            rms = float(np.sqrt(np.mean(chunk.astype(np.float32) ** 2))) / 32768.0
            if rms < SILENCE_THRESH:
                silent_frames += 1
            else:
                silent_frames = 0
            if silent_frames >= silence_limit and len(frames) > silence_limit + 5:
                break

    audio_np = np.concatenate(frames, axis=0)
    return audio_np.tobytes()


def transcribe_pcm(pcm_bytes: bytes) -> str:
    """
    Convert raw int16 PCM → WAV → SpeechRecognition → text.
    Falls back to Google STT (free, no API key).
    """
    if not HAS_SR:
        return ""

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_path = tmp.name
        with wave.open(tmp_path, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)         # int16 = 2 bytes
            wf.setframerate(SAMPLE_RATE)
            wf.writeframes(pcm_bytes)

    recognizer = sr.Recognizer()
    try:
        with sr.AudioFile(tmp_path) as source:
            audio_data = recognizer.record(source)
        text = recognizer.recognize_google(audio_data)
        return text
    except sr.UnknownValueError:
        return ""
    except sr.RequestError as e:
        print(f"   [STT network error: {e}]")
        return ""
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


def get_text_answer() -> str:
    """Fallback: typed answer in terminal."""
    return input(f"{GREEN}📝 Your answer:{RESET} ").strip()


def get_answer() -> str:
    """
    Get answer from microphone (if available) or keyboard.
    Allows the user to retry if STT returns empty.
    """
    for attempt in range(2):
        if HAS_AUDIO and HAS_SR:
            pcm = record_audio_silence_detect()
            text = transcribe_pcm(pcm)
            if text:
                print(f"\n{GREEN}✅ Transcribed:{RESET} {text}")
                confirm = input(f"{YELLOW}   Press ENTER to send, or type correction: {RESET}").strip()
                return confirm if confirm else text
            else:
                print(f"{RED}   [Could not transcribe — try again or type your answer]{RESET}")
        # Text fallback
        return get_text_answer()
    return ""


def print_score_report(evaluation: dict):
    """Pretty-print the final score evaluation."""
    print(f"\n{'='*60}")
    print(f"{BOLD}{GREEN}   🏆  INTERVIEW COMPLETE — SCORE REPORT{RESET}")
    print(f"{'='*60}")

    scores = evaluation.get("scores", [])
    if scores:
        for s in scores:
            skill = s.get("skill", "General")
            overall = s.get("overall_skill_score", 0)
            verdict = s.get("verdict", "")
            print(f"  {BOLD}{skill}{RESET}")
            print(f"    Score  : {overall:.1f}/100")
            print(f"    Verdict: {verdict}")
            reasoning = s.get("llm_reasoning", "")
            if reasoning:
                print(f"    Notes  : {reasoning[:120]}")
            print()

    total = evaluation.get("total_score", 0)
    if total:
        print(f"  {BOLD}Overall Score: {total:.1f}/100{RESET}")
    print(f"{'='*60}\n")


async def run_interview(session_id: str, base_url: str):
    ws_url = f"{base_url}/api/v1/interview/{session_id}/ws"
    print(f"\n{BOLD}SkillProof — Real-Time Voice Interview{RESET}")
    print(f"Connecting to: {ws_url}\n")

    try:
        async with websockets.connect(ws_url, ping_interval=20) as ws:
            # Wait for ready + first question
            raw = await ws.recv()
            msg = json.loads(raw)

            if msg.get("type") == "error":
                print(f"{RED}ERROR from server: {msg.get('message')}{RESET}")
                return

            candidate = msg.get("candidate", "Candidate")
            skills = msg.get("skills", [])
            first_q = msg.get("first_question", "")

            print(f"{BOLD}Welcome, {candidate}!{RESET}")
            print(f"Skills to be tested: {', '.join(skills) if skills else 'General'}\n")

            speak(first_q)

            # Interview loop
            while True:
                answer = get_answer()
                if not answer:
                    print(f"{YELLOW}No answer detected — sending empty response{RESET}")
                    answer = "(no answer provided)"

                await ws.send(json.dumps({"type": "answer", "text": answer}))

                # Wait for server response
                raw = await ws.recv()
                msg = json.loads(raw)
                msg_type = msg.get("type")

                if msg_type == "question":
                    q_text = msg.get("text", "")
                    speak(q_text)

                elif msg_type == "complete":
                    speak(msg.get("message", "Interview complete. Thank you!"))
                    evaluation = msg.get("evaluation", {})
                    print_score_report(evaluation)
                    break

                elif msg_type == "error":
                    print(f"{RED}Server error: {msg.get('message')}{RESET}")

    except ConnectionRefusedError:
        print(f"{RED}Could not connect to {ws_url}")
        print("Make sure the server is running: uvicorn app.main:app --reload{RESET}")
    except Exception as e:
        print(f"{RED}Connection error: {e}{RESET}")
        import traceback; traceback.print_exc()


# ─────────────────────────────────────────────────────────────────────────────
# Entry Point
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="SkillProof Real-Time Voice Interview CLI"
    )
    parser.add_argument(
        "--session", "-s",
        required=True,
        help="Session UUID from POST /api/v1/ingest (e.g. abc123-...)"
    )
    parser.add_argument(
        "--url", "-u",
        default="ws://127.0.0.1:8000",
        help="WebSocket base URL (default: ws://127.0.0.1:8000)"
    )
    args = parser.parse_args()

    asyncio.run(run_interview(args.session, args.url))
