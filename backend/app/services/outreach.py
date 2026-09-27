"""Organiser outreach: event sponsors and communications.

Sponsors are shared records linked to events, governed like speakers and venues: linking a
sponsor to an event needs manage access on that event, and editing a sponsor needs owner/admin
rights over every organization whose events it is linked to.

Communications are recorded per event. Sending delivers an in-app notification to the chosen
audience; email, SMS and push need a delivery provider that is not configured yet, so they are
reported as not delivered rather than pretended.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import exists, select
from sqlalchemy.orm import Session, selectinload

from app.db.models import CheckIn, Communication, Event, Payment, Registration, Sponsor, SponsorEvent, TicketType, User
from app.db.models.enums import (
    AudienceSegment,
    CommunicationStatus,
    NotificationCategory,
    PaymentStatus,
    RegistrationStatus,
)
from app.schemas.engagement import (
    CommunicationFields,
    CommunicationUpdate,
    PublicSponsorOut,
    SponsorFields,
    SponsorOut,
    SponsorUpdate,
)
from app.services import audit
from app.services.authorization import Capability, require_directory_editor, require_event, require_organizer
from app.services.catalogue import PUBLIC_STATUSES
from app.services.errors import ConflictError, NotFoundError
from app.services.notifications import notify

EXTERNAL_DELIVERY_NOTE = "not_configured: no email/SMS/push provider yet; delivered in-app only"

# ------------------------------------------------------------------- sponsors


def to_sponsor_out(sponsor: Sponsor) -> SponsorOut:
    return SponsorOut(
        id=sponsor.id, name=sponsor.name, tier=sponsor.tier, website=sponsor.website, contact=sponsor.contact,
        active=sponsor.active, event_ids=[link.event_id for link in sponsor.event_links],
    )


def all_sponsors(db: Session) -> list[Sponsor]:
    return list(db.scalars(select(Sponsor).options(selectinload(Sponsor.event_links)).order_by(Sponsor.name)))


def _sponsor(db: Session, sponsor_id: uuid.UUID) -> Sponsor:
    sponsor = db.scalar(select(Sponsor).options(selectinload(Sponsor.event_links)).where(Sponsor.id == sponsor_id))
    if sponsor is None:
        raise NotFoundError("Sponsor not found.")
    return sponsor


def _linked_organizations(db: Session, sponsor: Sponsor) -> set[uuid.UUID]:
    event_ids = [link.event_id for link in sponsor.event_links]
    if not event_ids:
        return set()
    return set(db.scalars(select(Event.organization_id).where(Event.id.in_(event_ids))))


def _require_manage_all(db: Session, user: User, event_ids: set[uuid.UUID]) -> None:
    for event_id in event_ids:
        require_event(db, user, event_id, Capability.MANAGE)


def list_sponsors(db: Session, user: User) -> list[Sponsor]:
    require_organizer(db, user)
    return all_sponsors(db)


def public_sponsors(db: Session) -> list[PublicSponsorOut]:
    """Active sponsors with their links to public events only; contact addresses stay private."""
    rows = db.execute(
        select(Sponsor, SponsorEvent.event_id)
        .join(SponsorEvent, SponsorEvent.sponsor_id == Sponsor.id)
        .join(Event, Event.id == SponsorEvent.event_id)
        .where(Sponsor.active.is_(True), Event.status.in_(PUBLIC_STATUSES))
        .order_by(Sponsor.name)
    ).all()
    grouped: dict[uuid.UUID, tuple[Sponsor, list[uuid.UUID]]] = {}
    for sponsor, event_id in rows:
        grouped.setdefault(sponsor.id, (sponsor, []))[1].append(event_id)
    return [
        PublicSponsorOut(id=sponsor.id, name=sponsor.name, tier=sponsor.tier, website=sponsor.website, event_ids=ids)
        for sponsor, ids in grouped.values()
    ]


def create_sponsor(db: Session, user: User, payload: SponsorFields) -> Sponsor:
    require_organizer(db, user)
    event_ids = set(payload.event_ids)
    _require_manage_all(db, user, event_ids)
    sponsor = Sponsor(
        name=payload.name.strip(),
        tier=payload.tier,
        website=payload.website,
        contact=str(payload.contact) if payload.contact else None,
        active=payload.active,
    )
    sponsor.event_links = [SponsorEvent(event_id=event_id) for event_id in event_ids]
    db.add(sponsor)
    db.flush()
    audit.record(db, "sponsor.created", actor=user, target_type="sponsor", target_id=sponsor.id)
    db.commit()
    return _sponsor(db, sponsor.id)


def update_sponsor(db: Session, user: User, sponsor_id: uuid.UUID, payload: SponsorUpdate) -> Sponsor:
    sponsor = _sponsor(db, sponsor_id)
    require_directory_editor(db, user, _linked_organizations(db, sponsor))
    changes = payload.model_dump(exclude_unset=True)
    if "event_ids" in changes:
        wanted = set(changes.pop("event_ids") or [])
        current = {link.event_id for link in sponsor.event_links}
        _require_manage_all(db, user, wanted ^ current)
        sponsor.event_links = [link for link in sponsor.event_links if link.event_id in wanted] + [
            SponsorEvent(event_id=event_id) for event_id in wanted - current
        ]
    if changes.get("name"):
        sponsor.name = changes["name"].strip()
    for key in ("tier", "active"):
        if changes.get(key) is not None:
            setattr(sponsor, key, changes[key])
    if "website" in changes:
        sponsor.website = changes["website"]
    if "contact" in changes:
        sponsor.contact = str(changes["contact"]) if changes["contact"] else None
    audit.record(db, "sponsor.updated", actor=user, target_type="sponsor", target_id=sponsor.id)
    db.commit()
    return _sponsor(db, sponsor.id)


def delete_sponsor(db: Session, user: User, sponsor_id: uuid.UUID) -> None:
    sponsor = _sponsor(db, sponsor_id)
    require_directory_editor(db, user, _linked_organizations(db, sponsor))
    audit.record(db, "sponsor.deleted", actor=user, target_type="sponsor", target_id=sponsor.id)
    db.delete(sponsor)
    db.commit()


# -------------------------------------------------------------- communications


def list_communications(db: Session, user: User, event_id: uuid.UUID) -> list[Communication]:
    require_event(db, user, event_id, Capability.MANAGE)
    return list(
        db.scalars(
            select(Communication).where(Communication.event_id == event_id).order_by(Communication.created_at.desc())
        )
    )


def create_communication(db: Session, user: User, event_id: uuid.UUID, payload: CommunicationFields) -> Communication:
    require_event(db, user, event_id, Capability.MANAGE)
    item = Communication(
        event_id=event_id, created_by_user_id=user.id, status=CommunicationStatus.DRAFT, **payload.model_dump()
    )
    db.add(item)
    db.flush()
    audit.record(
        db, "communication.created", actor=user, target_type="communication", target_id=item.id, event_id=event_id
    )
    db.commit()
    return item


def _draft(db: Session, user: User, communication_id: uuid.UUID) -> Communication:
    item = db.get(Communication, communication_id)
    if item is None:
        raise NotFoundError("Communication not found.")
    require_event(db, user, item.event_id, Capability.MANAGE)
    if item.status != CommunicationStatus.DRAFT:
        raise ConflictError("This communication has already been sent.", code="already_sent")
    return item


def update_communication(
    db: Session, user: User, communication_id: uuid.UUID, payload: CommunicationUpdate
) -> Communication:
    item = _draft(db, user, communication_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(item, key, value)
    db.commit()
    return item


def delete_communication(db: Session, user: User, communication_id: uuid.UUID) -> None:
    item = _draft(db, user, communication_id)
    audit.record(
        db, "communication.deleted", actor=user, target_type="communication", target_id=item.id, event_id=item.event_id
    )
    db.delete(item)
    db.commit()


def audience(db: Session, event_id: uuid.UUID, segment: AudienceSegment) -> list[uuid.UUID]:
    """Attendee ids with a confirmed registration for the event, narrowed by segment."""
    query = (
        select(Registration.attendee_id)
        .join(TicketType, TicketType.id == Registration.ticket_type_id)
        .where(Registration.event_id == event_id, Registration.status == RegistrationStatus.CONFIRMED)
    )
    if segment == AudienceSegment.PAID:
        query = query.where(
            exists(
                select(Payment.id).where(
                    Payment.registration_id == Registration.id, Payment.status == PaymentStatus.PAID
                )
            )
        )
    elif segment == AudienceSegment.STUDENT:
        query = query.where(TicketType.tier == "student")
    elif segment == AudienceSegment.VIP:
        query = query.where(TicketType.tier == "vip")
    elif segment == AudienceSegment.CHECKED_IN:
        query = query.where(
            exists(select(CheckIn.id).where(CheckIn.registration_id == Registration.id, CheckIn.undone.is_(False)))
        )
    return list(db.scalars(query.distinct()))


def send_communication(db: Session, user: User, communication_id: uuid.UUID) -> tuple[Communication, int]:
    item = _draft(db, user, communication_id)
    # Lock the row so a double click cannot deliver twice.
    db.refresh(item, with_for_update=True)
    if item.status != CommunicationStatus.DRAFT:
        raise ConflictError("This communication has already been sent.", code="already_sent")
    recipients = audience(db, item.event_id, item.audience)
    for attendee_id in recipients:
        notify(db, attendee_id, NotificationCategory.ANNOUNCEMENT, item.subject, item.body)
    item.status = CommunicationStatus.SENT
    item.sent_at = datetime.now(UTC)
    audit.record(
        db,
        "communication.sent",
        actor=user,
        target_type="communication",
        target_id=item.id,
        event_id=item.event_id,
        details={"audience": item.audience.value, "channel": item.channel.value, "recipients": len(recipients)},
    )
    db.commit()
    return item, len(recipients)
