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
from app.controllers.auth import router as auth_router
from app.controllers.admin_mgmt import router as admin_mgmt_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────────────
    print(f"Starting {settings.APP_NAME} in environment: {settings.APP_ENV}")
    await init_redis()

    # Seed default admin account (no-op if already exists)
    try:
        from app.database import async_session_factory
        from app.repositories.admin_repo import ensure_default_admin
        async with async_session_factory() as db:
            await ensure_default_admin(db)
            await db.commit()
        print(f"[Auth] Admin account ready: {settings.ADMIN_EMAIL}")
    except Exception as e:
        print(f"[Auth] Admin seed skipped (tables may not exist yet): {e}")

    yield

    # ── Shutdown ─────────────────────────────────────────────────────────────
    print("Shutting down resources...")
    await close_redis()


app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "SkillProof — Conversational AI for Skill-Based Assessment.\n\n"
        "**Real-Time Interview**: Connect via WebSocket at `/api/v1/interview/{session_id}/ws`\n\n"
        "**Auth**: Use `/api/v1/auth/user/login`, `/api/v1/auth/org/login`, or `/api/v1/auth/admin/login`"
    ),
    version="2.0.0",
    lifespan=lifespan
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Restrict in production to frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API Routers ───────────────────────────────────────────────────────────────
# Auth
app.include_router(auth_router,       prefix="/api/v1", tags=["Authentication"])
app.include_router(admin_mgmt_router, prefix="/api/v1", tags=["Admin Management"])

# Assessment pipeline (existing)
app.include_router(ingest_router,     prefix="/api/v1", tags=["Ingest"])
app.include_router(verify_router,     prefix="/api/v1", tags=["Verification"])
app.include_router(voice_router,      prefix="/api/v1", tags=["Voice Interview"])
app.include_router(interview_router,  prefix="/api/v1", tags=["Interview"])
app.include_router(score_router,      prefix="/api/v1", tags=["Scores"])
app.include_router(biometric_router,  prefix="/api/v1", tags=["Biometrics"])


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "version": "2.0.0",
        "environment": settings.APP_ENV,
        "auth": "JWT (Bearer)",
    }


@app.get("/server-info", tags=["Health"])
async def server_info():
    """Returns the server's LAN IP so the frontend can generate correct QR codes."""
    import socket
    lan_ip = "localhost"
    try:
        # Connect to external address to discover which local interface is used for LAN
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        lan_ip = s.getsockname()[0]
        s.close()
    except Exception:
        try:
            lan_ip = socket.gethostbyname(socket.gethostname())
        except Exception:
            lan_ip = "localhost"
    return {"lan_ip": lan_ip, "port": 8000, "frontend_port": 5173}


# ── Serve legacy HTML pages ────────────────────────────────────────────────────
_UI_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

@app.get("/enroll", include_in_schema=False)
async def serve_enroll_page():
    html_path = os.path.join(_UI_DIR, "biometric_enroll.html")
    return FileResponse(html_path, media_type="text/html")


@app.get("/score-card", include_in_schema=False)
async def serve_score_card_page():
    html_path = os.path.join(_UI_DIR, "score_card.html")
    return FileResponse(html_path, media_type="text/html")


@app.get("/interview", include_in_schema=False)
async def serve_interview_page():
    html_path = os.path.join(_UI_DIR, "interview_room.html")
    return FileResponse(html_path, media_type="text/html")
