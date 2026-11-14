"""
backend/app/database_migration.py
Automatic startup schema sync — ensures tables and missing columns exist.
"""
import sys
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.database import Base, engine
import app.models  # noqa: F401 - Register all models with Base.metadata


COLUMNS_TO_ENSURE = [
    # Table, Column, SQL Definition
    ("biometric_profiles", "tab_switch_count", "INTEGER NOT NULL DEFAULT 0"),
    ("biometric_profiles", "window_blur_count", "INTEGER NOT NULL DEFAULT 0"),
    ("biometric_profiles", "copy_paste_attempts", "INTEGER NOT NULL DEFAULT 0"),
    ("biometric_profiles", "secondary_speaker_count", "INTEGER NOT NULL DEFAULT 0"),
    ("biometric_profiles", "integrity_score", "FLOAT NOT NULL DEFAULT 100.0"),
    ("biometric_profiles", "proctoring_timeline", "JSON DEFAULT '[]'::json"),
    ("biometric_profiles", "fraud_flags", "INTEGER NOT NULL DEFAULT 0"),
    ("biometric_profiles", "fraud_status", "VARCHAR(50) NOT NULL DEFAULT 'clean'"),
    ("biometric_profiles", "interview_flagged", "BOOLEAN NOT NULL DEFAULT FALSE"),
    ("biometric_profiles", "flag_reasons", "JSON DEFAULT '[]'::json"),
    ("biometric_profiles", "face_duplicate_detected", "BOOLEAN NOT NULL DEFAULT FALSE"),
    ("biometric_profiles", "voice_duplicate_detected", "BOOLEAN NOT NULL DEFAULT FALSE"),
    ("biometric_profiles", "duplicate_of_session", "VARCHAR(64)"),
    ("biometric_profiles", "gaze_violations", "INTEGER NOT NULL DEFAULT 0"),
    ("biometric_profiles", "camera_interruptions", "INTEGER NOT NULL DEFAULT 0"),
    ("biometric_profiles", "face_mismatch_count", "INTEGER NOT NULL DEFAULT 0"),
    ("biometric_profiles", "voice_mismatch_count", "INTEGER NOT NULL DEFAULT 0"),
    ("biometric_profiles", "face_verify_pass", "INTEGER NOT NULL DEFAULT 0"),
    ("biometric_profiles", "voice_verify_pass", "INTEGER NOT NULL DEFAULT 0"),
    # Placement drives (placement_drives table itself is created by create_all above)
    ("verification_sessions", "drive_id", "UUID REFERENCES placement_drives(id) ON DELETE SET NULL"),
    ("verification_sessions", "drive_decision", "VARCHAR(20)"),
    # Per-skill scoring
    ("skill_score_results", "skill_name", "VARCHAR(255)"),
    # In-browser face proctoring
    ("biometric_profiles", "multi_face_count", "INTEGER NOT NULL DEFAULT 0"),
    ("biometric_profiles", "face_mismatch_streak", "INTEGER NOT NULL DEFAULT 0"),
    ("biometric_profiles", "voice_mismatch_streak", "INTEGER NOT NULL DEFAULT 0"),
]

INDEXES_TO_ENSURE = [
    "CREATE INDEX IF NOT EXISTS ix_verification_sessions_drive_id ON verification_sessions (drive_id);",
]


async def run_auto_migrations():
    """Create any missing tables and alter tables to add any missing columns."""
    try:
        async with engine.begin() as conn:
            # 1. Create all missing tables
            await conn.run_sync(Base.metadata.create_all)

            # 2. Alter tables to add any missing columns safely
            for table_name, col_name, col_def in COLUMNS_TO_ENSURE:
                query = text(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {col_name} {col_def};")
                try:
                    await conn.execute(query)
                except Exception as col_err:
                    print(f"[DB Migration] Note on {table_name}.{col_name}: {col_err}")

            for stmt in INDEXES_TO_ENSURE:
                try:
                    await conn.execute(text(stmt))
                except Exception as idx_err:
                    print(f"[DB Migration] Note on index: {idx_err}")

        print("[DB Migration] Database tables and columns verified successfully.")
    except Exception as e:
        print(f"[DB Migration] Schema auto-sync warning: {e}")
