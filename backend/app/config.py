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

    # ── JWT Auth Settings ──────────────────────────────────────────────────────
    # CHANGE JWT_SECRET_KEY in production — must be a long random string
    JWT_SECRET_KEY: str = "skillproof-super-secret-jwt-key-change-in-production-2024"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60           # 1 hour
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7              # 7 days

    # ── Google OAuth Settings ──────────────────────────────────────────────────
    GOOGLE_CLIENT_ID: str = ""

    # ── Admin Seed Credentials ─────────────────────────────────────────────────
    ADMIN_EMAIL: str = "admin@skillproof.ai"
    ADMIN_PASSWORD: str = "SkillProof@Admin2024"   # CHANGE in production
    ADMIN_TOTP_SECRET: str = "JBSWY3DPEHPK3PXP"   # Default dev secret (use pyotp.random_base32())
    ADMIN_TOTP_ENABLED: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
