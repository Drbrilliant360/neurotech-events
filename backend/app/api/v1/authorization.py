import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import DbSession
from app.api.v1.auth import CurrentUser
from app.db.models import Event, EventStaffAssignment, Organization, OrganizationMembership, User
from app.db.models.enums import OrganizationRole, UserRole
from app.schemas.authorization import EventAccessResponse
from app.schemas.authorization_admin import (
    EventAssignmentUpsertRequest,
    MembershipUpsertRequest,
    ScopedAssignmentResponse,
)
from app.services.authorization import event_access, organization_roles

router = APIRouter(prefix="/authorization", tags=["authorization"])


def require_organization_manager(
    organization_id: uuid.UUID,
    user: CurrentUser,
    db: DbSession,
) -> Organization:
    organization = db.get(Organization, organization_id)
    if organization is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    roles = organization_roles(db, user, organization.id)
    if user.role != UserRole.PLATFORM_ADMIN and not any(
        role in (OrganizationRole.OWNER.value, OrganizationRole.ADMIN.value) for role in roles
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization manager role required.")
    return organization


def require_event_manager(
    event_id: uuid.UUID,
    user: CurrentUser,
    db: DbSession,
) -> Event:
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")
    if not event_access(db, user, event).can_manage_event:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Event manager role required.")
    return event


@router.get("/events/{event_id}", response_model=EventAccessResponse)
def get_event_access(event_id: uuid.UUID, user: CurrentUser, db: DbSession) -> EventAccessResponse:
    event = db.scalar(select(Event).where(Event.id == event_id))
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")
    access = event_access(db, user, event)
    return EventAccessResponse(
        event_id=access.event_id,
        organization_id=access.organization_id,
        is_platform_admin=access.is_platform_admin,
        organization_roles=list(access.organization_roles),
        event_roles=list(access.event_roles),
        can_manage_event=access.can_manage_event,
        can_manage_finance=access.can_manage_finance,
        can_check_in=access.can_check_in,
    )


@router.put("/organizations/{organization_id}/memberships/{user_id}", response_model=ScopedAssignmentResponse)
def upsert_membership(
    payload: MembershipUpsertRequest,
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
    user: CurrentUser,
    db: DbSession,
) -> OrganizationMembership:
    require_organization_manager(organization_id, user, db)
    if payload.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="User ID mismatch.")
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    membership = db.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == organization_id,
            OrganizationMembership.user_id == user_id,
        )
    )
    if membership is None:
        membership = OrganizationMembership(organization_id=organization_id, user_id=user_id)
        db.add(membership)
    membership.role = payload.role
    membership.is_active = True
    db.commit()
    db.refresh(membership)
    return membership


@router.delete("/organizations/{organization_id}/memberships/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_membership(
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
    user: CurrentUser,
    db: DbSession,
) -> None:
    require_organization_manager(organization_id, user, db)
    membership = db.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == organization_id,
            OrganizationMembership.user_id == user_id,
        )
    )
    if membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership not found.")
    membership.is_active = False
    db.commit()


@router.put("/events/{event_id}/assignments/{user_id}", response_model=ScopedAssignmentResponse)
def upsert_event_assignment(
    payload: EventAssignmentUpsertRequest,
    event_id: uuid.UUID,
    user_id: uuid.UUID,
    user: CurrentUser,
    db: DbSession,
) -> EventStaffAssignment:
    require_event_manager(event_id, user, db)
    if payload.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="User ID mismatch.")
    if db.get(User, user_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    assignment = db.scalar(
        select(EventStaffAssignment).where(
            EventStaffAssignment.event_id == event_id,
            EventStaffAssignment.user_id == user_id,
        )
    )
    if assignment is None:
        assignment = EventStaffAssignment(event_id=event_id, user_id=user_id)
        db.add(assignment)
    assignment.role = payload.role.value
    assignment.is_active = True
    db.commit()
    db.refresh(assignment)
    return assignment


@router.delete("/events/{event_id}/assignments/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_event_assignment(
    event_id: uuid.UUID,
    user_id: uuid.UUID,
    user: CurrentUser,
    db: DbSession,
) -> None:
    require_event_manager(event_id, user, db)
    assignment = db.scalar(
        select(EventStaffAssignment).where(
            EventStaffAssignment.event_id == event_id,
            EventStaffAssignment.user_id == user_id,
        )
    )
    if assignment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event assignment not found.")
    assignment.is_active = False
    db.commit()
