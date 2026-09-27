"""Organiser team management: organization memberships and per-event staff, addressed by email.

The `/authorization` routes work with user ids; the console only knows the email a colleague
signed up with, so these helpers resolve the account first and never create one.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Event, EventStaffAssignment, Organization, OrganizationMembership, User
from app.db.models.enums import EventAssignmentRole, OrganizationRole, UserRole
from app.services import audit
from app.services.authorization import Capability, organization_roles, require_event, require_organization_manager
from app.services.errors import ForbiddenError, NotFoundError, ValidationError


def _user_by_email(db: Session, email: str) -> User:
    user = db.scalar(select(User).where(User.email == email.strip().lower()))
    if user is None or not user.is_active:
        raise NotFoundError("No active account uses that email. Ask them to create an account first.")
    return user


def organization_team(
    db: Session, user: User, organization_id: uuid.UUID
) -> tuple[list[tuple[OrganizationMembership, User]], list[tuple[EventStaffAssignment, User]]]:
    """Active members of the organization and active staff on its events."""
    if db.get(Organization, organization_id) is None:
        raise NotFoundError("Organization not found.")
    require_organization_manager(db, user, organization_id)
    members = db.execute(
        select(OrganizationMembership, User)
        .join(User, User.id == OrganizationMembership.user_id)
        .where(OrganizationMembership.organization_id == organization_id, OrganizationMembership.is_active.is_(True))
        .order_by(User.full_name)
    ).all()
    staff = db.execute(
        select(EventStaffAssignment, User)
        .join(User, User.id == EventStaffAssignment.user_id)
        .join(Event, Event.id == EventStaffAssignment.event_id)
        .where(Event.organization_id == organization_id, EventStaffAssignment.is_active.is_(True))
        .order_by(User.full_name)
    ).all()
    return [(m, u) for m, u in members], [(a, u) for a, u in staff]


def add_member(
    db: Session, actor: User, organization_id: uuid.UUID, email: str, role: OrganizationRole
) -> tuple[OrganizationMembership, User]:
    if db.get(Organization, organization_id) is None:
        raise NotFoundError("Organization not found.")
    require_organization_manager(db, actor, organization_id)
    target = _user_by_email(db, email)
    if target.id == actor.id:
        raise ValidationError("You cannot change your own organization role.")
    if role == OrganizationRole.OWNER and actor.role != UserRole.PLATFORM_ADMIN:
        if OrganizationRole.OWNER.value not in organization_roles(db, actor, organization_id):
            raise ForbiddenError("Only an owner can grant the owner role.")
    membership = db.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == organization_id,
            OrganizationMembership.user_id == target.id,
        )
    )
    if membership is None:
        membership = OrganizationMembership(organization_id=organization_id, user_id=target.id)
        db.add(membership)
    membership.role = role
    membership.is_active = True
    audit.record(
        db, "organization.membership_upserted", actor=actor, target_type="user", target_id=target.id,
        details={"organization_id": str(organization_id), "role": role.value},
    )
    db.commit()
    db.refresh(membership)
    return membership, target


def add_event_staff(
    db: Session, actor: User, event_id: uuid.UUID, email: str, role: EventAssignmentRole
) -> tuple[EventStaffAssignment, User]:
    require_event(db, actor, event_id, Capability.MANAGE)
    target = _user_by_email(db, email)
    if target.id == actor.id:
        raise ValidationError("You cannot change your own event role.")
    assignment = db.scalar(
        select(EventStaffAssignment).where(
            EventStaffAssignment.event_id == event_id, EventStaffAssignment.user_id == target.id
        )
    )
    if assignment is None:
        assignment = EventStaffAssignment(event_id=event_id, user_id=target.id)
        db.add(assignment)
    assignment.role = role.value
    assignment.is_active = True
    audit.record(
        db, "event.assignment_upserted", actor=actor, target_type="user", target_id=target.id, event_id=event_id,
        details={"role": role.value},
    )
    db.commit()
    db.refresh(assignment)
    return assignment, target
