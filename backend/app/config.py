from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    APP_NAME: str = "SkillProof"
    APP_ENV: str = "development"
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # DB URL must be specified (or read from environment)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/skillproof"

    # Redis Cache URL
    REDIS_URL: str = "redis://localhost:6379/0"

    # Groq Client Configuration
    GROQ_API_KEY: str = ""
    # Model names are configurable so a deprecated Groq model can be swapped via .env
    # Check what your key can use at https://console.groq.com/docs/models
    GROQ_CHAT_MODEL: str = "qwen/qwen3.8-27b"
    # Leave empty to disable AI vision proctoring (Groq currently lists no vision model).
    GROQ_VISION_MODEL: str = ""

    # ── CORS ───────────────────────────────────────────────────────────────────
    # Comma-separated list of allowed frontend origins.
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    # Also allow the frontend when opened via a private LAN IP (QR codes use http://<LAN-IP>:5173).
    CORS_ALLOW_LAN: bool = True

    # ── JWT Auth Settings ──────────────────────────────────────────────────────
    # CHANGE JWT_SECRET_KEY in production — must be a long random string
    JWT_SECRET_KEY: str = "skillproof-super-secret-jwt-key-change-in-production-2024"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60           # 1 hour
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7              # 7 days

    # ── Google OAuth Settings ──────────────────────────────────────────────────
    GOOGLE_CLIENT_ID: str = ""
    # Developer-only fake Google login (used by the frontend "Developer Preview" button
    # when no real Client ID is configured). Never honoured when APP_ENV=production,
    # and never allowed for the admin portal.
    ALLOW_MOCK_GOOGLE_LOGIN: bool = True

    # ── Admin Seed Credentials ─────────────────────────────────────────────────
    ADMIN_EMAIL: str = "admin@skillproof.ai"
    ADMIN_PASSWORD: str = "SkillProof@Admin2024"   # CHANGE in production
    ADMIN_TOTP_SECRET: str = "JBSWY3DPEHPK3PXP"   # Default dev secret (use pyotp.random_base32())
    ADMIN_TOTP_ENABLED: bool = False

    # Email notifications (any SMTP server: Gmail app password, Outlook, SendGrid, Mailtrap...)
    # Leave SMTP_HOST empty to disable sending; emails are then only logged to the console.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    # "starttls" (port 587, most providers) | "ssl" (port 465) | "none" (local test servers like MailHog)
    SMTP_SECURITY: str = "starttls"
    EMAIL_FROM: str = "SkillProof <no-reply@skillproof.local>"
    # Base URL of the frontend, used for links inside emails
    FRONTEND_URL: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()


# ── Production safety check ────────────────────────────────────────────────────
# Refuse to start in production while well-known development secrets are still in use.
_INSECURE_DEFAULTS = {
    "JWT_SECRET_KEY": "skillproof-super-secret-jwt-key-change-in-production-2024",
    "ADMIN_PASSWORD": "SkillProof@Admin2024",
    "ADMIN_TOTP_SECRET": "JBSWY3DPEHPK3PXP",
}

if settings.APP_ENV == "production":
    _still_default = [k for k, v in _INSECURE_DEFAULTS.items() if getattr(settings, k) == v]
    if _still_default:
        raise RuntimeError(
            "Refusing to start in production with default values for: "
            + ", ".join(_still_default)
            + ". Set them in backend/.env."
        )
