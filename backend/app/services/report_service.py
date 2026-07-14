from uuid import UUID
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import session_repo, score_repo, document_repo

class ReportService:
    def __init__(self) -> None:
        pass

    async def generate_verdict(self, db: AsyncSession, session_id: UUID) -> Dict[str, Any]:
        """
        Aggregate certificate validation data and candidate interview scores
        to formulate a final skill verification verdict report.
        """
        session = await session_repo.get_session(db, session_id)
        if not session:
            return {"error": "Verification session not found"}

        document = await document_repo.get_document_by_session(db, session_id)
        scores = await score_repo.get_scores_by_session(db, session_id)

        # Base document validation assessment
        doc_valid = (document.fetch_status.name == "verified") if (document and document.fetch_status) else False
        doc_score = document.document_score if document else 0.0

        # Core math calculations
        avg_score = 0.0
        min_score = 100.0
        scores_list = []

        if scores:
            total = 0.0
            for s in scores:
                overall = s.overall_skill_score or 0.0
                total += overall
                if overall < min_score:
                    min_score = overall
                scores_list.append({
                    "skill_name": s.session.extracted_skills[0] if (s.session and s.session.extracted_skills) else "Skill", # Or query skill from context
                    "specificity_score": s.specificity_score,
                    "depth_score": s.depth_score,
                    "consistency_score": s.consistency_score,
                    "overall_skill_score": overall,
                    "verdict": s.verdict.name if s.verdict else None,
                    "llm_reasoning": s.llm_reasoning
                })
            avg_score = round(total / len(scores), 2)
        else:
            min_score = 0.0

        # Overall verdict logic
        if not doc_valid and session.intake_mode.name == "certificate":
            verdict = "FAILED_DOCUMENT_VERIFICATION"
            explanation = "The uploaded certificate verification URL could not be resolved or was classified as untrusted."
        elif not scores:
            verdict = "PENDING_INTERVIEW"
            explanation = "Document is verified (or skipped), but candidate has not yet completed the technical interview."
        elif avg_score >= 75.0:
            verdict = "FULLY_VERIFIED"
            explanation = "Candidate demonstrated strong, competent technical skill proficiency during the interview drills."
        elif avg_score >= 50.0:
            verdict = "PARTIALLY_VERIFIED"
            explanation = "Candidate showed uneven technical familiarity during interview drills."
        else:
            verdict = "FAILED_SKILL_VERIFICATION"
            explanation = "Candidate failed to answer fundamental technical questions correctly."

        # Compile JSON scorecard
        report = {
            "session_id": session_id,
            "candidate_name": session.candidate_name,
            "candidate_email": session.candidate_email,
            "intake_mode": session.intake_mode.name,
            "session_status": session.status.name,
            "verdict": verdict,
            "explanation": explanation,
            "metrics": {
                "document_verified": doc_valid,
                "document_score": doc_score,
                "average_skill_score": avg_score,
                "minimum_skill_score": min_score,
                "skills_assessed_count": len(scores)
            },
            "detailed_scores": scores_list
        }

        return report
