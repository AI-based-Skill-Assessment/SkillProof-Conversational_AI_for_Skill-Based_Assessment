from app.controllers.ingest import router as ingest_router
from app.controllers.verify import router as verify_router
from app.controllers.interview import router as interview_router
from app.controllers.score import router as score_router

__all__ = [
    "ingest_router",
    "verify_router",
    "interview_router",
    "score_router"
]
