"""
app/repositories/org_repo.py
Database operations for Organisation accounts.
"""
from typing import Optional, List
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from passlib.context import CryptContext

from app.models.organisation import Organisation, OrgStatus, OrgType

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


# ── Read ───────────────────────────────────────────────────────────────────────

async def get_org_by_id(db: AsyncSession, org_id: UUID) -> Optional[Organisation]:
    result = await db.execute(select(Organisation).where(Organisation.id == org_id))
    return result.scalar_one_or_none()


async def get_org_by_email(db: AsyncSession, email: str) -> Optional[Organisation]:
    result = await db.execute(
        select(Organisation).where(Organisation.email == email.lower().strip())
    )
    return result.scalar_one_or_none()


async def list_orgs(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    status_filter: Optional[str] = None,
) -> List[Organisation]:
    stmt = select(Organisation).order_by(Organisation.created_at.desc())
    if status_filter:
        stmt = stmt.where(Organisation.status == status_filter)
    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def search_orgs(db: AsyncSession, query: str, limit: int = 10) -> List[Organisation]:
    """Search approved organisations by name (used by candidates to find orgs)."""
    from sqlalchemy import or_, func as sa_func
    stmt = (
        select(Organisation)
        .where(
            Organisation.status == OrgStatus.approved,
            Organisation.name.ilike(f"%{query}%")
        )
        .order_by(Organisation.name)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


# ── Create ─────────────────────────────────────────────────────────────────────

async def create_org(
    db: AsyncSession,
    name: str,
    email: str,
    password: str,
    org_type: str = "college",
    contact_name: Optional[str] = None,
    contact_phone: Optional[str] = None,
    website: Optional[str] = None,
    address: Optional[str] = None,
    is_google_auth: bool = False,
    google_onboarding_completed: bool = False,
) -> Organisation:
    try:
        org_type_enum = OrgType(org_type)
    except ValueError:
        org_type_enum = OrgType.other

    org = Organisation(
        name=name,
        email=email.lower().strip(),
        hashed_password=hash_password(password) if password else "",
        org_type=org_type_enum,
        contact_name=contact_name,
        contact_phone=contact_phone,
        website=website,
        address=address,
        is_google_auth=is_google_auth,
        google_onboarding_completed=google_onboarding_completed,
        status=OrgStatus.pending,
    )
    db.add(org)
    await db.flush()
    await db.refresh(org)
    return org


# ── Update ─────────────────────────────────────────────────────────────────────

async def update_org(
    db: AsyncSession,
    org: Organisation,
    **kwargs,
) -> Organisation:
    for key, value in kwargs.items():
        if value is not None and hasattr(org, key):
            setattr(org, key, value)
    db.add(org)
    await db.flush()
    await db.refresh(org)
    return org


async def set_org_status(
    db: AsyncSession,
    org: Organisation,
    new_status: str,
    rejection_reason: Optional[str] = None,
) -> Organisation:
    try:
        org.status = OrgStatus(new_status)
    except ValueError:
        org.status = OrgStatus.pending
    if rejection_reason is not None:
        org.rejection_reason = rejection_reason
    db.add(org)
    await db.flush()
    await db.refresh(org)
    return org


async def delete_org(db: AsyncSession, org: Organisation) -> None:
    await db.delete(org)
    await db.flush()
