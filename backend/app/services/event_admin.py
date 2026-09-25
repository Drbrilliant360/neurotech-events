"""Organiser workflows for events, ticket types, programme sessions, speakers, venues and milestones.

Routes resolve the caller's access with `authorization.require_event` before calling in here,
so these functions enforce business rules (state transitions, capacity, uniqueness) only.
"""

import secrets
import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import distinct, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.db.models import (
    CheckIn,
    Event,
    EventSession,
    Organization,
    Registration,
    Speaker,
    TicketType,
    TimelineMilestone,
    User,
    Venue,
)
from app.db.models.enums import EventStatus, RegistrationStatus
from app.schemas.admin_events import (
    AdminEventOut,
    AdminTicketTypeOut,
    EventCounts,
    EventCreate,
    EventStatusChange,
    EventUpdate,
    MilestoneFields,
    MilestoneOut,
    MilestoneUpdate,
    SessionFields,
    SessionOut,
    SessionUpdate,
    SpeakerFields,
    SpeakerOut,
    SpeakerUpdate,
    TicketTypeCreate,
    TicketTypeUpdate,
    VenueFields,
    VenueOut,
    VenueUpdate,
    validate_event_times,
)
from app.services import audit, inventory
from app.services.authorization import (
    managed_organization_ids,
    require_directory_editor,
    require_organization_manager,
    visible_events_filter,
)
from app.services.errors import ConflictError, NotFoundError, ValidationError

STATUS_TRANSITIONS: dict[EventStatus, set[EventStatus]] = {
    EventStatus.DRAFT: {EventStatus.PUBLISHED, EventStatus.CANCELLED},
    EventStatus.PUBLISHED: {EventStatus.DRAFT, EventStatus.ONGOING, EventStatus.COMPLETED, EventStatus.CANCELLED},
    EventStatus.ONGOING: {EventStatus.COMPLETED, EventStatus.CANCELLED},
    EventStatus.COMPLETED: set(),
    EventStatus.CANCELLED: set(),
}
EDITABLE_STATUSES = {EventStatus.DRAFT, EventStatus.PUBLISHED, EventStatus.ONGOING}


def _aware(value: datetime | None) -> datetime | None:
    return value.replace(tzinfo=UTC) if value is not None and value.tzinfo is None else value


def _apply(instance: Any, changes: dict[str, Any], required: set[str]) -> None:
    for key, value in changes.items():
        if value is None and key in required:
            raise ValidationError(f"'{key}' cannot be null.")
        setattr(instance, key, value)


def _initials(name: str) -> str:
    return "".join(part[0] for part in name.split()[:2]).upper()


# --------------------------------------------------------------------- events


def event_counts(db: Session, event_ids: list[uuid.UUID]) -> dict[uuid.UUID, EventCounts]:
    counts = {event_id: EventCounts() for event_id in event_ids}
    if not event_ids:
        return counts
    for event_id, status, total in db.execute(
        select(Registration.event_id, Registration.status, func.count())
        .where(Registration.event_id.in_(event_ids))
        .group_by(Registration.event_id, Registration.status)
    ):
        item = counts[event_id]
        if status == RegistrationStatus.CONFIRMED:
            item.confirmed = total
        elif status == RegistrationStatus.PENDING:
            item.pending = total
        if status != RegistrationStatus.CANCELLED:
            item.registrations += total
    for event_id, total in db.execute(
        select(CheckIn.event_id, func.count(distinct(CheckIn.registration_id)))
        .where(CheckIn.event_id.in_(event_ids), CheckIn.undone.is_(False))
        .group_by(CheckIn.event_id)
    ):
        counts[event_id].checked_in = total
    return counts


def to_event_out(event: Event, counts: EventCounts) -> AdminEventOut:
    return AdminEventOut(
        id=event.id,
        organization_id=event.organization_id,
        slug=event.slug,
        title=event.title,
        subtitle=event.subtitle,
        description=event.description,
        theme=event.theme,
        category=event.category,
        status=event.status.value,
        format=event.format.value,
        starts_at=event.starts_at,
        ends_at=event.ends_at,
        capacity=event.capacity,
        registration_opens_at=event.registration_opens_at,
        registration_closes_at=event.registration_closes_at,
        featured=event.featured,
        banner_label=event.banner_label,
        highlights=list(event.highlights or []),
        faqs=list(event.faqs or []),
        venue=VenueOut.model_validate(event.venue) if event.venue else None,
        counts=counts,
        created_at=event.created_at,
        updated_at=event.updated_at,
    )


def event_out(db: Session, event: Event) -> AdminEventOut:
    return to_event_out(event, event_counts(db, [event.id])[event.id])


def list_events(
    db: Session, user: User, *, status: EventStatus | None, q: str | None, page: int, page_size: int
) -> tuple[list[AdminEventOut], int]:
    conditions = [visible_events_filter(db, user)]
    if status is not None:
        conditions.append(Event.status == status)
    if q:
        pattern = f"%{q.strip().lower()}%"
        conditions.append(or_(func.lower(Event.title).like(pattern), func.lower(Event.slug).like(pattern)))
    total = db.scalar(select(func.count()).select_from(Event).where(*conditions)) or 0
    events = list(
        db.scalars(
            select(Event)
            .options(selectinload(Event.venue))
            .where(*conditions)
            .order_by(Event.starts_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    counts = event_counts(db, [event.id for event in events])
    return [to_event_out(event, counts[event.id]) for event in events], total


def _check_venue(db: Session, venue_id: uuid.UUID | None) -> None:
    if venue_id is not None and db.get(Venue, venue_id) is None:
        raise ValidationError("Venue not found.")


def _check_slug_free(db: Session, slug: str, *, exclude: uuid.UUID | None = None) -> None:
    query = select(Event.id).where(Event.slug == slug)
    if exclude is not None:
        query = query.where(Event.id != exclude)
    if db.scalar(query) is not None:
        raise ConflictError(f"An event with slug '{slug}' already exists.", code="slug_in_use")


def create_event(db: Session, user: User, payload: EventCreate) -> Event:
    organization_id = payload.organization_id
    if organization_id is None:
        managed = managed_organization_ids(db, user)
        if len(managed) != 1:
            raise ValidationError("organization_id is required when you manage zero or several organizations.")
        organization_id = managed[0]
    if db.get(Organization, organization_id) is None:
        raise NotFoundError("Organization not found.")
    require_organization_manager(db, user, organization_id)
    _check_slug_free(db, payload.slug)
    _check_venue(db, payload.venue_id)

    event = Event(
        organization_id=organization_id,
        status=EventStatus.DRAFT,
        **payload.model_dump(exclude={"organization_id"}),
    )
    db.add(event)
    db.flush()
    audit.record(db, "event.created", actor=user, target_type="event", target_id=event.id, event_id=event.id)
    db.commit()
    return event


def update_event(db: Session, user: User, event: Event, payload: EventUpdate) -> Event:
    if event.status not in EDITABLE_STATUSES:
        raise ConflictError(f"A {event.status.value} event can no longer be edited.")
    changes = payload.model_dump(exclude_unset=True)
    if "slug" in changes and changes["slug"] != event.slug:
        if event.status != EventStatus.DRAFT:
            raise ConflictError("The slug can only change while the event is a draft; public links depend on it.")
        _check_slug_free(db, changes["slug"], exclude=event.id)
    if "venue_id" in changes:
        _check_venue(db, changes["venue_id"])
    _apply(event, changes, {"slug", "title", "format", "starts_at", "ends_at", "capacity", "featured"})
    for key in ("highlights", "faqs"):
        if key in changes and changes[key] is None:
            setattr(event, key, [])
    try:
        validate_event_times(
            _aware(event.starts_at), _aware(event.ends_at),
            _aware(event.registration_opens_at), _aware(event.registration_closes_at),
        )
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc
    audit.record(
        db, "event.updated", actor=user, target_type="event", target_id=event.id, event_id=event.id,
        details={"fields": sorted(changes)},
    )
    db.commit()
    return event


def change_event_status(db: Session, user: User, event: Event, payload: EventStatusChange) -> Event:
    current, target = event.status, payload.status
    if target == current:
        return event
    if target not in STATUS_TRANSITIONS[current]:
        raise ConflictError(f"An event cannot move from {current.value} to {target.value}.", code="invalid_transition")
    if target == EventStatus.DRAFT and _registration_total(db, event.id):
        raise ConflictError("An event with registrations cannot return to draft; cancel it instead.")
    event.status = target
    audit.record(
        db, "event.status_changed", actor=user, target_type="event", target_id=event.id, event_id=event.id,
        details={"from": current.value, "to": target.value, "reason": payload.reason},
    )
    db.commit()
    return event


def _registration_total(db: Session, event_id: uuid.UUID) -> int:
    return db.scalar(select(func.count()).select_from(Registration).where(Registration.event_id == event_id)) or 0


def delete_event(db: Session, user: User, event: Event) -> None:
    if event.status not in {EventStatus.DRAFT, EventStatus.CANCELLED}:
        raise ConflictError("Only draft or cancelled events can be deleted.")
    if _registration_total(db, event.id):
        raise ConflictError("Events with registrations are kept for the record and cannot be deleted.")
    audit.record(
        db, "event.deleted", actor=user, target_type="event", target_id=event.id, details={"slug": event.slug}
    )
    db.delete(event)
    db.commit()


# --------------------------------------------------------------- ticket types


def to_ticket_out(ticket: TicketType, sold: int) -> AdminTicketTypeOut:
    return AdminTicketTypeOut(
        id=ticket.id,
        event_id=ticket.event_id,
        code=ticket.code,
        name=ticket.name,
        tier=ticket.tier,
        price=int(ticket.price),
        currency=ticket.currency,
        perks=ticket.perks,
        capacity=ticket.capacity,
        sold=sold,
        available=max(ticket.capacity - sold, 0),
        sales_start_at=ticket.sales_start_at,
        sales_end_at=ticket.sales_end_at,
        active=ticket.active,
        sort_order=ticket.sort_order,
    )


def list_ticket_types(db: Session, event: Event) -> list[AdminTicketTypeOut]:
    tickets = list(
        db.scalars(
            select(TicketType).where(TicketType.event_id == event.id).order_by(TicketType.sort_order, TicketType.name)
        )
    )
    sold = inventory.taken_by_ticket_type(db, [ticket.id for ticket in tickets])
    return [to_ticket_out(ticket, sold.get(ticket.id, 0)) for ticket in tickets]


def ticket_out(db: Session, ticket: TicketType) -> AdminTicketTypeOut:
    return to_ticket_out(ticket, inventory.taken_by_ticket_type(db, [ticket.id]).get(ticket.id, 0))


def _ticket(db: Session, event: Event, ticket_id: uuid.UUID) -> TicketType:
    ticket = db.get(TicketType, ticket_id)
    if ticket is None or ticket.event_id != event.id:
        raise NotFoundError("Ticket type not found for this event.")
    return ticket


def create_ticket_type(db: Session, user: User, event: Event, payload: TicketTypeCreate) -> TicketType:
    code = payload.code or f"tt_{secrets.token_hex(4)}"
    if db.scalar(select(TicketType.id).where(TicketType.event_id == event.id, TicketType.code == code)):
        raise ConflictError(f"Ticket code '{code}' is already used for this event.", code="code_in_use")
    values = payload.model_dump(exclude={"code", "currency", "price"})
    ticket = TicketType(
        event_id=event.id,
        code=code,
        price=Decimal(payload.price),
        currency=payload.currency or event.organization.default_currency,
        **values,
    )
    db.add(ticket)
    db.flush()
    audit.record(
        db, "ticket_type.created", actor=user, target_type="ticket_type", target_id=ticket.id, event_id=event.id,
        details={"code": code, "price": payload.price, "capacity": payload.capacity},
    )
    db.commit()
    return ticket


def update_ticket_type(
    db: Session, user: User, event: Event, ticket_id: uuid.UUID, payload: TicketTypeUpdate
) -> TicketType:
    ticket = _ticket(db, event, ticket_id)
    changes = payload.model_dump(exclude_unset=True)
    if changes.get("capacity") is not None:
        sold = inventory.taken_by_ticket_type(db, [ticket.id]).get(ticket.id, 0)
        if changes["capacity"] < sold:
            raise ConflictError(f"Capacity cannot drop below the {sold} seats already taken.")
    if "price" in changes and changes["price"] is not None:
        changes["price"] = Decimal(changes["price"])
    _apply(ticket, changes, {"name", "tier", "price", "capacity", "active", "sort_order"})
    start, end = _aware(ticket.sales_start_at), _aware(ticket.sales_end_at)
    if start and end and end < start:
        raise ValidationError("sales_end_at must not be before sales_start_at")
    audit.record(
        db, "ticket_type.updated", actor=user, target_type="ticket_type", target_id=ticket.id, event_id=event.id,
        details={k: (str(v) if isinstance(v, Decimal | datetime) else v) for k, v in changes.items()},
    )
    db.commit()
    return ticket


def delete_ticket_type(db: Session, user: User, event: Event, ticket_id: uuid.UUID) -> None:
    ticket = _ticket(db, event, ticket_id)
    if db.scalar(select(func.count()).select_from(Registration).where(Registration.ticket_type_id == ticket.id)):
        raise ConflictError("This ticket type has registrations; deactivate it instead of deleting it.")
    audit.record(
        db, "ticket_type.deleted", actor=user, target_type="ticket_type", target_id=ticket.id, event_id=event.id,
        details={"code": ticket.code},
    )
    db.delete(ticket)
    db.commit()


# -------------------------------------------------------------------- program


def to_session_out(session: EventSession) -> SessionOut:
    return SessionOut(
        id=session.id,
        event_id=session.event_id,
        title=session.title,
        day_index=session.day_index,
        day_label=session.day_label,
        session_date=session.session_date,
        start_time=session.start_time,
        end_time=session.end_time,
        room=session.room,
        session_type=session.session_type.value,
        description=session.description,
        speaker_label=session.speaker_label or (session.speaker.name if session.speaker else None),
        speaker=SpeakerOut.model_validate(session.speaker) if session.speaker else None,
    )


def list_sessions(db: Session, event_id: uuid.UUID) -> list[EventSession]:
    return list(
        db.scalars(
            select(EventSession)
            .options(selectinload(EventSession.speaker))
            .where(EventSession.event_id == event_id)
            .order_by(EventSession.session_date, EventSession.start_time, EventSession.title)
        )
    )


def _session(db: Session, event: Event, session_id: uuid.UUID) -> EventSession:
    session = db.get(EventSession, session_id)
    if session is None or session.event_id != event.id:
        raise NotFoundError("Session not found for this event.")
    return session


def _check_session_date(event: Event, session_date: date) -> int:
    first_day = _aware(event.starts_at).date()
    last_day = _aware(event.ends_at).date()
    # One day of slack either side absorbs timezone differences between the event and UTC.
    if not first_day - timedelta(days=1) <= session_date <= last_day + timedelta(days=1):
        raise ValidationError("The session date must fall within the event dates.")
    return max(0, (session_date - first_day).days)


def _check_speaker(db: Session, speaker_id: uuid.UUID | None) -> None:
    if speaker_id is not None and db.get(Speaker, speaker_id) is None:
        raise ValidationError("Speaker not found.")


def create_session(db: Session, user: User, event: Event, payload: SessionFields) -> EventSession:
    _check_speaker(db, payload.speaker_id)
    session = EventSession(
        event_id=event.id, day_index=_check_session_date(event, payload.session_date), **payload.model_dump()
    )
    db.add(session)
    db.flush()
    audit.record(db, "session.created", actor=user, target_type="session", target_id=session.id, event_id=event.id)
    db.commit()
    return session


def update_session(
    db: Session, user: User, event: Event, session_id: uuid.UUID, payload: SessionUpdate
) -> EventSession:
    session = _session(db, event, session_id)
    changes = payload.model_dump(exclude_unset=True)
    if "speaker_id" in changes:
        _check_speaker(db, changes["speaker_id"])
    _apply(session, changes, {"title", "session_date", "start_time", "end_time", "session_type"})
    if session.end_time <= session.start_time:
        raise ValidationError("end_time must be after start_time")
    session.day_index = _check_session_date(event, session.session_date)
    audit.record(db, "session.updated", actor=user, target_type="session", target_id=session.id, event_id=event.id)
    db.commit()
    return session


def delete_session(db: Session, user: User, event: Event, session_id: uuid.UUID) -> None:
    session = _session(db, event, session_id)
    audit.record(db, "session.deleted", actor=user, target_type="session", target_id=session.id, event_id=event.id)
    db.delete(session)
    db.commit()


def list_milestones(db: Session, event_id: uuid.UUID) -> list[TimelineMilestone]:
    return list(
        db.scalars(
            select(TimelineMilestone)
            .where(TimelineMilestone.event_id == event_id)
            .order_by(TimelineMilestone.milestone_date, TimelineMilestone.title)
        )
    )


def to_milestone_out(milestone: TimelineMilestone) -> MilestoneOut:
    return MilestoneOut(
        id=milestone.id,
        event_id=milestone.event_id,
        title=milestone.title,
        milestone_date=milestone.milestone_date,
        status=milestone.status.value,
        day_index=milestone.day_index,
    )


def _milestone(db: Session, event: Event, milestone_id: uuid.UUID) -> TimelineMilestone:
    milestone = db.get(TimelineMilestone, milestone_id)
    if milestone is None or milestone.event_id != event.id:
        raise NotFoundError("Milestone not found for this event.")
    return milestone


def create_milestone(db: Session, user: User, event: Event, payload: MilestoneFields) -> TimelineMilestone:
    milestone = TimelineMilestone(event_id=event.id, **payload.model_dump())
    db.add(milestone)
    db.flush()
    audit.record(
        db, "milestone.created", actor=user, target_type="milestone", target_id=milestone.id, event_id=event.id
    )
    db.commit()
    return milestone


def update_milestone(
    db: Session, user: User, event: Event, milestone_id: uuid.UUID, payload: MilestoneUpdate
) -> TimelineMilestone:
    milestone = _milestone(db, event, milestone_id)
    _apply(milestone, payload.model_dump(exclude_unset=True), {"title", "milestone_date", "status"})
    audit.record(
        db, "milestone.updated", actor=user, target_type="milestone", target_id=milestone.id, event_id=event.id
    )
    db.commit()
    return milestone


def delete_milestone(db: Session, user: User, event: Event, milestone_id: uuid.UUID) -> None:
    milestone = _milestone(db, event, milestone_id)
    audit.record(
        db, "milestone.deleted", actor=user, target_type="milestone", target_id=milestone.id, event_id=event.id
    )
    db.delete(milestone)
    db.commit()


# ------------------------------------------------------- speakers and venues


def list_speakers(db: Session, *, q: str | None, page: int, page_size: int) -> tuple[list[Speaker], int]:
    conditions = []
    if q:
        conditions.append(func.lower(Speaker.name).like(f"%{q.strip().lower()}%"))
    total = db.scalar(select(func.count()).select_from(Speaker).where(*conditions)) or 0
    items = list(
        db.scalars(
            select(Speaker).where(*conditions).order_by(Speaker.name).offset((page - 1) * page_size).limit(page_size)
        )
    )
    return items, total


def _speaker(db: Session, speaker_id: uuid.UUID) -> Speaker:
    speaker = db.get(Speaker, speaker_id)
    if speaker is None:
        raise NotFoundError("Speaker not found.")
    return speaker


def _speaker_organizations(db: Session, speaker_id: uuid.UUID) -> set[uuid.UUID]:
    return set(
        db.scalars(
            select(Event.organization_id).join(EventSession, EventSession.event_id == Event.id)
            .where(EventSession.speaker_id == speaker_id).distinct()
        )
    )


def _venue_organizations(db: Session, venue_id: uuid.UUID) -> set[uuid.UUID]:
    return set(db.scalars(select(Event.organization_id).where(Event.venue_id == venue_id).distinct()))


def create_speaker(db: Session, user: User, payload: SpeakerFields) -> Speaker:
    speaker = Speaker(**payload.model_dump())
    speaker.initials = speaker.initials or _initials(speaker.name)
    db.add(speaker)
    db.flush()
    audit.record(db, "speaker.created", actor=user, target_type="speaker", target_id=speaker.id)
    db.commit()
    return speaker


def update_speaker(db: Session, user: User, speaker_id: uuid.UUID, payload: SpeakerUpdate) -> Speaker:
    speaker = _speaker(db, speaker_id)
    require_directory_editor(db, user, _speaker_organizations(db, speaker.id))
    _apply(speaker, payload.model_dump(exclude_unset=True), {"name"})
    audit.record(db, "speaker.updated", actor=user, target_type="speaker", target_id=speaker.id)
    db.commit()
    return speaker


def delete_speaker(db: Session, user: User, speaker_id: uuid.UUID) -> None:
    speaker = _speaker(db, speaker_id)
    require_directory_editor(db, user, _speaker_organizations(db, speaker.id))
    audit.record(db, "speaker.deleted", actor=user, target_type="speaker", target_id=speaker.id)
    db.delete(speaker)
    db.commit()


def list_venues(db: Session) -> list[Venue]:
    return list(db.scalars(select(Venue).order_by(Venue.name)))


def create_venue(db: Session, user: User, payload: VenueFields) -> Venue:
    name = payload.name.strip()
    if db.scalar(select(Venue.id).where(func.lower(Venue.name) == name.lower())):
        raise ConflictError(f"A venue named '{name}' already exists.")
    venue = Venue(**{**payload.model_dump(), "name": name})
    db.add(venue)
    db.flush()
    audit.record(db, "venue.created", actor=user, target_type="venue", target_id=venue.id)
    db.commit()
    return venue


def update_venue(db: Session, user: User, venue_id: uuid.UUID, payload: VenueUpdate) -> Venue:
    venue = db.get(Venue, venue_id)
    if venue is None:
        raise NotFoundError("Venue not found.")
    require_directory_editor(db, user, _venue_organizations(db, venue.id))
    _apply(venue, payload.model_dump(exclude_unset=True), {"name"})
    audit.record(db, "venue.updated", actor=user, target_type="venue", target_id=venue.id)
    db.commit()
    return venue
