"""Scoped authorization: who may do what to which event.

Decisions combine three scopes: the platform role on the user, organization memberships, and
per-event staff assignments. Every admin route resolves access through `require_event`, so
the rules live in exactly one place.
"""

import uuid
from dataclasses import dataclass
from enum import StrEnum

from sqlalchemy import ColumnElement, or_, select
from sqlalchemy.orm import Session

from app.db.models import Event, EventStaffAssignment, OrganizationMembership, User
from app.db.models.enums import EventAssignmentRole, OrganizationRole, UserRole
from app.services.errors import ForbiddenError, NotFoundError

ORGANIZATION_MANAGER_ROLES = (OrganizationRole.OWNER.value, OrganizationRole.ADMIN.value)


class Capability(StrEnum):
    VIEW = "view"
    MANAGE = "manage"
    FINANCE = "finance"
    CHECK_IN = "check_in"


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

    @property
    def can_view(self) -> bool:
        return self.is_platform_admin or bool(self.organization_roles) or bool(self.event_roles)

    def allows(self, capability: Capability) -> bool:
        return {
            Capability.VIEW: self.can_view,
            Capability.MANAGE: self.can_manage_event,
            Capability.FINANCE: self.can_manage_finance,
            Capability.CHECK_IN: self.can_check_in,
        }[capability]


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
    return _compose(user, event, organization_roles, event_roles)


def _compose(
    user: User, event: Event, organization_roles: tuple[str, ...], event_roles: tuple[str, ...]
) -> EventAccess:
    platform_admin = user.role == UserRole.PLATFORM_ADMIN
    organization_admin = any(role in ORGANIZATION_MANAGER_ROLES for role in organization_roles)
    can_manage_event = platform_admin or organization_admin or EventAssignmentRole.MANAGER.value in event_roles
    # Owners and admins run the organization, so they see its money as well as finance staff.
    can_manage_finance = platform_admin or organization_admin or OrganizationRole.FINANCE.value in organization_roles
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


def access_for_events(db: Session, user: User, events: list[Event]) -> dict[uuid.UUID, EventAccess]:
    """Access for many events in two queries (instead of two per event)."""
    by_org: dict[uuid.UUID, list[str]] = {}
    for membership in db.scalars(
        select(OrganizationMembership).where(
            OrganizationMembership.user_id == user.id, OrganizationMembership.is_active.is_(True)
        )
    ):
        by_org.setdefault(membership.organization_id, []).append(membership.role.value)
    by_event: dict[uuid.UUID, list[str]] = {}
    for assignment in db.scalars(
        select(EventStaffAssignment).where(
            EventStaffAssignment.user_id == user.id, EventStaffAssignment.is_active.is_(True)
        )
    ):
        by_event.setdefault(assignment.event_id, []).append(assignment.role)
    return {
        event.id: _compose(
            user, event, tuple(by_org.get(event.organization_id, ())), tuple(by_event.get(event.id, ()))
        )
        for event in events
    }


def require_event(
    db: Session, user: User, event_id: uuid.UUID, capability: Capability
) -> tuple[Event, EventAccess]:
    event = db.get(Event, event_id)
    if event is None:
        raise NotFoundError("Event not found.")
    access = event_access(db, user, event)
    if not access.allows(capability):
        # Users with no relationship to the event learn nothing about it.
        if not access.can_view:
            raise NotFoundError("Event not found.")
        raise ForbiddenError(f"This action requires the '{capability.value}' permission on the event.")
    return event, access


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


def managed_organization_ids(db: Session, user: User) -> list[uuid.UUID]:
    return list(
        db.scalars(
            select(OrganizationMembership.organization_id).where(
                OrganizationMembership.user_id == user.id,
                OrganizationMembership.is_active.is_(True),
                OrganizationMembership.role.in_([OrganizationRole(role) for role in ORGANIZATION_MANAGER_ROLES]),
            )
        )
    )


def require_organization_manager(db: Session, user: User, organization_id: uuid.UUID) -> None:
    if user.role == UserRole.PLATFORM_ADMIN:
        return
    if not any(role in ORGANIZATION_MANAGER_ROLES for role in organization_roles(db, user, organization_id)):
        raise ForbiddenError("Organization owner or admin role required.")


def is_organizer(db: Session, user: User) -> bool:
    """True for anyone who manages at least one organization or event (speakers, venues)."""
    if user.role == UserRole.PLATFORM_ADMIN or managed_organization_ids(db, user):
        return True
    return db.scalar(
        select(EventStaffAssignment.id).where(
            EventStaffAssignment.user_id == user.id,
            EventStaffAssignment.is_active.is_(True),
            EventStaffAssignment.role == EventAssignmentRole.MANAGER.value,
        ).limit(1)
    ) is not None


def require_organizer(db: Session, user: User) -> None:
    if not is_organizer(db, user):
        raise ForbiddenError("Organizer access required.")


def visible_events_filter(db: Session, user: User) -> ColumnElement[bool]:
    """SQL filter for the events a user may see in the admin console."""
    if user.role == UserRole.PLATFORM_ADMIN:
        return Event.id.is_not(None)
    organization_ids = select(OrganizationMembership.organization_id).where(
        OrganizationMembership.user_id == user.id, OrganizationMembership.is_active.is_(True)
    )
    event_ids = select(EventStaffAssignment.event_id).where(
        EventStaffAssignment.user_id == user.id, EventStaffAssignment.is_active.is_(True)
    )
    return or_(Event.organization_id.in_(organization_ids), Event.id.in_(event_ids))


def require_directory_editor(db: Session, user: User, used_by_organizations: set[uuid.UUID]) -> None:
    """Who may edit or delete a shared speaker or venue.

    Speakers and venues are shared across organizations, so only a platform admin, or an owner/
    admin of *every* organization whose events use the record, may change it. A record no event
    uses yet can be changed by any organization owner/admin.
    """
    if user.role == UserRole.PLATFORM_ADMIN:
        return
    managed = set(managed_organization_ids(db, user))
    if not managed or not used_by_organizations <= managed:
        raise ForbiddenError("This record is used by events you do not manage.")
