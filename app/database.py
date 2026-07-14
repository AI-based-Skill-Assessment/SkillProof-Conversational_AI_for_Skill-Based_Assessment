from typing import AsyncGenerator
import redis.asyncio as aioredis
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base

from app.config import settings

# SQLAlchemy declarative base
Base = declarative_base()

# SQLAlchemy Async Engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=(settings.APP_ENV == "development"),
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20
)

# SQLAlchemy Async Sessionmaker
async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Dependency to get db session in endpoints
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

# Redis Smart Client with In-Memory Fallback
class SmartRedisClient:
    def __init__(self) -> None:
        self._real_redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        self._fallback_store = {}
        self._use_fallback = False
        self._checked = False

    async def _check_connection(self) -> None:
        if self._checked:
            return
        try:
            # Try a quick ping to see if local redis service is alive
            await asyncio.wait_for(self._real_redis.ping(), timeout=1.0)
            self._use_fallback = False
            print("[SkillProof Redis] Connected to Redis server successfully.")
        except Exception:
            self._use_fallback = True
            print("[SkillProof Redis] Connection failed. Falling back to in-memory dictionary caching.")
        finally:
            self._checked = True

    async def get(self, key: str) -> str | None:
        await self._check_connection()
        if self._use_fallback:
            return self._fallback_store.get(key)
        try:
            return await self._real_redis.get(key)
        except Exception as e:
            print(f"[SkillProof Redis] GET failed, fallback active: {e}")
            self._use_fallback = True
            return self._fallback_store.get(key)

    async def setex(self, key: str, seconds: int, value: str) -> bool:
        await self._check_connection()
        if self._use_fallback:
            self._fallback_store[key] = value
            return True
        try:
            await self._real_redis.setex(key, seconds, value)
            return True
        except Exception as e:
            print(f"[SkillProof Redis] SETEX failed, fallback active: {e}")
            self._use_fallback = True
            self._fallback_store[key] = value
            return True

    async def close(self) -> None:
        try:
            await self._real_redis.close()
        except Exception:
            pass

import asyncio

# Redis Global Client Setup
redis_client: SmartRedisClient | None = None

async def init_redis() -> SmartRedisClient:
    global redis_client
    redis_client = SmartRedisClient()
    # Eagerly check connection at startup
    await redis_client._check_connection()
    return redis_client

async def close_redis() -> None:
    global redis_client
    if redis_client:
        await redis_client.close()

def get_redis() -> SmartRedisClient:
    if redis_client is None:
        raise RuntimeError("Redis client is not initialized. Make sure app lifespan is running.")
    return redis_client

