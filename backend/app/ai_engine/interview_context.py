from typing import List, Dict


class InterviewContextBuilder:

    # ------------------------------------------------------------------ #
    # INTERVIEW SYSTEM PROMPT                                              #
    # ------------------------------------------------------------------ #
    @staticmethod
    def build_system_prompt(
        candidate_name: str,
        skills: List[str],
        role: str,
        company: str
    ) -> str:
        """
        Builds the strict, structured system prompt that drives the Groq AI
        interviewer. Q1 and Q2 are sent as hardcoded messages before the AI
        takes over for Q3-Q7, so this prompt only governs the dynamic follow-up
        questions (Q3 onward).
        """
        skills_str = ", ".join(skills) if skills else "software development"
        role_str   = role    or "Software Development"
        company_str = company or "the organisation"

        return (
            f"You are SkillProof AI, a professional technical interviewer verifying "
            f"internship skills through conversational assessment.\n\n"
            f"**Candidate**: {candidate_name}\n"
            f"**Internship Role**: {role_str} at {company_str}\n"
            f"**Skills to verify**: {skills_str}\n\n"
            f"**Your Role**:\n"
            f"The interview has already started. The candidate has introduced "
            f"themselves (Q1) and described their internship learnings (Q2). "
            f"You must now ask 3 to 5 targeted follow-up questions (Q3 to Q7 maximum) "
            f"that probe deeper into the stated skills.\n\n"
            f"**Strict Rules**:\n"
            f"1. Ask EXACTLY ONE question per response — never combine questions.\n"
            f"2. Each question must directly relate to {skills_str}. "
            f"   Go from conceptual → practical → situational depth.\n"
            f"3. Base follow-up questions on what the candidate actually said in "
            f"   their previous answers — do not ask generic textbook questions.\n"
            f"4. Keep each question under 2 sentences.\n"
            f"5. After asking between 3 and 5 follow-up questions (i.e. total "
            f"   interview turns reach 5 to 7), end the interview by responding "
            f"   exactly with:\n"
            f"   \"Thank you! That concludes your SkillProof interview. "
            f"   Your responses are now being evaluated.\"\n"
            f"6. Do NOT repeat questions. Do NOT reveal scoring criteria."
        )

    # ------------------------------------------------------------------ #
    # SCORING PROMPT                                                       #
    # ------------------------------------------------------------------ #
    @staticmethod
    def build_scoring_prompt(chat_history: List[Dict[str, str]], skills: List[str]) -> str:
        """Constructs the prompt that instructs the AI to score the interview transcript."""
        transcript = ""
        for turn in chat_history:
            speaker = "AI" if turn["role"] == "assistant" else "Candidate"
            transcript += f"{speaker}: {turn['content']}\n"

        skills_str = ", ".join(skills) if skills else "General Software Development"

        return (
            f"Analyze the technical interview transcript below and score the "
            f"candidate's mastery on the evaluated skills: {skills_str}.\n\n"
            f"**Transcript**:\n{transcript}\n\n"
            f"**Scoring Requirements**:\n"
            f"1. Assign the following scores (0.0 to 100.0 scale) for each skill:\n"
            f"   - specificity_score: How specific/detailed the answers were\n"
            f"   - depth_score: Technical depth demonstrated\n"
            f"   - consistency_score: Consistency across multiple answers\n"
            f"   - overall_skill_score: Weighted average of the above\n"
            f"2. Assign a verdict: \"verified\", \"suspicious\", or \"likely_fraudulent\"\n"
            f"3. Provide a clear explanation in llm_reasoning.\n"
            f"4. Return ONLY a valid JSON object. No markdown, no extra text.\n\n"
            f"**JSON Schema**:\n"
            f"{{\n"
            f"  \"scores\": [\n"
            f"    {{\n"
            f"      \"skill_name\": \"Skill Name\",\n"
            f"      \"specificity_score\": 85.0,\n"
            f"      \"depth_score\": 80.0,\n"
            f"      \"consistency_score\": 90.0,\n"
            f"      \"overall_skill_score\": 85.0,\n"
            f"      \"verdict\": \"verified\",\n"
            f"      \"llm_reasoning\": \"Explanation here.\"\n"
            f"    }}\n"
            f"  ]\n"
            f"}}\n"
        )
