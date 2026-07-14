import asyncio
import os
import sys

# Ensure app path is in sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.database import engine, Base
# Import all models to ensure they are registered on Base
from app.models.session import VerificationSession
from app.models.document import DocumentVerificationResult
from app.models.interview import InterviewSession
from app.models.score import SkillScoreResult

async def recreate_tables():
    print("Connecting to database...")
    async with engine.begin() as conn:
        print("Dropping existing tables...")
        # Drop all tables in reverse dependency order
        await conn.run_sync(Base.metadata.drop_all)
        print("Creating fresh tables...")
        await conn.run_sync(Base.metadata.create_all)
    print("Database tables recreated successfully!")

if __name__ == "__main__":
    asyncio.run(recreate_tables())
