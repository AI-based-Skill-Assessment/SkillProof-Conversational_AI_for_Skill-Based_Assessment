import asyncio
import io
from typing import List, Dict, Any, Optional
from app.config import settings


class GroqUnavailable(Exception):
    """Groq is configured but could not answer (rate limit, outage, bad key)."""


def _retry_after_seconds(err) -> Optional[float]:
    """Read Groq's Retry-After header from a rate-limit error, if present (capped at 60s)."""
    try:
        value = err.response.headers.get("retry-after")
        return min(60.0, max(1.0, float(value))) if value else None
    except Exception:
        return None


class GroqClient:
    def __init__(self) -> None:
        self.api_key = settings.GROQ_API_KEY
        self.enabled = bool(self.api_key and not self.api_key.startswith("gsk_mock"))
        self.client = None
        
        if self.enabled:
            try:
                from groq import Groq
                self.client = Groq(api_key=self.api_key)
            except ImportError:
                print("[SkillProof AI] 'groq' package not installed. Operating in simulation mode.")
                self.enabled = False

    async def chat_completion(
        self, 
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 1500,
        retries: int = 0,
        allow_simulation: bool = True,
    ) -> str:
        """
        Call Groq API asynchronously.

        retries: how many times to wait and retry when Groq says "rate limited"
                 (HTTP 429). The free tier allows ~1000 output tokens per minute,
                 so back-to-back scorings regularly hit it.
        allow_simulation: when False and Groq is configured but still failing,
                 raise GroqUnavailable instead of returning simulated output.
                 Scoring uses this so a Groq hiccup never becomes a fake grade.
        """
        model = model or settings.GROQ_CHAT_MODEL
        self.last_model = model
        self.last_simulated = False
        if self.enabled and self.client:
            last_error = None
            for attempt in range(retries + 1):
                try:
                    loop = asyncio.get_running_loop()
                    response = await loop.run_in_executor(
                        None,
                        lambda: self.client.chat.completions.create(
                            messages=messages,
                            model=model,
                            temperature=temperature,
                            max_tokens=max_tokens
                        )
                    )
                    return response.choices[0].message.content
                except Exception as e:
                    last_error = e
                    rate_limited = getattr(e, "status_code", None) == 429 or "429" in str(e)
                    if rate_limited and attempt < retries:
                        wait = _retry_after_seconds(e) or (10, 20, 30, 40)[min(attempt, 3)]
                        print(f"[SkillProof AI] Groq rate limit hit; retrying in {wait}s ({attempt + 1}/{retries}).")
                        await asyncio.sleep(wait)
                        continue
                    break
            if not allow_simulation:
                raise GroqUnavailable(str(last_error))
            print(f"[SkillProof AI] Error calling Groq API: {last_error}. Falling back to simulation.")

        # Async simulation fallback
        self.last_simulated = True
        await asyncio.sleep(0.5)  # Simulate network latency
        return self._generate_simulated_response(messages)

    async def transcribe_audio(self, audio_bytes: bytes, filename: str = "audio.webm") -> Optional[str]:
        """Transcribe audio using Groq's Whisper API. Returns transcribed text or None on failure."""
        if not self.enabled or not self.client:
            return None
        try:
            loop = asyncio.get_running_loop()
            audio_file = io.BytesIO(audio_bytes)
            audio_file.name = filename

            response = await loop.run_in_executor(
                None,
                lambda: self.client.audio.transcriptions.create(
                    file=(filename, audio_bytes),
                    model="whisper-large-v3",
                    language="en",
                )
            )
            return response.text.strip() if response and response.text else None
        except Exception as e:
            print(f"[GroqClient] Transcription error: {e}")
            return None

    def _generate_simulated_response(self, messages: List[Dict[str, str]]) -> str:
        """Heuristic responses to mock interviews when Groq is not active."""
        system_content = next((m["content"] for m in messages if m["role"] == "system"), "")
        user_messages = [m["content"] for m in messages if m["role"] == "user"]
        
        # Detect scoring context by the specific system role marker set in interview_manager.evaluate_interview()
        is_scoring_call = "database compiler" in system_content.lower()
        if is_scoring_call:
            # Extract skills list from prompt if available
            user_prompt = next((m["content"] for m in messages if m["role"] == "user"), "")
            skills = []
            if "skills:" in user_prompt.lower():
                part = user_prompt.lower().split("skills:", 1)[1].split("\n", 1)[0].strip()
                skills = [s.strip().title() for s in part.split(",") if s.strip()]
            if not skills:
                skills = ["Technical Proficiency"]

            # Calculate dynamic scores from actual user content
            all_user_text = " ".join(user_messages)
            word_count = len(all_user_text.split())
            
            # Dynamic grading: more articulate answers give higher specificity & depth
            computed_spec = min(92.0, max(45.0, 48.0 + (word_count * 0.7)))
            computed_depth = min(90.0, max(40.0, 44.0 + (word_count * 0.6)))
            computed_cons = min(94.0, max(50.0, 55.0 + (word_count * 0.5)))
            computed_overall = round((computed_spec + computed_depth + computed_cons) / 3.0, 1)

            simulated_items = []
            for sk in skills:
                simulated_items.append({
                    "skill_name": sk,
                    "specificity_score": round(computed_spec, 1),
                    "depth_score": round(computed_depth, 1),
                    "consistency_score": round(computed_cons, 1),
                    "overall_skill_score": computed_overall,
                    # A length-based guess must never certify anyone as verified
                    "verdict": "suspicious",
                    # Clearly label simulated output so it is never mistaken for a real AI evaluation
                    "llm_reasoning": (
                        f"[SIMULATED SCORE - AI evaluation unavailable; based only on answer length] "
                        f"{word_count} total words analysed for {sk}."
                    )
                })
            print(
                "[SkillProof AI] WARNING: Interview scored in SIMULATION mode (Groq unavailable). "
                "These scores are NOT a real AI evaluation."
            )

            simulated_strengths = [
                f"Conversational engagement with {skills[0]} interview questions",
                "Verbal responsiveness to technical inquiry prompts"
            ] if word_count > 10 else [
                "Connected to assessment environment",
                "Microphone audio captured successfully"
            ]

            simulated_improvements = [
                f"Provide more specific implementation and architecture details in {skills[0]}",
                "Explain concrete problem-solving steps and tool workflows"
            ] if word_count > 10 else [
                "Provide complete verbal answers to technical questions",
                "Elaborate on specific projects, technologies, and responsibilities"
            ]

            import json
            return json.dumps({
                "simulated": True,
                "scores": simulated_items,
                "strengths": simulated_strengths,
                "improvements": simulated_improvements
            })

        # General conversational simulation based on the conversation so far
        turn_count    = len(user_messages)
        assistant_msgs = [m["content"] for m in messages if m["role"] == "assistant"]
        q_count       = len(assistant_msgs)   # how many AI questions sent so far

        # Q3 — first AI follow-up after Q1 (intro) and Q2 (internship reflection)
        if q_count == 2:
            # Pull skill context from system_content for a contextual question
            skill_hint = "the skills you mentioned"
            for line in system_content.split("\n"):
                if "skills to verify" in line.lower():
                    skill_hint = line.split(":", 1)[-1].strip()
                    break
            return (
                f"That's a solid overview! Let's go deeper — "
                f"can you explain how you applied {skill_hint} in a real task or project "
                f"during your internship? Walk me through what you built or contributed to."
            )

        # Q4 — follow-up on their practical example
        if q_count == 3:
            last = user_messages[-1].lower() if user_messages else ""
            if any(kw in last for kw in ["built", "made", "developed", "created", "implemented"]):
                return (
                    "Interesting! What challenges did you face while building that, "
                    "and how did you resolve them?"
                )
            return (
                "Can you describe the biggest technical challenge you faced "
                "during the internship and how you overcame it?"
            )

        # Q5 — conceptual depth question
        if q_count == 4:
            return (
                "How would you explain the core concept behind the technology "
                "you used most during your internship to someone who is completely new to it?"
            )

        # Q6 — situational / improvement question
        if q_count == 5:
            return (
                "Looking back, what would you do differently if you were to redo "
                "a key project from your internship?"
            )

        # Q7 / Closing — interview complete
        return (
            "Thank you! That concludes your SkillProof interview. "
            "Your responses are now being evaluated."
        )

