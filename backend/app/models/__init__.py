"""
app/models/__init__.py
Central model registry — import all models here so SQLAlchemy
can resolve relationships and Alembic can detect all tables.
"""
from app.database import Base

# ── Auth / User models ────────────────────────────────────────────────────────
from app.models.user import User, AccountType
from app.models.organisation import Organisation, OrgStatus, OrgType
from app.models.admin import Admin
from app.models.links import UserOrganisationLink, LinkStatus, Notification, NotificationCategory

# ── Assessment pipeline models ────────────────────────────────────────────────
from app.models.session import VerificationSession, IntakeMode, SessionStatus
from app.models.document import DocumentVerificationResult, VerificationPath, FetchStatus
from app.models.interview import InterviewSession, InterviewStatus
from app.models.score import SkillScoreResult, SkillVerdict
from app.models.biometric import BiometricProfile

__all__ = [
    "Base",
    # Auth
    "User", "AccountType",
    "Organisation", "OrgStatus", "OrgType",
    "Admin",
    "UserOrganisationLink", "LinkStatus",
    "Notification", "NotificationCategory",
    # Pipeline
    "VerificationSession", "IntakeMode", "SessionStatus",
    "DocumentVerificationResult", "VerificationPath", "FetchStatus",
    "InterviewSession", "InterviewStatus",
    "SkillScoreResult", "SkillVerdict",
    "BiometricProfile",
]
