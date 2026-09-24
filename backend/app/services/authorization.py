import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Event, EventStaffAssignment, OrganizationMembership, User
from app.db.models.enums import EventAssignmentRole, OrganizationRole, UserRole


@dataclass(frozen=True)
class EventAccess:
    event_id: uuid.UUID
    organization_id: uuid.UUID
    is_platform_admin: bool
    organization_roles: tuple[str, ...]
    event_roles: tuple[str, ...]
    can_manage_event: bool
    can_manage_finance: bool
    can_check_in: bool


def event_access(db: Session, user: User, event: Event) -> EventAccess:
    organization_roles = tuple(
        membership.role.value
        for membership in db.scalars(
            select(OrganizationMembership).where(
                OrganizationMembership.organization_id == event.organization_id,
                OrganizationMembership.user_id == user.id,
                OrganizationMembership.is_active.is_(True),
            )
        )
    )
    event_roles = tuple(
        assignment.role
        for assignment in db.scalars(
            select(EventStaffAssignment).where(
                EventStaffAssignment.event_id == event.id,
                EventStaffAssignment.user_id == user.id,
                EventStaffAssignment.is_active.is_(True),
            )
        )
    )
    platform_admin = user.role == UserRole.PLATFORM_ADMIN
    organization_admin = any(
        role in (OrganizationRole.OWNER.value, OrganizationRole.ADMIN.value) for role in organization_roles
    )
    can_manage_event = platform_admin or organization_admin or EventAssignmentRole.MANAGER.value in event_roles
    can_manage_finance = platform_admin or OrganizationRole.FINANCE.value in organization_roles
    can_check_in = (
        can_manage_event
        or EventAssignmentRole.STAFF.value in event_roles
        or EventAssignmentRole.CHECK_IN.value in event_roles
    )
    return EventAccess(
        event_id=event.id,
        organization_id=event.organization_id,
        is_platform_admin=platform_admin,
        organization_roles=organization_roles,
        event_roles=event_roles,
        can_manage_event=can_manage_event,
        can_manage_finance=can_manage_finance,
        can_check_in=can_check_in,
    )


def organization_roles(db: Session, user: User, organization_id: uuid.UUID) -> tuple[str, ...]:
    return tuple(
        membership.role.value
        for membership in db.scalars(
            select(OrganizationMembership).where(
                OrganizationMembership.organization_id == organization_id,
                OrganizationMembership.user_id == user.id,
                OrganizationMembership.is_active.is_(True),
            )
        )
    )
