import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy.ext.asyncio import create_async_engine
from app.config import settings
import app.models
from app.database import Base

async def recreate():
    print(f"Non-interactively recreating tables for database: {settings.DATABASE_URL}")
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async with engine.begin() as conn:
        print("Dropping all tables...")
        await conn.run_sync(Base.metadata.drop_all)
        print("Creating all tables...")
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    print("Done!")

if __name__ == "__main__":
    asyncio.run(recreate())
