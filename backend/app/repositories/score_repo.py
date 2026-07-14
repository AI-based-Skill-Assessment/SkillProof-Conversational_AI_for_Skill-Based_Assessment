from typing import List, Optional
from uuid import UUID
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.score import SkillScoreResult, SkillVerdict
from app.schemas.score import SkillScoreCreate


async def get_scores_by_session(db: AsyncSession, session_id: UUID) -> List[SkillScoreResult]:
    """Retrieve all skill score results for a given session."""
    stmt = select(SkillScoreResult).where(SkillScoreResult.session_id == session_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create_skill_score(db: AsyncSession, score_in: SkillScoreCreate) -> SkillScoreResult:
    """Create a single skill score record."""
    verdict_map = {
        "verified": SkillVerdict.verified,
        "suspicious": SkillVerdict.suspicious,
        "likely_fraudulent": SkillVerdict.likely_fraudulent
    }
    
    score = SkillScoreResult(
        session_id=score_in.session_id,
        specificity_score=score_in.specificity_score,
        depth_score=score_in.depth_score,
        consistency_score=score_in.consistency_score,
        overall_skill_score=score_in.overall_skill_score,
        verdict=verdict_map.get(score_in.verdict, SkillVerdict.verified) if score_in.verdict else None,
        llm_reasoning=score_in.llm_reasoning
    )
    db.add(score)
    await db.flush()
    await db.refresh(score)
    return score


async def delete_scores_by_session(db: AsyncSession, session_id: UUID) -> None:
    """Delete all score results for a session (usually for re-evaluation)."""
    stmt = delete(SkillScoreResult).where(SkillScoreResult.session_id == session_id)
    await db.execute(stmt)
    await db.flush()


async def bulk_create_scores(
    db: AsyncSession, 
    scores_in: List[SkillScoreCreate]
) -> List[SkillScoreResult]:
    """Save multiple skill scores at once."""
    results = []
    verdict_map = {
        "verified": SkillVerdict.verified,
        "suspicious": SkillVerdict.suspicious,
        "likely_fraudulent": SkillVerdict.likely_fraudulent
    }
    
    for s_in in scores_in:
        score = SkillScoreResult(
            session_id=s_in.session_id,
            specificity_score=s_in.specificity_score,
            depth_score=s_in.depth_score,
            consistency_score=s_in.consistency_score,
            overall_skill_score=s_in.overall_skill_score,
            verdict=verdict_map.get(s_in.verdict, SkillVerdict.verified) if s_in.verdict else None,
            llm_reasoning=s_in.llm_reasoning
        )
        db.add(score)
        results.append(score)
    await db.flush()
    # Refresh all objects
    for res in results:
        await db.refresh(res)
    return results
