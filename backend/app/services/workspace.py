"""Aggregate reads for the public site and the organiser console.

Each builder issues a fixed number of queries regardless of how many events exist, so a client
can hydrate a whole screen in one round trip instead of one request per event.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.db.models import (
    CheckIn,
    Event,
    EventSession,
    Organization,
    OrganizationMembership,
    Payment,
    Registration,
    Speaker,
    TicketType,
    TimelineMilestone,
    User,
    Venue,
)
from app.db.models.enums import UserRole
from app.schemas.admin_events import SpeakerOut, VenueOut
from app.schemas.authorization import EventAccessResponse
from app.schemas.workspace import AdminWorkspaceOut, OrganizationOut, PublicCatalogueOut
from app.services import event_admin, inventory, operations
from app.services.authorization import access_for_events, is_organizer, visible_events_filter
from app.services.catalogue import PUBLIC_STATUSES, event_detail
from app.services.payments import PaymentService

# Registrations, check-ins and payments per workspace load. Larger events should page through
# the per-event endpoints instead; the cap keeps one request bounded.
WORKSPACE_ROW_LIMIT = 5000


def _primary_organization(db: Session, event_org_ids: list[uuid.UUID]) -> Organization | None:
    if event_org_ids:
        most_common = max(set(event_org_ids), key=event_org_ids.count)
        return db.get(Organization, most_common)
    return db.scalar(select(Organization).order_by(Organization.created_at).limit(1))


def _programme(db: Session, event_ids: list[uuid.UUID]):
    if not event_ids:
        return [], []
    sessions = list(
        db.scalars(
            select(EventSession)
            .options(joinedload(EventSession.speaker))
            .where(EventSession.event_id.in_(event_ids))
            .order_by(EventSession.session_date, EventSession.start_time)
        )
    )
    milestones = list(
        db.scalars(
            select(TimelineMilestone)
            .where(TimelineMilestone.event_id.in_(event_ids))
            .order_by(TimelineMilestone.milestone_date)
        )
    )
    return sessions, milestones


def public_catalogue(db: Session) -> PublicCatalogueOut:
    events = list(
        db.scalars(
            select(Event)
            .options(joinedload(Event.venue), selectinload(Event.ticket_types))
            .where(Event.status.in_(PUBLIC_STATUSES))
            .order_by(Event.starts_at)
        )
    )
    event_ids = [event.id for event in events]
    sold = inventory.taken_by_ticket_type(db, [ticket.id for event in events for ticket in event.ticket_types])
    sessions, milestones = _programme(db, event_ids)
    speakers = {session.speaker.id: session.speaker for session in sessions if session.speaker is not None}
    venues = {event.venue.id: event.venue for event in events if event.venue is not None}
    organization = _primary_organization(db, [event.organization_id for event in events])
    return PublicCatalogueOut(
        organization=OrganizationOut.model_validate(organization) if organization else None,
        events=[event_detail(event, sold) for event in events],
        venues=[VenueOut.model_validate(venue) for venue in venues.values()],
        sessions=[event_admin.to_session_out(item) for item in sessions],
        speakers=sorted((SpeakerOut.model_validate(item) for item in speakers.values()), key=lambda s: s.name),
        milestones=[event_admin.to_milestone_out(item) for item in milestones],
    )


def _organizations(db: Session, user: User) -> list[Organization]:
    if user.role == UserRole.PLATFORM_ADMIN:
        return list(db.scalars(select(Organization).order_by(Organization.name)))
    member_of = select(OrganizationMembership.organization_id).where(
        OrganizationMembership.user_id == user.id, OrganizationMembership.is_active.is_(True)
    )
    return list(db.scalars(select(Organization).where(Organization.id.in_(member_of)).order_by(Organization.name)))


def admin_workspace(db: Session, user: User, service: PaymentService) -> AdminWorkspaceOut:
    events = list(
        db.scalars(
            select(Event)
            .options(joinedload(Event.venue))
            .where(visible_events_filter(db, user))
            .order_by(Event.starts_at.desc())
        )
    )
    access = access_for_events(db, user, events)
    event_ids = [event.id for event in events]
    manage_ids = [event_id for event_id in event_ids if access[event_id].can_manage_event]
    check_in_ids = [event_id for event_id in event_ids if access[event_id].can_check_in]
    finance_ids = [event_id for event_id in event_ids if access[event_id].can_manage_finance]

    counts = event_admin.event_counts(db, event_ids)
    tickets = (
        list(db.scalars(select(TicketType).where(TicketType.event_id.in_(event_ids)).order_by(TicketType.sort_order)))
        if event_ids
        else []
    )
    sold = inventory.taken_by_ticket_type(db, [ticket.id for ticket in tickets])
    sessions, milestones = _programme(db, event_ids)

    if is_organizer(db, user):
        speakers = list(db.scalars(select(Speaker).order_by(Speaker.name)))
        venues = list(db.scalars(select(Venue).order_by(Venue.name)))
    else:
        speakers = [session.speaker for session in sessions if session.speaker is not None]
        venues = [event.venue for event in events if event.venue is not None]

    registrations = []
    if manage_ids:
        rows = list(
            db.scalars(
                select(Registration)
                .options(joinedload(Registration.attendee), joinedload(Registration.ticket_type))
                .where(Registration.event_id.in_(manage_ids))
                .order_by(Registration.created_at.desc())
                .limit(WORKSPACE_ROW_LIMIT)
            )
        )
        ids = [row.id for row in rows]
        paid, active = operations._amounts_paid(db, ids), operations._active_check_ins(db, ids)
        registrations = [operations._to_out(row, paid, active) for row in rows]

    check_ins = []
    if check_in_ids:
        records = list(
            db.scalars(
                select(CheckIn)
                .options(
                    joinedload(CheckIn.registration).joinedload(Registration.attendee),
                    joinedload(CheckIn.registration).joinedload(Registration.ticket_type),
                    joinedload(CheckIn.checked_in_by),
                )
                .where(CheckIn.event_id.in_(check_in_ids))
                .order_by(CheckIn.checked_in_at.desc())
                .limit(WORKSPACE_ROW_LIMIT)
            )
        )
        check_ins = [operations._check_in_out(item, item.registration, item.checked_in_by) for item in records]

    payments = []
    if finance_ids:
        rows = db.scalars(
            service._payment_query()
            .where(Payment.event_id.in_(finance_ids))
            .order_by(Payment.created_at.desc())
            .limit(WORKSPACE_ROW_LIMIT)
        )
        payments = [service.to_out(item) for item in rows]

    return AdminWorkspaceOut(
        organizations=[OrganizationOut.model_validate(item) for item in _organizations(db, user)],
        events=[event_admin.to_event_out(event, counts[event.id]) for event in events],
        access=[
            EventAccessResponse(
                event_id=item.event_id,
                organization_id=item.organization_id,
                is_platform_admin=item.is_platform_admin,
                organization_roles=list(item.organization_roles),
                event_roles=list(item.event_roles),
                can_manage_event=item.can_manage_event,
                can_manage_finance=item.can_manage_finance,
                can_check_in=item.can_check_in,
            )
            for item in access.values()
        ],
        ticket_types=[event_admin.to_ticket_out(ticket, sold.get(ticket.id, 0)) for ticket in tickets],
        sessions=[event_admin.to_session_out(item) for item in sessions],
        milestones=[event_admin.to_milestone_out(item) for item in milestones],
        speakers=[SpeakerOut.model_validate(item) for item in {s.id: s for s in speakers}.values()],
        venues=[VenueOut.model_validate(item) for item in {v.id: v for v in venues}.values()],
        registrations=registrations,
        check_ins=check_ins,
        payments=payments,
    )

