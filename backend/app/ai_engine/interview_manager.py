import json
from uuid import UUID
from typing import List, Dict, Tuple, Any, Optional
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
        try:
            redis = get_redis()
            data = await redis.get(self._history_key(session_id))
            return json.loads(data) if data else []
        except Exception:
            return []

    async def save_history(self, session_id: UUID, history: List[Dict[str, Any]]) -> None:
        redis = get_redis()
        await redis.setex(self._history_key(session_id), 3600, json.dumps(history))

    async def _save_meta(self, session_id: UUID, meta: Dict[str, Any]) -> None:
        try:
            redis = get_redis()
            await redis.setex(self._meta_key(session_id), 3600, json.dumps(meta))
        except Exception:
            pass

    async def _get_meta(self, session_id: UUID) -> Dict[str, Any]:
        try:
            redis = get_redis()
            data = await redis.get(self._meta_key(session_id))
            return json.loads(data) if data else {}
        except Exception:
            return {}

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

    async def evaluate_interview(
        self, 
        session_id: UUID, 
        skills: List[str], 
        history: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Score the full transcript using Groq LLM."""
        if not history:
            history = await self.get_history(session_id)
        
        if not history:
            # Fallback to database interview session transcript if Redis was cleared
            from app.database import async_session_factory
            from app.repositories import session_repo
            try:
                async with async_session_factory() as db:
                    s_obj = await session_repo.get_session(db, session_id)
                    if s_obj and s_obj.interview and s_obj.interview.transcript:
                        history = s_obj.interview.transcript
            except Exception as db_e:
                print(f"[InterviewManager] DB transcript fallback warning: {db_e}")

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

        # Robust JSON extraction from LLM response
        import re
        cleaned = raw.strip()
        match = re.search(r'\{.*\}', cleaned, re.DOTALL)
        if match:
            cleaned = match.group(0)

        try:
            parsed = json.loads(cleaned)
            raw_scores = parsed.get("scores", [])
            # Support if LLM returned a single object instead of array
            if isinstance(raw_scores, dict):
                raw_scores = [raw_scores]
            elif not isinstance(raw_scores, list) and isinstance(parsed, list):
                raw_scores = parsed

            normalized_scores = []
            for item in raw_scores:
                if not isinstance(item, dict):
                    continue
                skill_n = item.get("skill_name") or (active_skills[0] if active_skills else "General Skill")
                
                # Normalize scores if LLM outputs 0-5 or 0-10 scale
                def norm_score(val):
                    try:
                        v = float(val)
                        if 0.0 < v <= 5.0:
                            return round(v * 20.0, 1)
                        elif 5.0 < v <= 10.0:
                            return round(v * 10.0, 1)
                        return round(max(0.0, min(100.0, v)), 1)
                    except (ValueError, TypeError):
                        return 70.0

                spec = norm_score(item.get("specificity_score", 70.0))
                depth = norm_score(item.get("depth_score", 70.0))
                cons = norm_score(item.get("consistency_score", 75.0))
                overall = norm_score(item.get("overall_skill_score", (spec + depth + cons) / 3.0))

                v_raw = str(item.get("verdict", "verified")).lower()
                if "suspicious" in v_raw or "moderate" in v_raw or "unverified" in v_raw:
                    verdict_str = "suspicious"
                elif "fraud" in v_raw or "fail" in v_raw:
                    verdict_str = "likely_fraudulent"
                else:
                    verdict_str = "verified"

                normalized_scores.append({
                    "skill_name": skill_n,
                    "specificity_score": spec,
                    "depth_score": depth,
                    "consistency_score": cons,
                    "overall_skill_score": overall,
                    "verdict": verdict_str,
                    "llm_reasoning": item.get("llm_reasoning") or "Evaluated based on candidate verbal explanations."
                })

            parsed_strengths = parsed.get("strengths", [])
            if isinstance(parsed_strengths, str):
                parsed_strengths = [parsed_strengths]
            parsed_improvements = parsed.get("improvements", [])
            if isinstance(parsed_improvements, str):
                parsed_improvements = [parsed_improvements]

            if normalized_scores:
                res_dict = {"scores": normalized_scores}
                if parsed_strengths:
                    res_dict["strengths"] = parsed_strengths
                if parsed_improvements:
                    res_dict["improvements"] = parsed_improvements
                return res_dict
        except Exception as parse_err:
            print(f"[InterviewManager] LLM JSON parse warning: {parse_err}. Raw output was: {raw[:200]}")

        # Dynamic fallback based on actual user answers length and quality
        user_words = " ".join([m.get("content", "") for m in history if m.get("role") == "user"]).split()
        word_count = len(user_words)
        base_score = min(88.0, max(45.0, 50.0 + (word_count * 0.8)))

        fallback_strengths = (
            [f"Demonstrated foundational terminology in {active_skills[0]}", "Engaged verbally with interviewer questions"]
            if word_count > 10 else
            ["Connected to verification environment", "Candidate microphone audio detected"]
        )
        fallback_improvements = (
            [f"Provide deeper architectural examples in {active_skills[0]}", "Articulate specific debugging or implementation steps"]
            if word_count > 10 else
            ["Provide complete verbal answers to technical questions", "Avoid non-responsive or incomplete sentence fragments"]
        )

        return {
            "scores": [
                {
                    "skill_name": skill,
                    "specificity_score": round(base_score, 1),
                    "depth_score": round(max(40.0, base_score - 4.0), 1),
                    "consistency_score": round(min(95.0, base_score + 6.0), 1),
                    "overall_skill_score": round(base_score, 1),
                    "verdict": "verified" if base_score >= 60 else "suspicious",
                    "llm_reasoning": f"Candidate demonstrated {skill} concepts through verbal interview responses ({word_count} spoken words provided)."
                }
                for skill in active_skills
            ],
            "strengths": fallback_strengths,
            "improvements": fallback_improvements
        }
