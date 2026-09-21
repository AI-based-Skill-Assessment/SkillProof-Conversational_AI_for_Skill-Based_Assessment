"""
app/repositories/link_repo.py
Database operations for UserOrganisationLink candidate <-> org connections.
"""
from typing import List, Optional
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.links import UserOrganisationLink, LinkStatus
from app.models.user import User
from app.models.organisation import Organisation


async def create_link_request(
    db: AsyncSession,
    user_id: UUID,
    org_id: UUID
) -> UserOrganisationLink:
    """Create a new candidate connection request to an organisation."""
    # Check if link already exists
    stmt = select(UserOrganisationLink).where(
        UserOrganisationLink.user_id == user_id,
        UserOrganisationLink.org_id == org_id
    )
    res = await db.execute(stmt)
    existing = res.scalar_one_or_none()
    if existing:
        if existing.status in (LinkStatus.rejected, LinkStatus.revoked):
            existing.status = LinkStatus.pending
            from sqlalchemy.sql import func
            existing.connected_at = func.now()
            await db.flush()
            await db.refresh(existing)
        return existing

    link = UserOrganisationLink(
        user_id=user_id,
        org_id=org_id,
        status=LinkStatus.pending,
        shared_session_ids=[]
    )
    db.add(link)
    await db.flush()
    await db.refresh(link)
    return link


async def get_org_requests(
    db: AsyncSession,
    org_id: UUID,
    status: Optional[str] = None
) -> List[UserOrganisationLink]:
    """Retrieve all candidate linkages (pending/approved) for an organisation."""
    stmt = (
        select(UserOrganisationLink)
        .where(UserOrganisationLink.org_id == org_id)
        .options(selectinload(UserOrganisationLink.user))
        .order_by(UserOrganisationLink.connected_at.desc())
    )
    if status:
        try:
            status_enum = LinkStatus(status)
            stmt = stmt.where(UserOrganisationLink.status == status_enum)
        except ValueError:
            pass

    res = await db.execute(stmt)
    return list(res.scalars().all())


async def get_user_connections(
    db: AsyncSession,
    user_id: UUID
) -> List[UserOrganisationLink]:
    """Retrieve all organisations a candidate has linked to."""
    stmt = (
        select(UserOrganisationLink)
        .where(UserOrganisationLink.user_id == user_id)
        .options(selectinload(UserOrganisationLink.organisation))
        .order_by(UserOrganisationLink.connected_at.desc())
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def update_link_status(
    db: AsyncSession,
    link_id: UUID,
    new_status: str
) -> Optional[UserOrganisationLink]:
    """Update connection request status (approved/rejected/revoked)."""
    stmt = select(UserOrganisationLink).where(UserOrganisationLink.id == link_id)
    res = await db.execute(stmt)
    link = res.scalar_one_or_none()
    if not link:
        return None

    try:
        link.status = LinkStatus(new_status)
    except ValueError:
        link.status = LinkStatus.pending

    db.add(link)
    await db.flush()
    await db.refresh(link)
    return link
