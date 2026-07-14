import asyncio
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.database import async_session_factory, init_redis
from app.repositories import session_repo, document_repo
from app.schemas.session import VerificationSessionCreate
from app.schemas.document import DocumentVerificationResultCreate


async def run_diagnostics():
    print("Initializing Redis (smart fallback)...")
    await init_redis()
    
    print("Opening database session...")
    async with async_session_factory() as db:
        try:
            print("Creating test VerificationSession with dynamic details...")
            session_in = VerificationSessionCreate(
                intake_mode="certificate",
                candidate_name="Aravind G",
                candidate_email="aravind@example.com",
                certificate_filename="aravind_internship.pdf"
            )
            session = await session_repo.create_session(db, session_in)
            print(f"Created session with ID: {session.id}")
            
            print("Creating test DocumentVerificationResult (new schema)...")
            doc_in = DocumentVerificationResultCreate(
                session_id=session.id,
                verification_path="url_fetch",
                fetch_status="verified",
                fetched_content_snippet="SAVIC Technologies internship verification snippet...",
                document_score=95.0
            )
            doc = await document_repo.create_document_result(db, doc_in)
            print(f"Created document verification result with ID: {doc.id}")
            
            print("Committing database transaction...")
            await db.commit()
            print("Transaction committed successfully!")
            
            print("Refreshing database session to retrieve relationships...")
            refreshed = await session_repo.get_session(db, session.id)
            print(f"Refreshed session details: {refreshed.candidate_name}, status: {refreshed.status}")
            print(f"Nested document score: {refreshed.document.document_score if refreshed.document else None}")
            
        except Exception as e:
            print("\n!!! DIAGNOSTIC RUN FAILED !!!")
            import traceback
            traceback.print_exc()
            await db.rollback()

if __name__ == "__main__":
    asyncio.run(run_diagnostics())
