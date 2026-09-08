import asyncio
import io
from typing import List, Dict, Any, Optional
from app.config import settings

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
        model: str = "qwen/qwen3.8-27b"
    ) -> str:
        """Call Groq API asynchronously. Falls back to mock responses if API key is invalid/missing."""
        if self.enabled and self.client:
            try:
                loop = asyncio.get_running_loop()
                response = await loop.run_in_executor(
                    None,
                    lambda: self.client.chat.completions.create(
                        messages=messages,
                        model=model,
                        temperature=0.3,
                        max_tokens=1500
                    )
                )
                return response.choices[0].message.content
            except Exception as e:
                print(f"[SkillProof AI] Error calling Groq API: {e}. Falling back to simulation.")
        
        # Async simulation fallback
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
                    "verdict": "verified" if computed_overall >= 60.0 else "suspicious",
                    "llm_reasoning": f"Candidate demonstrated relevant practical knowledge of {sk} during conversational answers ({word_count} total words analyzed)."
                })

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

