import asyncio
import os
import sys

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from app.database import engine, Base
# Import models to register them on Base
from app.models.session import VerificationSession
from app.models.document import DocumentVerificationResult
from app.models.interview import InterviewSession
from app.models.score import SkillScoreResult
from app.models.biometric import BiometricProfile

async def create_tables():
    print("Connecting to database and creating tables...")
    async with engine.begin() as conn:
        # Create all missing tables based on Base metadata
        await conn.run_sync(Base.metadata.create_all)
    print("[OK] All database tables created successfully!")

if __name__ == "__main__":
    asyncio.run(create_tables())
