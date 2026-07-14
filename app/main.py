from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from app.config import settings
from app.database import init_redis, close_redis
from app.controllers.ingest import router as ingest_router
from app.controllers.verify import router as verify_router
from app.controllers.interview import router as interview_router
from app.controllers.score import router as score_router
from app.controllers.voice_interview import router as voice_router
from app.controllers.biometric import router as biometric_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    print(f"Starting {settings.APP_NAME} in environment: {settings.APP_ENV}")
    await init_redis()
    
    yield
    
    # Shutdown logic
    print("Shutting down resources...")
    await close_redis()


app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "Conversational AI system for certificate and skill verification.\n\n"
        "**Real-Time Interview**: Connect via WebSocket at `/api/v1/interview/{session_id}/ws` "
        "or use the terminal CLI: `python voice_cli.py --session <UUID>`"
    ),
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API controllers / routers
app.include_router(ingest_router, prefix="/api/v1", tags=["Ingest"])
app.include_router(verify_router, prefix="/api/v1", tags=["Verification"])
app.include_router(interview_router, prefix="/api/v1", tags=["Interview"])
app.include_router(score_router, prefix="/api/v1", tags=["Scores"])
app.include_router(voice_router, prefix="/api/v1", tags=["Voice Interview"])
app.include_router(biometric_router, prefix="/api/v1", tags=["Biometrics"])


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "environment": settings.APP_ENV
    }


# ── Serve biometric enrollment HTML page ──
_UI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

@app.get("/enroll", include_in_schema=False)
async def serve_enroll_page():
    """Serve the biometric enrollment UI page."""
    html_path = os.path.join(_UI_DIR, "biometric_enroll.html")
    return FileResponse(html_path, media_type="text/html")


@app.get("/interview-room", include_in_schema=False)
async def serve_interview_room():
    """Serve the live camera+mic interview room UI page."""
    html_path = os.path.join(_UI_DIR, "interview_room.html")
    return FileResponse(html_path, media_type="text/html")

