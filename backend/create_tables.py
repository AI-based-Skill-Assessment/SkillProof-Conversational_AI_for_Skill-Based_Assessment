import asyncio
import os
import sys

# Ensure app path is in sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.database import engine, Base
# Import models to register them on Base
from app.models.session import VerificationSession
from app.models.document import DocumentVerificationResult
from app.models.interview import InterviewSession
from app.models.score import SkillScoreResult

async def create_tables():
    print("Connecting to database and recreating tables...")
    async with engine.begin() as conn:
        # Drop all tables to clean up old schemas
        await conn.run_sync(Base.metadata.drop_all)
        # Create all tables freshly
        await conn.run_sync(Base.metadata.create_all)
    print("All tables recreated successfully!")

if __name__ == "__main__":
    asyncio.run(create_tables())
