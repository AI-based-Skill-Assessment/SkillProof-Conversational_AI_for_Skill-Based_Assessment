"""
scripts/db/recreate_all.py
Drop all tables and recreate them from the current SQLAlchemy models.
WARNING: This DELETES all existing data.

Usage (from skillproof/backend/ directory):
    python -m scripts.db.recreate_all
"""
import asyncio
import sys
import os

# Ensure backend root is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy.ext.asyncio import create_async_engine

from app.config import settings

# Import ALL models to register them with Base.metadata before create_all
import app.models   # noqa: F401 — side-effect import that populates Base.metadata
from app.database import Base


async def recreate():
    print("=" * 60)
    print(f"  SkillProof DB Recreation Script")
    print(f"  Target: {settings.DATABASE_URL}")
    print("=" * 60)
    print("\n⚠️  This will DROP and RECREATE all tables.")
    confirm = input("  Type 'yes' to confirm: ").strip().lower()
    if confirm != "yes":
        print("  Aborted.")
        return

    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async with engine.begin() as conn:
        print("\n[1/2] Dropping all tables...")
        await conn.run_sync(Base.metadata.drop_all)
        print("[2/2] Creating all tables...")
        await conn.run_sync(Base.metadata.create_all)

    await engine.dispose()
    print("\n✅ Database recreated successfully!")
    print("\nNew tables created:")
    for table in sorted(Base.metadata.tables.keys()):
        print(f"   • {table}")
    print("\nNext: start the server to auto-seed the admin account.")
    print(f"  Admin email:    {settings.ADMIN_EMAIL}")
    print(f"  Admin password: {settings.ADMIN_PASSWORD}")
    print(f"  Admin TOTP:     Use pyotp.TOTP('{settings.ADMIN_TOTP_SECRET}').now()")


if __name__ == "__main__":
    asyncio.run(recreate())
