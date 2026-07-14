import json
from uuid import UUID
from typing import List, Dict, Tuple, Any

from app.database import get_redis
from app.core.skills_vocab import extract_skills_from_text, normalize_skill
from app.core.skills_questions import (
    INTRO_QUESTION,
    SKILL_CLARIFICATION_QUESTION,
    get_questions_for_skill,
)


class RuleBasedInterviewer:
    """
    Manages stateful, rule-based technical interviews for Phase 1.
    Maintains progress using Redis.
    Supports a dynamic introduction flow if the certificate was sparse (no initial skills).
    """

    def _get_state_key(self, session_id: UUID) -> str:
        return f"rbi:{session_id}:state"

    async def get_state(self, session_id: UUID) -> Dict[str, Any] | None:
        redis = get_redis()
        key = self._get_state_key(session_id)
        data = await redis.get(key)
        if data:
            return json.loads(data)
        return None

    async def save_state(self, session_id: UUID, state: Dict[str, Any]) -> None:
        redis = get_redis()
        key = self._get_state_key(session_id)
        await redis.setex(key, 3600, json.dumps(state))

    async def initialize_interview(
        self, session_id: UUID, skills: List[str]
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Set up the interview session state.
        If skills are provided, we start asking questions for the first skill.
        If no skills are provided (sparse certificate), we ask the intro question first.
        """
        # Clean skills list
        clean_skills = [s for s in skills if s]
        
        # If no skills are found, we trigger sparse mode
        sparse_mode = len(clean_skills) == 0
        
        if sparse_mode:
            # Sparse mode: starting question is the intro question
            opening_question = INTRO_QUESTION
            state = {
                "sparse_mode": True,
                "intro_answered": False,
                "target_skills": [],
                "current_skill": None,
                "question_bank": [],
                "current_question_index": 0,
                "total_questions_to_ask": 5, # Will ask 5 skill questions after intro
                "current_question": INTRO_QUESTION
            }
        else:
            # Normal mode: choose the first skill as primary
            primary_skill = clean_skills[0]
            questions = get_questions_for_skill(primary_skill)
            opening_question = questions[0]
            
            state = {
                "sparse_mode": False,
                "intro_answered": True,
                "target_skills": clean_skills,
                "current_skill": primary_skill,
                "question_bank": questions,
                "current_question_index": 0,
                "total_questions_to_ask": len(questions),
                "current_question": opening_question
            }
            
        await self.save_state(session_id, state)
        return opening_question, state

    async def process_user_response(
        self, session_id: UUID, user_response: str
    ) -> Tuple[str, bool, Dict[str, Any]]:
        """
        Process the candidate's answer, update the index, and get the next question.
        Returns:
            next_question (str): The next question to ask, or closing statement.
            is_complete (bool): True if the interview has finished.
            state (dict): The updated state.
        """
        state = await self.get_state(session_id)
        if not state:
            # Fallback if state is missing
            opening_question, state = await self.initialize_interview(session_id, [])
            return opening_question, False, state

        # Case 1: Sparse mode and intro is NOT yet answered
        if state["sparse_mode"] and not state["intro_answered"]:
            # Parse the user response to find technical skills
            found_skills = extract_skills_from_text(user_response)
            
            if not found_skills:
                # If they didn't specify any known skills, ask clarification question
                next_question = SKILL_CLARIFICATION_QUESTION
                state["current_question"] = next_question
                # We stay in intro_answered=False so we keep trying to get a skill
                await self.save_state(session_id, state)
                return next_question, False, state
            
            # Found one or more skills! Move to standard rule-based phase for the first skill
            primary_skill = found_skills[0]
            questions = get_questions_for_skill(primary_skill)
            
            state["intro_answered"] = True
            state["target_skills"] = found_skills
            state["current_skill"] = primary_skill
            state["question_bank"] = questions
            state["current_question_index"] = 0
            state["total_questions_to_ask"] = len(questions)
            
            next_question = questions[0]
            state["current_question"] = next_question
            
            await self.save_state(session_id, state)
            return next_question, False, state

        # Case 2: Standard question progression
        current_idx = state["current_question_index"]
        question_bank = state["question_bank"]
        
        # Advance index
        next_idx = current_idx + 1
        state["current_question_index"] = next_idx
        
        # Check if we have asked all questions in the bank
        if next_idx >= len(question_bank):
            # No more questions in this skill bank.
            # If there are other target skills that we haven't asked questions for, we can switch,
            # but per spec: "there should be 5 predefined questions ... React question alone for phase 1".
            # So once we finish the 5 questions, the interview is completed.
            is_complete = True
            closing_text = (
                "Thank you! That completes our technical evaluation. "
                "I will now compute your score summary. Please stand by."
            )
            state["current_question"] = closing_text
            await self.save_state(session_id, state)
            return closing_text, True, state
        
        # Get next question from the current skill's question bank
        next_question = question_bank[next_idx]
        state["current_question"] = next_question
        
        await self.save_state(session_id, state)
        return next_question, False, state
