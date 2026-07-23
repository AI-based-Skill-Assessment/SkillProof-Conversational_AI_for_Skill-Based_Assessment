import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.database import async_session_factory
from sqlalchemy import text

async def main():
    async with async_session_factory() as db:
        res = await db.execute(text("SELECT id, candidate_name, status FROM verification_sessions"))
        sessions = res.all()
        print("VERIFICATION SESSIONS:")
        for s in sessions:
            print(s)

        res3 = await db.execute(text("SELECT session_id, voice_registered, face_registered, voice_embedding FROM biometric_profiles"))
        profiles = res3.all()
        print("\nBIOMETRIC PROFILES:")
        for p in profiles:
            print(p[:3])

if __name__ == "__main__":
    asyncio.run(main())
