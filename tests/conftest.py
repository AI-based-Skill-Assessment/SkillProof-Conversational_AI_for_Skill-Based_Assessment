import pytest
import asyncio
from typing import AsyncGenerator
from unittest.mock import MagicMock, AsyncMock
from fastapi import FastAPI
from httpx import AsyncClient

from app.main import app
from app.database import get_db, get_redis

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
def mock_db_session() -> AsyncMock:
    """Fixture to provide a mocked SQLAlchemy AsyncSession."""
    mock_session = AsyncMock()
    mock_session.commit = AsyncMock()
    mock_session.rollback = AsyncMock()
    mock_session.close = AsyncMock()
    mock_session.flush = AsyncMock()
    mock_session.refresh = AsyncMock()
    
    # Configure execute return value to properly support synchronous scalar methods
    mock_execute_result = MagicMock()
    mock_execute_result.scalars.return_value.first.return_value = None
    mock_execute_result.scalars.return_value.all.return_value = []
    mock_session.execute = AsyncMock(return_value=mock_execute_result)
    
    return mock_session


@pytest.fixture
def mock_redis_client() -> AsyncMock:
    """Fixture to provide a mocked Redis Client."""
    mock_redis = AsyncMock()
    mock_redis.get = AsyncMock(return_value=None)
    mock_redis.setex = AsyncMock(return_value=True)
    mock_redis.close = AsyncMock()
    return mock_redis

@pytest.fixture(autouse=True)
def override_dependencies(mock_db_session, mock_redis_client):
    """Automatically override database and redis dependencies for test runs."""
    app.dependency_overrides[get_db] = lambda: mock_db_session
    
    # Mock global redis client helper
    import app.database as db_mod
    db_mod.redis_client = mock_redis_client
    
    yield
    app.dependency_overrides.clear()
    db_mod.redis_client = None

import pytest_asyncio

@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Fixture providing an async client for app endpoint calls."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
