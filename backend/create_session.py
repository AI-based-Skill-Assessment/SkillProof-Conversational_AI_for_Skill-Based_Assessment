import asyncio
import os
import sys
import uuid

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.database import async_session_factory
from app.models.session import VerificationSession, IntakeMode, SessionStatus

async def main():
    session_uuid = uuid.UUID("2808d1d3-0dd4-49e7-a654-6a703968e311")
    
    async with async_session_factory() as db:
        # Check if session exists
        existing = await db.get(VerificationSession, session_uuid)
        if existing:
            print(f"Session {session_uuid} already exists.")
            return

        new_session = VerificationSession(
            id=session_uuid,
            intake_mode=IntakeMode.skill_only,
            status=SessionStatus.pending,
            candidate_name="Test Candidate",
            candidate_email="candidate@example.com"
        )
        db.add(new_session)
        await db.commit()
        print(f"Successfully created verification session for UUID: {session_uuid}")

if __name__ == "__main__":
    asyncio.run(main())
