"""
add_biometric_table.py
Safe migration — adds the biometric_profiles table WITHOUT dropping existing tables.
Run once: python add_biometric_table.py
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.database import engine, Base

# Import ALL models so Base.metadata knows about them all
from app.models.session import VerificationSession
from app.models.document import DocumentVerificationResult
from app.models.interview import InterviewSession
from app.models.score import SkillScoreResult
from app.models.biometric import BiometricProfile  # ← new table


async def add_biometric_table():
    print("Connecting to database...")
    async with engine.begin() as conn:
        # checkfirst=True → only creates tables that do NOT already exist
        await conn.run_sync(Base.metadata.create_all, checkfirst=True)
    print("[OK] biometric_profiles table created (or already existed). All other tables untouched.")


if __name__ == "__main__":
    asyncio.run(add_biometric_table())
