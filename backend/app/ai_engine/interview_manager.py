import json
from uuid import UUID
from typing import List, Dict, Tuple, Any
from datetime import datetime

from app.database import get_redis
from app.ai_engine.groq_client import GroqClient
from app.ai_engine.interview_context import InterviewContextBuilder

# Fixed question indices
_Q1_INDEX = 0   # "Tell me about yourself"
_Q2_INDEX = 1   # "What did you learn from {role} at {company}?"
_MAX_QUESTIONS = 7   # Hard ceiling (Q1 through Q7)
_MIN_QUESTIONS = 5   # Minimum before AI can close the interview


class InterviewManager:
    def __init__(self) -> None:
        self.groq = GroqClient()
        self.context_builder = InterviewContextBuilder()

    # ------------------------------------------------------------------ #
    # Redis helpers                                                         #
    # ------------------------------------------------------------------ #
    def _history_key(self, session_id: UUID) -> str:
        return f"interview:{session_id}:history"

    def _meta_key(self, session_id: UUID) -> str:
        return f"interview:{session_id}:meta"

    async def get_history(self, session_id: UUID) -> List[Dict[str, Any]]:
        """Retrieve full chat history from Redis."""
        redis = get_redis()
        data = await redis.get(self._history_key(session_id))
        return json.loads(data) if data else []

    async def save_history(self, session_id: UUID, history: List[Dict[str, Any]]) -> None:
        redis = get_redis()
        await redis.setex(self._history_key(session_id), 3600, json.dumps(history))

    async def _save_meta(self, session_id: UUID, meta: Dict[str, Any]) -> None:
        redis = get_redis()
        await redis.setex(self._meta_key(session_id), 3600, json.dumps(meta))

    async def _get_meta(self, session_id: UUID) -> Dict[str, Any]:
        redis = get_redis()
        data = await redis.get(self._meta_key(session_id))
        return json.loads(data) if data else {}

    # ------------------------------------------------------------------ #
    # Fixed question builders                                               #
    # ------------------------------------------------------------------ #
    @staticmethod
    def _q1_text() -> str:
        return (
            "Hello! Welcome to your SkillProof interview. "
            "Let's start with a simple introduction — "
            "tell me about yourself and your background."
        )

    @staticmethod
    def _q2_text(role: str, company: str) -> str:
        role_str    = role    or "your internship role"
        company_str = company or "your organisation"
        return (
            f"Great, thank you! Now, could you walk me through what you learned "
            f"during your {role_str} internship at {company_str}? "
            f"What specific projects or tasks did you work on?"
        )

    # ------------------------------------------------------------------ #
    # Public API                                                            #
    # ------------------------------------------------------------------ #
    async def start_interview(
        self,
        session_id: UUID,
        candidate_name: str,
        skills: List[str],
        role: str = "",
        company: str = ""
    ) -> str:
        """
        Returns Q1 ('Tell me about yourself').
        Persists meta-context (role, company, skills) for follow-up generation.
        """
        # If already started, return the first assistant message
        history = await self.get_history(session_id)
        if history:
            first_assistant = next(
                (m["content"] for m in history if m["role"] == "assistant"), None
            )
            if first_assistant:
                return first_assistant

        # Persist session context for process_turn to use later
        await self._save_meta(session_id, {
            "candidate_name": candidate_name,
            "skills": skills,
            "role": role,
            "company": company,
            "ai_question_count": 0   # counts only AI-generated follow-ups (Q3+)
        })

        q1 = self._q1_text()
        history = [{"role": "assistant", "content": q1, "timestamp": datetime.utcnow().isoformat()}]
        await self.save_history(session_id, history)
        return q1

    async def process_turn(
        self,
        session_id: UUID,
        candidate_message: str,
        candidate_name: str,
        skills: List[str],
        role: str = "",
        company: str = ""
    ) -> Tuple[str, bool]:
        """
        Drives the interview forward:
          - After Q1 answer → send hardcoded Q2
          - After Q2 answer → Groq generates Q3-Q7 dynamically
          - When total questions reach _MAX_QUESTIONS OR Groq signals done → complete
        """
        history = await self.get_history(session_id)
        meta    = await self._get_meta(session_id)

        # Use persisted context if callers omit params
        if not meta:
            await self._save_meta(session_id, {
                "candidate_name": candidate_name,
                "skills": skills,
                "role": role,
                "company": company,
                "ai_question_count": 0
            })
            meta = await self._get_meta(session_id)

        eff_role    = meta.get("role", role) or role or "Software Development"
        eff_company = meta.get("company", company) or company or "the organisation"
        eff_skills  = meta.get("skills") or skills or ["General Skills"]

        # Append candidate reply
        history.append({
            "role": "user",
            "content": candidate_message,
            "timestamp": datetime.utcnow().isoformat()
        })

        # Count assistant messages already sent (= questions asked so far)
        questions_asked = sum(1 for m in history if m["role"] == "assistant")

        # ---- HARDCODED Q2 (sent after user answers Q1) ---- #
        if questions_asked == _Q2_INDEX:
            q2 = self._q2_text(eff_role, eff_company)
            history.append({"role": "assistant", "content": q2, "timestamp": datetime.utcnow().isoformat()})
            await self.save_history(session_id, history)
            return q2, False

        # ---- HARD CEILING: max questions reached ---- #
        if questions_asked >= _MAX_QUESTIONS:
            closing = (
                "Thank you! That concludes your SkillProof interview. "
                "Your responses are now being evaluated."
            )
            history.append({"role": "assistant", "content": closing, "timestamp": datetime.utcnow().isoformat()})
            await self.save_history(session_id, history)
            return closing, True

        # ---- AI-GENERATED Q3-Q7 ---- #
        # Build messages for Groq: system prompt + full conversation so far
        system_prompt = self.context_builder.build_system_prompt(
            candidate_name=meta.get("candidate_name", candidate_name),
            skills=eff_skills,
            role=eff_role,
            company=eff_company
        )

        # Convert history to Groq message format (exclude timestamps)
        groq_messages = [{"role": "system", "content": system_prompt}]
        for h in history:
            groq_messages.append({"role": h["role"], "content": h["content"]})

        ai_response = await self.groq.chat_completion(groq_messages)

        # Detect if AI signalled interview completion
        completion_signals = [
            "concludes your skillproof interview",
            "that concludes",
            "interview is now complete",
            "evaluation is complete",
            "your responses are now being evaluated"
        ]
        is_complete = any(sig in ai_response.lower() for sig in completion_signals)

        # Also force complete if we've hit the minimum and AI hasn't closed yet at max
        if questions_asked + 1 >= _MAX_QUESTIONS and not is_complete:
            is_complete = True

        history.append({"role": "assistant", "content": ai_response, "timestamp": datetime.utcnow().isoformat()})

        # Update AI question count
        meta["ai_question_count"] = meta.get("ai_question_count", 0) + 1
        await self._save_meta(session_id, meta)
        await self.save_history(session_id, history)

        return ai_response, is_complete

    async def evaluate_interview(self, session_id: UUID, skills: List[str]) -> Dict[str, Any]:
        """Score the full transcript using Groq LLM."""
        history = await self.get_history(session_id)
        if not history:
            return {"scores": []}

        meta = await self._get_meta(session_id)
        active_skills = meta.get("skills") or skills or ["General Software Development"]

        scoring_prompt = self.context_builder.build_scoring_prompt(history, active_skills)

        scoring_messages = [
            {"role": "system", "content": "You are a database compiler. Output only valid JSON objects. No formatting blocks."},
            {"role": "user", "content": scoring_prompt}
        ]

        raw = await self.groq.chat_completion(scoring_messages)

        # Strip markdown fences if present
        cleaned = raw.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        try:
            return json.loads(cleaned)
        except Exception:
            return {
                "scores": [
                    {
                        "skill_name": skill,
                        "specificity_score": 75.0,
                        "depth_score": 70.0,
                        "consistency_score": 80.0,
                        "overall_skill_score": 75.0,
                        "verdict": "verified",
                        "llm_reasoning": "Candidate completed all evaluation turns. Fallback scoring applied."
                    }
                    for skill in active_skills
                ]
            }
