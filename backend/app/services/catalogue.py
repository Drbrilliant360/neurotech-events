"""Public catalogue reads and the admin catalogue sync.

The admin console keeps its own local event data; syncing pushes that catalogue here so live
payments can price tickets the console created. Rows are keyed by the console's identifiers
(event slug, ticket code) with deterministic UUIDs, so repeated syncs update in place.
"""

import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.db.models import Event, Organization, Registration, TicketType, Venue
from app.db.models.enums import EventFormat, EventStatus, RegistrationStatus
from app.db.seed import ORGANIZATION, seed_id
from app.schemas.events import (
    CatalogueSyncIn,
    CatalogueSyncOut,
    EventDetailOut,
    EventSummaryOut,
    TicketQuoteOut,
    TicketTypeOut,
    VenueOut,
)
from app.services.payments import MIN_AMOUNT_TZS, NotFoundError, ValidationError, compute_total

PUBLIC_STATUSES = (EventStatus.PUBLISHED, EventStatus.ONGOING, EventStatus.COMPLETED)


def _sold_counts(db: Session, ticket_type_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    if not ticket_type_ids:
        return {}
    rows = db.execute(
        select(Registration.ticket_type_id, func.count())
        .where(Registration.ticket_type_id.in_(ticket_type_ids), Registration.status != RegistrationStatus.CANCELLED)
        .group_by(Registration.ticket_type_id)
    ).all()
    return {ticket_type_id: count for ticket_type_id, count in rows}


def _venue_out(venue: Venue | None) -> VenueOut | None:
    return VenueOut(id=venue.id, name=venue.name, city=venue.city, country=venue.country) if venue else None


def _summary(event: Event) -> EventSummaryOut:
    return EventSummaryOut(
        id=event.id,
        slug=event.slug,
        title=event.title,
        subtitle=event.subtitle,
        category=event.category,
        status=event.status.value,
        format=event.format.value,
        starts_at=event.starts_at,
        ends_at=event.ends_at,
        capacity=event.capacity,
        featured=event.featured,
        venue=_venue_out(event.venue),
    )


def list_public_events(db: Session) -> list[EventSummaryOut]:
    events = db.scalars(
        select(Event)
        .options(selectinload(Event.venue))
        .where(Event.status.in_(PUBLIC_STATUSES))
        .order_by(Event.starts_at.asc())
    ).all()
    return [_summary(event) for event in events]


def get_public_event(db: Session, slug: str) -> EventDetailOut:
    event = db.scalar(
        select(Event).options(selectinload(Event.venue), selectinload(Event.ticket_types)).where(Event.slug == slug)
    )
    if event is None or event.status not in PUBLIC_STATUSES:
        raise NotFoundError("Event not found.")
    sold = _sold_counts(db, [ticket.id for ticket in event.ticket_types])
    summary = _summary(event)
    return EventDetailOut(
        **summary.model_dump(),
        description=event.description,
        theme=event.theme,
        registration_opens_at=event.registration_opens_at,
        registration_closes_at=event.registration_closes_at,
        highlights=list(event.highlights or []),
        faqs=list(event.faqs or []),
        ticket_types=[
            TicketTypeOut(
                id=ticket.id,
                code=ticket.code,
                name=ticket.name,
                tier=ticket.tier,
                price=int(ticket.price),
                currency=ticket.currency,
                perks=ticket.perks,
                capacity=ticket.capacity,
                sold=sold.get(ticket.id, 0),
                active=ticket.active,
            )
            for ticket in sorted(event.ticket_types, key=lambda item: (item.sort_order, item.name))
        ],
    )


def quote_ticket(db: Session, slug: str, code: str) -> TicketQuoteOut:
    event = db.scalar(select(Event).options(selectinload(Event.organization)).where(Event.slug == slug))
    if event is None:
        raise NotFoundError("Event not found.")
    ticket = db.scalar(select(TicketType).where(TicketType.event_id == event.id, TicketType.code == code))
    if ticket is None:
        raise NotFoundError("Ticket type not found for this event.")
    vat_percent = event.organization.vat_percent
    total = compute_total(ticket.price, vat_percent)
    price = int(ticket.price)
    sold = _sold_counts(db, [ticket.id]).get(ticket.id, 0)
    return TicketQuoteOut(
        event_slug=event.slug,
        code=code,
        name=ticket.name,
        tier=ticket.tier,
        currency=ticket.currency,
        price=price,
        vat_percent=vat_percent,
        vat=total - price,
        total=total,
        active=ticket.active,
        capacity=ticket.capacity,
        sold=sold,
        available=max(ticket.capacity - sold, 0),
        payable_online=ticket.active
        and total >= MIN_AMOUNT_TZS
        and event.status in (EventStatus.PUBLISHED, EventStatus.ONGOING),
    )


def _parse_enum(enum_cls, value: str, field: str):
    try:
        return enum_cls(value)
    except ValueError as exc:
        allowed = ", ".join(member.value for member in enum_cls)
        raise ValidationError(f"Unknown {field} '{value}'. Allowed: {allowed}.") from exc


def sync_catalogue(db: Session, payload: CatalogueSyncIn) -> CatalogueSyncOut:
    organization = db.get(Organization, ORGANIZATION["id"])
    if organization is None:
        organization = Organization(**ORGANIZATION)
        db.add(organization)
        db.flush()
    if payload.vat_percent is not None:
        organization.vat_percent = Decimal(payload.vat_percent)

    event_ids: dict[str, uuid.UUID] = {}
    for item in payload.events:
        if item.ends_at < item.starts_at:
            raise ValidationError(f"Event '{item.slug}' ends before it starts.")
        status = _parse_enum(EventStatus, item.status, "event status")
        fmt = _parse_enum(EventFormat, item.format, "event format")
        venue_id = None
        if item.venue_name:
            name = item.venue_name.strip()
            venue = db.scalar(select(Venue).where(func.lower(Venue.name) == name.lower()))
            if venue is None:
                venue = Venue(id=seed_id(f"venue:{name.lower()}"), name=name, city=item.venue_city, country="Tanzania")
                db.add(venue)
                db.flush()
            elif item.venue_city:
                venue.city = item.venue_city
            venue_id = venue.id
        # Prefer an existing row with this slug so re-slugged console ids never duplicate an event.
        event = db.scalar(select(Event).where(Event.slug == item.slug)) or db.get(Event, seed_id(item.id))
        if event is None:
            event = Event(id=seed_id(item.id), organization_id=organization.id, slug=item.slug)
            db.add(event)
        event.slug = item.slug
        event.title = item.title
        event.subtitle = item.subtitle
        event.description = item.description
        event.theme = item.theme
        event.category = item.category
        event.status = status
        event.format = fmt
        event.starts_at = item.starts_at
        event.ends_at = item.ends_at
        event.capacity = item.capacity
        event.registration_opens_at = item.registration_opens_at
        event.registration_closes_at = item.registration_closes_at
        event.featured = item.featured
        event.banner_label = item.banner_label
        event.highlights = list(item.highlights)
        event.faqs = list(item.faqs)
        event.venue_id = venue_id
        db.flush()
        event_ids[item.id] = event.id

    tickets_upserted = 0
    for item in payload.ticket_types:
        event_uuid = event_ids.get(item.event_id)
        if event_uuid is None:
            raise ValidationError(f"Ticket '{item.id}' references unknown event '{item.event_id}'.")
        ticket = db.scalar(select(TicketType).where(TicketType.event_id == event_uuid, TicketType.code == item.id))
        if ticket is None:
            ticket = TicketType(id=seed_id(item.id), event_id=event_uuid, code=item.id)
            db.add(ticket)
        ticket.name = item.name
        ticket.tier = item.tier
        ticket.price = Decimal(item.price)
        ticket.currency = item.currency.upper()
        ticket.perks = item.perks
        ticket.capacity = item.capacity
        ticket.active = item.active
        tickets_upserted += 1

    # Tickets the console no longer lists stop selling but keep their registrations.
    synced_codes = {item.id for item in payload.ticket_types}
    deactivated = 0
    for event_uuid in event_ids.values():
        for ticket in db.scalars(select(TicketType).where(TicketType.event_id == event_uuid)):
            if ticket.code not in synced_codes and ticket.active:
                ticket.active = False
                deactivated += 1

    organization.updated_at = datetime.now(UTC)
    db.commit()
    return CatalogueSyncOut(
        events_upserted=len(event_ids), ticket_types_upserted=tickets_upserted, ticket_types_deactivated=deactivated
    )
