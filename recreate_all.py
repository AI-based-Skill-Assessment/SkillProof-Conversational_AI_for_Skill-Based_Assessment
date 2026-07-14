"""
recreate_all.py
Drops ALL tables and recreates them with the latest schema.
WARNING: All data will be lost. Run this only when you explicitly want a clean slate.
"""

import asyncio, os, sys
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.database import engine, Base

# Import every model so SQLAlchemy registers all tables on Base.metadata
from app.models.session   import VerificationSession
from app.models.document  import DocumentVerificationResult
from app.models.interview import InterviewSession
from app.models.score     import SkillScoreResult
from app.models.biometric import BiometricProfile


async def recreate():
    print("Connecting to database…")
    async with engine.begin() as conn:
        print("Dropping ALL tables…")
        await conn.run_sync(Base.metadata.drop_all)
        print("Recreating tables with new schema…")
        await conn.run_sync(Base.metadata.create_all)
    print("[OK] All tables dropped and recreated successfully.")
    print("     Tables created:")
    for table in Base.metadata.tables.keys():
        print(f"       - {table}")


if __name__ == "__main__":
    asyncio.run(recreate())
