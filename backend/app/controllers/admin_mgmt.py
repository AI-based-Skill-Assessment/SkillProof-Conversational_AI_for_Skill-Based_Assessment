"""
app/controllers/admin_mgmt.py
Admin management routes for platform governance.
All routes require a valid admin JWT.

  GET    /api/v1/admin/stats
  GET    /api/v1/admin/organisations
  POST   /api/v1/admin/organisations
  GET    /api/v1/admin/organisations/{org_id}
  PUT    /api/v1/admin/organisations/{org_id}
  DELETE /api/v1/admin/organisations/{org_id}
  POST   /api/v1/admin/organisations/{org_id}/approve
  POST   /api/v1/admin/organisations/{org_id}/reject
  POST   /api/v1/admin/organisations/{org_id}/suspend
  POST   /api/v1/admin/organisations/{org_id}/reactivate
  GET    /api/v1/admin/users
  GET    /api/v1/admin/users/{user_id}
  GET    /api/v1/admin/assessments
  GET    /api/v1/admin/activity
"""
from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.admin import Admin
from app.models.organisation import Organisation
from app.models.user import User
from app.models.session import VerificationSession
from app.schemas.auth import OrgProfileResponse, UserProfileResponse, AdminProfileResponse
from app.repositories import org_repo, user_repo, admin_repo
from app.security.deps import get_current_admin

router = APIRouter(prefix="/admin", tags=["Admin Management"])


# ═══════════════════════════════════════════════════════════════════════════════
#  DASHBOARD STATS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/stats", summary="Platform Statistics")
async def get_platform_stats(
    _admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Return aggregate platform statistics for the admin dashboard."""
    # Organisation counts
    total_orgs_r = await db.execute(select(func.count(Organisation.id)))
    total_orgs = total_orgs_r.scalar() or 0

    active_orgs_r = await db.execute(
        select(func.count(Organisation.id)).where(Organisation.status == "approved")
    )
    active_orgs = active_orgs_r.scalar() or 0

    pending_orgs_r = await db.execute(
        select(func.count(Organisation.id)).where(Organisation.status == "pending")
    )
    pending_orgs = pending_orgs_r.scalar() or 0

    suspended_orgs_r = await db.execute(
        select(func.count(Organisation.id)).where(Organisation.status == "suspended")
    )
    suspended_orgs = suspended_orgs_r.scalar() or 0

    # User counts
    total_users_r = await db.execute(select(func.count(User.id)))
    total_users = total_users_r.scalar() or 0

    # Assessment counts
    total_assessments_r = await db.execute(select(func.count(VerificationSession.id)))
    total_assessments = total_assessments_r.scalar() or 0

    return {
        "total_organisations": total_orgs,
        "active_organisations": active_orgs,
        "pending_approval": pending_orgs,
        "suspended_organisations": suspended_orgs,
        "total_users": total_users,
        "total_assessments": total_assessments,
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  ORGANISATION CRUD
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/organisations", summary="List All Organisations")
async def list_organisations(
    skip: int = 0,
    limit: int = 50,
    status_filter: Optional[str] = None,
    _admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    orgs = await org_repo.list_orgs(db, skip=skip, limit=limit, status_filter=status_filter)
    return [OrgProfileResponse.model_validate(o) for o in orgs]


@router.post("/organisations", status_code=status.HTTP_201_CREATED, summary="Create Organisation")
async def create_organisation(
    payload: dict,
    _admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin creates a pre-approved organisation account."""
    existing = await org_repo.get_org_by_email(db, payload.get("email", ""))
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered.")

    org = await org_repo.create_org(
        db,
        name=payload.get("name", ""),
        email=payload.get("email", ""),
        password=payload.get("password", "TempPass@2024"),
        org_type=payload.get("org_type", "college"),
        contact_name=payload.get("contact_name"),
        contact_phone=payload.get("contact_phone"),
        website=payload.get("website"),
        address=payload.get("address"),
    )
    # Admin-created orgs are auto-approved
    org = await org_repo.set_org_status(db, org, "approved")
    await db.commit()
    return OrgProfileResponse.model_validate(org)


@router.get("/organisations/{org_id}", summary="Get Organisation Detail")
async def get_organisation(
    org_id: UUID,
    _admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> OrgProfileResponse:
    org = await org_repo.get_org_by_id(db, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found.")
    return OrgProfileResponse.model_validate(org)


@router.put("/organisations/{org_id}", summary="Update Organisation")
async def update_organisation(
    org_id: UUID,
    payload: dict,
    _admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> OrgProfileResponse:
    org = await org_repo.get_org_by_id(db, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found.")
    allowed = ["name", "contact_name", "contact_phone", "website", "address", "logo_url", "org_type"]
    update_kwargs = {k: v for k, v in payload.items() if k in allowed and v is not None}
    org = await org_repo.update_org(db, org, **update_kwargs)
    await db.commit()
    return OrgProfileResponse.model_validate(org)


@router.delete("/organisations/{org_id}", summary="Delete Organisation")
async def delete_organisation(
    org_id: UUID,
    _admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    org = await org_repo.get_org_by_id(db, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found.")
    await org_repo.delete_org(db, org)
    await db.commit()
    return {"message": f"Organisation '{org.name}' deleted successfully."}


# ── Status actions ─────────────────────────────────────────────────────────────

@router.post("/organisations/{org_id}/approve", summary="Approve Organisation")
async def approve_organisation(
    org_id: UUID,
    _admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> OrgProfileResponse:
    org = await org_repo.get_org_by_id(db, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found.")
    org = await org_repo.set_org_status(db, org, "approved")
    await db.commit()
    return OrgProfileResponse.model_validate(org)


@router.post("/organisations/{org_id}/reject", summary="Reject Organisation")
async def reject_organisation(
    org_id: UUID,
    payload: dict,
    _admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> OrgProfileResponse:
    org = await org_repo.get_org_by_id(db, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found.")
    org = await org_repo.set_org_status(db, org, "rejected", rejection_reason=payload.get("reason"))
    await db.commit()
    return OrgProfileResponse.model_validate(org)


@router.post("/organisations/{org_id}/suspend", summary="Suspend Organisation")
async def suspend_organisation(
    org_id: UUID,
    _admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> OrgProfileResponse:
    org = await org_repo.get_org_by_id(db, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found.")
    org = await org_repo.set_org_status(db, org, "suspended")
    await db.commit()
    return OrgProfileResponse.model_validate(org)


@router.post("/organisations/{org_id}/reactivate", summary="Reactivate Organisation")
async def reactivate_organisation(
    org_id: UUID,
    _admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> OrgProfileResponse:
    org = await org_repo.get_org_by_id(db, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found.")
    org = await org_repo.set_org_status(db, org, "approved")
    await db.commit()
    return OrgProfileResponse.model_validate(org)


# ═══════════════════════════════════════════════════════════════════════════════
#  USER MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/users", summary="List All Users")
async def list_users(
    skip: int = 0,
    limit: int = 50,
    _admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    users = await user_repo.list_users(db, skip=skip, limit=limit)
    return [UserProfileResponse.model_validate(u) for u in users]


@router.get("/users/{user_id}", summary="Get User Detail")
async def get_user(
    user_id: UUID,
    _admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> UserProfileResponse:
    user = await user_repo.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return UserProfileResponse.model_validate(user)


# ═══════════════════════════════════════════════════════════════════════════════
#  ASSESSMENTS & ACTIVITY (read-only for admin)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/assessments", summary="List All Assessments")
async def list_assessments(
    skip: int = 0,
    limit: int = 50,
    _admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy.orm import selectinload
    stmt = (
        select(VerificationSession)
        .options(selectinload(VerificationSession.scores))
        .order_by(VerificationSession.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    sessions = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "candidate_name": s.candidate_name,
            "candidate_email": s.candidate_email,
            "intake_mode": s.intake_mode.value,
            "status": s.status.value,
            "extracted_role": s.extracted_role,
            "extracted_skills": s.extracted_skills,
            "created_at": s.created_at.isoformat(),
        }
        for s in sessions
    ]


@router.get("/activity", summary="System Activity Log")
async def get_activity(
    skip: int = 0,
    limit: int = 50,
    _admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Returns recent sessions as a platform activity log."""
    stmt = (
        select(VerificationSession)
        .order_by(VerificationSession.updated_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    sessions = result.scalars().all()
    return [
        {
            "session_id": str(s.id),
            "candidate": s.candidate_name or "Unknown",
            "event": f"Status changed to {s.status.value}",
            "timestamp": s.updated_at.isoformat(),
        }
        for s in sessions
    ]
