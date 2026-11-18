"""
Tamil-English (code-mixed) answers.

Many candidates in Tamil Nadu answer technical questions in a mix of Tamil and
English ("naan intha project-la React use pannen..."). In "ta-en" mode:

1. Whisper large-v3 transcribes with automatic language detection and a short
   code-mixed prompt, which biases it towards keeping English technical words
   in Latin script instead of transliterating them.
2. The LLM translates the transcript into plain English with strict rules
   (translate only: no adding, correcting or improving), so the interview and
   the scoring rubric work unchanged.
3. The original transcript is kept next to the English text in the interview
   transcript, so a reviewer can always check the translation.

Questions are still asked in English; only answers may be code-mixed.
"""
import re
from typing import Optional

from app.ai_engine.groq_client import GroqClient, GroqUnavailable

groq_client = GroqClient()

LANG_EN = "en"
LANG_TA_EN = "ta-en"
SUPPORTED = (LANG_EN, LANG_TA_EN)

_TAMIL_SCRIPT = re.compile(r"[஀-௿]")
_THINK = re.compile(r"<think>.*?</think>", re.S)

# Whisper "prompt": an example of the expected style (code-mixed, English terms in Latin script)
WHISPER_TA_EN_PROMPT = (
    "இந்த project-ல நான் React and Node.js use பண்ணேன். "
    "Database-க்கு PostgreSQL use பண்ணோம், API-ஐ FastAPI-ல எழுதினேன்."
)

TRANSLATE_SYSTEM_PROMPT = (
    "You translate a candidate's spoken interview answer into English. The answer may be in "
    "Tamil script, romanised Tamil (Tanglish), English, or a mix of them.\n"
    "Rules:\n"
    "- Translate the meaning faithfully and completely.\n"
    "- Keep every technical term, tool, library, product, person or company name, number and code "
    "identifier exactly as spoken.\n"
    "- Do NOT add, remove, explain, summarise, correct or improve anything, even if the answer is "
    "wrong, vague or incomplete. A weak answer must stay a weak answer.\n"
    "- If the text is already entirely in English, return it unchanged.\n"
    "Output only the English translation, with no notes or quotation marks."
)


def normalise_mode(mode: Optional[str]) -> str:
    mode = (mode or LANG_EN).strip().lower()
    return mode if mode in SUPPORTED else LANG_EN


def has_tamil_script(text: str) -> bool:
    return bool(_TAMIL_SCRIPT.search(text or ""))


async def translate_to_english(text: str) -> Optional[str]:
    """English translation of a code-mixed answer, or None if the LLM is unavailable."""
    if not text.strip():
        return text
    try:
        out = await groq_client.chat_completion(
            [{"role": "system", "content": TRANSLATE_SYSTEM_PROMPT},
             {"role": "user", "content": text}],
            temperature=0.0,
            max_tokens=1000,
            retries=1,
            allow_simulation=False,
        )
    except GroqUnavailable as e:
        print(f"[Multilingual] Translation unavailable: {e}")
        return None
    out = _THINK.sub("", out or "").strip().strip('"').strip()
    return out or None


async def transcribe_answer(audio_bytes: bytes, filename: str, mode: str) -> Optional[dict]:
    """
    Transcribe one spoken answer.
    Returns {"text": English text used by the interview and scoring,
             "original": what was said (None when it equals text),
             "language": language Whisper detected (ta-en mode only),
             "mode": "en" | "ta-en", "translated": bool}
    or None when nothing could be transcribed.
    """
    mode = normalise_mode(mode)
    if mode == LANG_EN:
        text = await groq_client.transcribe_audio(audio_bytes, filename=filename)
        return {"text": text, "original": None, "language": "english", "mode": mode, "translated": False} if text else None

    det = await groq_client.transcribe_audio_detailed(
        audio_bytes, filename=filename, language=None, prompt=WHISPER_TA_EN_PROMPT)
    if not det or not det.get("text"):
        return None
    original = det["text"]
    english = await translate_to_english(original)
    if english is None:
        # Translation failed: pass the original through rather than lose the answer
        return {"text": original, "original": None, "language": det.get("language"),
                "mode": mode, "translated": False}
    changed = english.strip() != original.strip()
    return {"text": english, "original": original if changed else None, "language": det.get("language"),
            "mode": mode, "translated": changed}
