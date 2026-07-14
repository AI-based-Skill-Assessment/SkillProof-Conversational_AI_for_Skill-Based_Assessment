import asyncio
from typing import List, Dict, Any
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
        model: str = "llama-3.1-8b-instant"
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

    def _generate_simulated_response(self, messages: List[Dict[str, str]]) -> str:
        """Heuristic responses to mock interviews when Groq is not active."""
        system_content = next((m["content"] for m in messages if m["role"] == "system"), "")
        user_messages = [m["content"] for m in messages if m["role"] == "user"]
        
        # Detect scoring context by the specific system role marker set in interview_manager.evaluate_interview()
        # The scoring call uses "You are a database compiler" as the system message — never used in interviews.
        is_scoring_call = "database compiler" in system_content.lower()
        if is_scoring_call:
            return """{
  "scores": [
    {
      "skill_name": "Python",
      "specificity_score": 80.0,
      "depth_score": 85.0,
      "consistency_score": 90.0,
      "overall_skill_score": 85.0,
      "verdict": "verified",
      "llm_reasoning": "Demonstrated core command over async programming, generators, and packaging."
    },
    {
      "skill_name": "FastAPI",
      "specificity_score": 85.0,
      "depth_score": 90.0,
      "consistency_score": 85.0,
      "overall_skill_score": 86.6,
      "verdict": "verified",
      "llm_reasoning": "Excellent understanding of lifespan events, dependency injection, and Pydantic models."
    },
    {
      "skill_name": "PostgreSQL",
      "specificity_score": 70.0,
      "depth_score": 75.0,
      "consistency_score": 70.0,
      "overall_skill_score": 71.6,
      "verdict": "verified",
      "llm_reasoning": "Capable of async SQLAlchemy usage, but lacks deep query optimization insights."
    }
  ]
}"""

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

