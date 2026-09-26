from uuid import UUID
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import session_repo, score_repo, document_repo, biometric_repo
from app.services.credential_service import CredentialService

class ReportService:
    def __init__(self) -> None:
        self.credential_service = CredentialService()

    async def generate_verdict(self, db: AsyncSession, session_id: UUID) -> Dict[str, Any]:
        """
        Aggregate certificate validation data, biometric audit telemetry, and candidate interview scores
        to formulate a final skill verification verdict report.
        """
        session = await session_repo.get_session(db, session_id)
        if not session:
            return {"error": "Verification session not found"}

        document = await document_repo.get_document_by_session(db, session_id)
        scores = await score_repo.get_scores_by_session(db, session_id)
        profile = await biometric_repo.get_profile(db, session_id)

        # Base document validation assessment
        doc_valid = (document.fetch_status.name == "verified") if (document and document.fetch_status) else False
        doc_score = document.document_score if document else 0.0

        # Core math calculations
        avg_score = 0.0
        min_score = 100.0
        scores_list = []

        if scores:
            total = 0.0
            extracted_skills_list = (session.extracted_skills if session and session.extracted_skills else [])
            for idx, s in enumerate(scores):
                overall = s.overall_skill_score or 0.0
                total += overall
                if overall < min_score:
                    min_score = overall
                
                skill_label = extracted_skills_list[idx] if idx < len(extracted_skills_list) else (extracted_skills_list[0] if extracted_skills_list else "Skill")
                scores_list.append({
                    "skill_name": skill_label,
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
        user_turns_count = 0
        if session.interview and session.interview.transcript:
            user_turns_count = sum(1 for m in session.interview.transcript if m.get("role") == "user" and m.get("content", "").strip())

        if user_turns_count == 0 or avg_score == 0.0:
            verdict = "UNVERIFIED_EARLY_EXIT"
            explanation = "Assessment concluded early by candidate without submitting answers to technical questions."
        elif not doc_valid and session.intake_mode.name == "certificate":
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

        # Dynamic strengths and growth areas based on real performance
        strengths = []
        improvements = []
        
        # Check if AI evaluation generated dynamic strengths & improvements
        ctx = session.interview.skill_context if session.interview else None
        if isinstance(ctx, dict):
            if ctx.get("strengths"):
                strengths = list(ctx.get("strengths"))
            if ctx.get("improvements"):
                improvements = list(ctx.get("improvements"))

        if not strengths or not improvements:
            if user_turns_count == 0 or avg_score == 0.0:
                strengths = strengths or ["Certificate ingested successfully"]
                improvements = improvements or ["Complete the AI technical interview to verify domain skills"]
            else:
                domain = (session.extracted_skills[0] if session.extracted_skills else "Engineering")
                strengths = strengths or [
                    f"Understanding of core {domain} fundamentals",
                    "Conversational response engagement during interview drills"
                ]
                improvements = improvements or [
                    f"Provide deeper implementation examples in {domain}",
                    "Articulate complete technical problem-solving workflows"
                ]

        # Biometric & Proctoring Integrity Summary
        integrity_score = getattr(profile, 'integrity_score', 100.0) if profile else 100.0
        biometric_audit = {
            "face_verified": bool(profile and profile.face_registered and (profile.face_mismatch_count or 0) <= 2),
            "voice_verified": bool(profile and profile.voice_registered and (profile.voice_mismatch_count or 0) <= 2),
            "integrity_score": integrity_score,
            "fraud_status": getattr(profile, 'fraud_status', 'clean') if profile else 'clean',
            "interview_flagged": getattr(profile, 'interview_flagged', False) if profile else False,
            "tab_switch_count": getattr(profile, 'tab_switch_count', 0) if profile else 0,
            "window_blur_count": getattr(profile, 'window_blur_count', 0) if profile else 0,
            "copy_paste_attempts": getattr(profile, 'copy_paste_attempts', 0) if profile else 0,
            "secondary_speaker_count": getattr(profile, 'secondary_speaker_count', 0) if profile else 0,
            "gaze_violations": profile.gaze_violations if profile else 0,
            "camera_interruptions": profile.camera_interruptions if profile else 0,
            "proctoring_timeline": getattr(profile, 'proctoring_timeline', []) or [],
        }

        # Verifiable Credential Payload
        verifiable_credential = await self.credential_service.issue_verifiable_credential(db, session_id)

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
                "skills_assessed_count": len(scores),
                "questions_answered_count": user_turns_count,
                "proctoring_integrity_score": integrity_score
            },
            "biometric_audit": biometric_audit,
            "verifiable_credential": verifiable_credential,
            "strengths": strengths,
            "improvements": improvements,
            "detailed_scores": scores_list,
            "transcript": session.interview.transcript if session.interview else []
        }

        return report

