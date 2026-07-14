from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database import get_db
from app.services.report_service import ReportService

router = APIRouter()
report_service = ReportService()

@router.get("/score/{session_id}")
async def get_session_scorecard(
    session_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve compiled internship skill verification report, including overall verdict, 
    parsed metrics, and turn-based AI interview evaluation comments.
    """
    report = await report_service.generate_verdict(db, session_id)
    if "error" in report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=report["error"]
        )
    return report
