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

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
