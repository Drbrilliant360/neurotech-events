"""Event operations: attendee management, complimentary tickets, door check-in and reporting."""

import csv
import io
import uuid
from collections.abc import Iterable
from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.config import Settings
from app.core.signing import sign_ticket, verify_ticket
from app.db.models import (
    Attendee,
    AuditLog,
    CheckIn,
    Event,
    Payment,
    PaymentEvent,
    Registration,
    TicketType,
    User,
)
from app.db.models.enums import EventStatus, PaymentStatus, RegistrationStatus
from app.schemas.operations import (
    AdminRegistrationOut,
    AttendeeTicketOut,
    AuditEntryOut,
    CheckInLookupOut,
    CheckInOut,
    ComplimentaryRegistrationRequest,
    EventSummaryReport,
    TicketTypeSummary,
)
from app.services import audit, inventory
from app.services.authorization import EventAccess
from app.services.errors import ConflictError, NotFoundError, ValidationError
from app.services.payments import new_ticket_number

CHECK_IN_STATUSES = {EventStatus.PUBLISHED, EventStatus.ONGOING}
OPEN_PAYMENT_STATUSES = [PaymentStatus.PENDING, PaymentStatus.PROCESSING]


def _now() -> datetime:
    return datetime.now(UTC)


def _registration_query():
    return select(Registration).options(selectinload(Registration.attendee), selectinload(Registration.ticket_type))


def _registration(db: Session, event: Event, registration_id: uuid.UUID, *, lock: bool = False) -> Registration:
    query = _registration_query().where(Registration.id == registration_id, Registration.event_id == event.id)
    registration = db.scalar(query.with_for_update() if lock else query)
    if registration is None:
        raise NotFoundError("Registration not found for this event.")
    return registration


def _active_check_ins(db: Session, registration_ids: list[uuid.UUID]) -> dict[uuid.UUID, CheckIn]:
    if not registration_ids:
        return {}
    rows = db.scalars(
        select(CheckIn)
        .where(CheckIn.registration_id.in_(registration_ids), CheckIn.undone.is_(False))
        .order_by(CheckIn.checked_in_at)
    )
    return {row.registration_id: row for row in rows}


def _amounts_paid(db: Session, registration_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    if not registration_ids:
        return {}
    rows = db.execute(
        select(Payment.registration_id, func.coalesce(func.sum(Payment.amount), 0))
        .where(Payment.registration_id.in_(registration_ids), Payment.status == PaymentStatus.PAID)
        .group_by(Payment.registration_id)
    )
    return {registration_id: int(total) for registration_id, total in rows}


def _to_out(
    registration: Registration, paid: dict[uuid.UUID, int], check_ins: dict[uuid.UUID, CheckIn]
) -> AdminRegistrationOut:
    attendee = registration.attendee
    check_in = check_ins.get(registration.id)
    return AdminRegistrationOut(
        id=registration.id,
        event_id=registration.event_id,
        ticket_number=registration.ticket_number,
        status=registration.status.value,
        attendee_id=attendee.id,
        attendee_name=attendee.full_name,
        attendee_email=attendee.email,
        attendee_phone=attendee.phone,
        attendee_organization=attendee.organization,
        ticket_type_id=registration.ticket_type_id,
        ticket_name=registration.ticket_type.name,
        amount_paid=paid.get(registration.id, 0),
        checked_in_at=check_in.checked_in_at if check_in else None,
        created_at=registration.created_at,
        cancelled_at=registration.cancelled_at,
    )


def registration_out(db: Session, registration: Registration) -> AdminRegistrationOut:
    ids = [registration.id]
    return _to_out(registration, _amounts_paid(db, ids), _active_check_ins(db, ids))


def _registration_conditions(
    event: Event,
    *,
    status: RegistrationStatus | None,
    ticket_type_id: uuid.UUID | None,
    q: str | None,
    checked_in: bool | None,
) -> list:
    conditions = [Registration.event_id == event.id]
    if status is not None:
        conditions.append(Registration.status == status)
    if ticket_type_id is not None:
        conditions.append(Registration.ticket_type_id == ticket_type_id)
    if q:
        pattern = f"%{q.strip().lower()}%"
        conditions.append(
            Registration.attendee_id.in_(
                select(Attendee.id).where(
                    or_(func.lower(Attendee.full_name).like(pattern), func.lower(Attendee.email).like(pattern))
                )
            )
            | (func.lower(Registration.ticket_number) == q.strip().lower())
        )
    if checked_in is not None:
        active = select(CheckIn.registration_id).where(CheckIn.event_id == event.id, CheckIn.undone.is_(False))
        conditions.append(Registration.id.in_(active) if checked_in else Registration.id.not_in(active))
    return conditions


def list_registrations(
    db: Session,
    event: Event,
    *,
    status: RegistrationStatus | None = None,
    ticket_type_id: uuid.UUID | None = None,
    q: str | None = None,
    checked_in: bool | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[AdminRegistrationOut], int]:
    conditions = _registration_conditions(
        event, status=status, ticket_type_id=ticket_type_id, q=q, checked_in=checked_in
    )
    total = db.scalar(select(func.count()).select_from(Registration).where(*conditions)) or 0
    registrations = list(
        db.scalars(
            _registration_query()
            .where(*conditions)
            .order_by(Registration.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    ids = [item.id for item in registrations]
    paid, check_ins = _amounts_paid(db, ids), _active_check_ins(db, ids)
    return [_to_out(item, paid, check_ins) for item in registrations], total


def _csv_safe(value: object) -> str:
    """Neutralise spreadsheet formulas (CSV injection) in attendee-supplied text."""
    text = "" if value is None else str(value)
    return f"'{text}" if text[:1] in {"=", "+", "-", "@", "\t", "\r"} else text


def export_registrations_csv(db: Session, user: User, event: Event) -> str:
    registrations = list(
        db.scalars(_registration_query().where(Registration.event_id == event.id).order_by(Registration.created_at))
    )
    ids = [item.id for item in registrations]
    paid, check_ins = _amounts_paid(db, ids), _active_check_ins(db, ids)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        ["ticket_number", "status", "name", "email", "phone", "organization", "ticket", "amount_paid",
         "registered_at", "checked_in_at"]
    )
    for item in registrations:
        row = _to_out(item, paid, check_ins)
        writer.writerow(
            [_csv_safe(value) for value in (
                row.ticket_number, row.status, row.attendee_name, row.attendee_email, row.attendee_phone,
                row.attendee_organization, row.ticket_name, row.amount_paid, row.created_at.isoformat(),
                row.checked_in_at.isoformat() if row.checked_in_at else "",
            )]
        )
    audit.record(
        db, "registrations.exported", actor=user, target_type="event", target_id=event.id, event_id=event.id,
        details={"rows": len(registrations)},
    )
    db.commit()
    return buffer.getvalue()


def create_complimentary_registration(
    db: Session, user: User, event: Event, payload: ComplimentaryRegistrationRequest
) -> Registration:
    if event.status in {EventStatus.COMPLETED, EventStatus.CANCELLED}:
        raise ConflictError(f"Cannot add registrations to a {event.status.value} event.")
    if event.capacity:
        db.refresh(event, with_for_update=True)  # same lock order as checkout: event, then ticket
    ticket = db.scalar(
        select(TicketType)
        .where(TicketType.id == payload.ticket_type_id, TicketType.event_id == event.id)
        .with_for_update()
    )
    if ticket is None:
        raise NotFoundError("Ticket type not found for this event.")
    if inventory.taken_by_ticket_type(db, [ticket.id]).get(ticket.id, 0) >= ticket.capacity:
        raise ConflictError("This ticket type is sold out.", code="sold_out")
    if event.capacity and inventory.taken_for_event(db, event.id) >= event.capacity:
        raise ConflictError("This event is at capacity.", code="sold_out")

    details = payload.attendee
    attendee = db.scalar(select(Attendee).where(func.lower(Attendee.email) == details.email))
    if attendee is None:
        attendee = Attendee(email=details.email, full_name=details.full_name, interests=[])
        db.add(attendee)
    elif attendee.user_id is None:
        attendee.full_name = details.full_name
    for field in ("organization", "job_title", "country"):
        value = getattr(details, field)
        if value and not getattr(attendee, field):
            setattr(attendee, field, value)
    db.flush()

    registration = Registration(
        event_id=event.id,
        attendee_id=attendee.id,
        ticket_type_id=ticket.id,
        status=RegistrationStatus.CONFIRMED,
        ticket_number=new_ticket_number(),
    )
    db.add(registration)
    db.flush()
    audit.record(
        db, "registration.complimentary", actor=user, target_type="registration", target_id=registration.id,
        event_id=event.id, details={"ticket_type": ticket.code, "note": payload.note},
    )
    db.commit()
    return _registration(db, event, registration.id)


def cancel_registration(
    db: Session, user: User, event: Event, registration_id: uuid.UUID, reason: str
) -> tuple[Registration, bool]:
    registration = _registration(db, event, registration_id, lock=True)
    paid = _amounts_paid(db, [registration.id]).get(registration.id, 0)
    if registration.status == RegistrationStatus.CANCELLED:
        return registration, paid > 0
    registration.status = RegistrationStatus.CANCELLED
    registration.cancelled_at = _now()
    for payment in db.scalars(
        select(Payment).where(Payment.registration_id == registration.id, Payment.status.in_(OPEN_PAYMENT_STATUSES))
    ):
        payment.events.append(
            PaymentEvent(from_status=payment.status, to_status=PaymentStatus.CANCELLED, note="Cancelled by organiser")
        )
        payment.status = PaymentStatus.CANCELLED
    for check_in in db.scalars(
        select(CheckIn).where(CheckIn.registration_id == registration.id, CheckIn.undone.is_(False))
    ):
        check_in.undone = True
        check_in.undone_at = _now()
    audit.record(
        db, "registration.cancelled", actor=user, target_type="registration", target_id=registration.id,
        event_id=event.id, details={"reason": reason, "refund_required": paid > 0, "amount_paid": paid},
    )
    db.commit()
    return _registration(db, event, registration.id), paid > 0


# ------------------------------------------------------------------- check-in


def _check_in_out(check_in: CheckIn, registration: Registration, staff: User | None) -> CheckInOut:
    return CheckInOut(
        id=check_in.id,
        event_id=check_in.event_id,
        attendee_id=check_in.attendee_id,
        registration_id=registration.id,
        ticket_number=registration.ticket_number,
        attendee_name=registration.attendee.full_name,
        ticket_name=registration.ticket_type.name,
        checked_in_at=check_in.checked_in_at,
        checked_in_by=staff.full_name if staff else None,
        undone=check_in.undone,
    )


def _resolve_code(db: Session, settings: Settings, event: Event, code: str) -> uuid.UUID:
    code = code.strip()
    registration_id = verify_ticket(settings.jwt_secret_key, code)
    if registration_id is not None:
        return registration_id
    if code.upper().startswith("NTQ1."):
        raise ValidationError("This QR code is not a valid ticket.", code="invalid_ticket")
    found = db.scalar(
        select(Registration.id).where(
            Registration.event_id == event.id, func.upper(Registration.ticket_number) == code.upper()
        )
    )
    if found is None:
        raise NotFoundError("No ticket with this number for this event.")
    return found


def check_in(db: Session, settings: Settings, user: User, event: Event, code: str) -> CheckInOut:
    if event.status not in CHECK_IN_STATUSES:
        raise ConflictError(f"Check-in is closed for a {event.status.value} event.")
    registration_id = _resolve_code(db, settings, event, code)
    registration = db.scalar(
        _registration_query().where(Registration.id == registration_id).with_for_update()
    )
    if registration is None or registration.event_id != event.id:
        # A genuine ticket for another event must not be admitted here.
        raise ConflictError("This ticket belongs to a different event.", code="wrong_event")
    if registration.status != RegistrationStatus.CONFIRMED:
        raise ConflictError(
            f"This registration is {registration.status.value}, not confirmed.", code="not_confirmed"
        )
    existing = _active_check_ins(db, [registration.id]).get(registration.id)
    if existing is not None:
        raise ConflictError(
            f"Already checked in at {existing.checked_in_at.isoformat()}.", code="already_checked_in"
        )
    record = CheckIn(
        registration_id=registration.id,
        attendee_id=registration.attendee_id,
        event_id=event.id,
        ticket_number=registration.ticket_number,
        checked_in_at=_now(),
        checked_in_by_user_id=user.id,
    )
    db.add(record)
    db.flush()
    audit.record(
        db, "check_in.created", actor=user, target_type="registration", target_id=registration.id, event_id=event.id
    )
    db.commit()
    return _check_in_out(record, registration, user)


def undo_check_in(db: Session, user: User, event: Event, check_in_id: uuid.UUID) -> CheckInOut:
    record = db.get(CheckIn, check_in_id)
    if record is None or record.event_id != event.id:
        raise NotFoundError("Check-in not found for this event.")
    if not record.undone:
        record.undone = True
        record.undone_at = _now()
        audit.record(
            db, "check_in.undone", actor=user, target_type="registration", target_id=record.registration_id,
            event_id=event.id,
        )
        db.commit()
    registration = _registration(db, event, record.registration_id)
    return _check_in_out(record, registration, record.checked_in_by)


def list_check_ins(db: Session, event: Event, *, page: int, page_size: int) -> tuple[list[CheckInOut], int]:
    total = db.scalar(select(func.count()).select_from(CheckIn).where(CheckIn.event_id == event.id)) or 0
    records = list(
        db.scalars(
            select(CheckIn)
            .options(
                selectinload(CheckIn.registration).selectinload(Registration.attendee),
                selectinload(CheckIn.registration).selectinload(Registration.ticket_type),
                selectinload(CheckIn.checked_in_by),
            )
            .where(CheckIn.event_id == event.id)
            .order_by(CheckIn.checked_in_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    return [_check_in_out(item, item.registration, item.checked_in_by) for item in records], total


def lookup_for_check_in(db: Session, event: Event, q: str) -> list[CheckInLookupOut]:
    conditions = _registration_conditions(event, status=None, ticket_type_id=None, q=q, checked_in=None)
    registrations = list(
        db.scalars(_registration_query().where(*conditions).order_by(Registration.created_at).limit(20))
    )
    check_ins = _active_check_ins(db, [item.id for item in registrations])
    return [
        CheckInLookupOut(
            registration_id=item.id,
            ticket_number=item.ticket_number,
            attendee_name=item.attendee.full_name,
            ticket_name=item.ticket_type.name,
            status=item.status.value,
            checked_in_at=check_ins[item.id].checked_in_at if item.id in check_ins else None,
        )
        for item in registrations
    ]


# ------------------------------------------------------------------ reporting


def event_summary(db: Session, event: Event, access: EventAccess) -> EventSummaryReport:
    tickets = list(
        db.scalars(select(TicketType).where(TicketType.event_id == event.id).order_by(TicketType.sort_order))
    )
    by_ticket: dict[uuid.UUID, dict[RegistrationStatus, int]] = {ticket.id: {} for ticket in tickets}
    for ticket_type_id, status, total in db.execute(
        select(Registration.ticket_type_id, Registration.status, func.count())
        .where(Registration.event_id == event.id)
        .group_by(Registration.ticket_type_id, Registration.status)
    ):
        by_ticket.setdefault(ticket_type_id, {})[status] = total
    revenue_by_ticket = {
        ticket_type_id: int(total)
        for ticket_type_id, total in db.execute(
            select(Registration.ticket_type_id, func.coalesce(func.sum(Payment.amount), 0))
            .join(Payment, Payment.registration_id == Registration.id)
            .where(Registration.event_id == event.id, Payment.status == PaymentStatus.PAID)
            .group_by(Registration.ticket_type_id)
        )
    }
    checked_in = db.scalar(
        select(func.count(func.distinct(CheckIn.registration_id))).where(
            CheckIn.event_id == event.id, CheckIn.undone.is_(False)
        )
    ) or 0

    def total(status: RegistrationStatus) -> int:
        return sum(counts.get(status, 0) for counts in by_ticket.values())

    confirmed = total(RegistrationStatus.CONFIRMED)
    finance = access.can_manage_finance
    return EventSummaryReport(
        event_id=event.id,
        capacity=event.capacity,
        registrations=confirmed + total(RegistrationStatus.PENDING),
        confirmed=confirmed,
        pending=total(RegistrationStatus.PENDING),
        cancelled=total(RegistrationStatus.CANCELLED),
        checked_in=checked_in,
        check_in_rate=round(checked_in / confirmed, 4) if confirmed else 0.0,
        revenue=sum(revenue_by_ticket.values()) if finance else None,
        currency=tickets[0].currency if tickets else event.organization.default_currency,
        ticket_types=[
            TicketTypeSummary(
                ticket_type_id=ticket.id,
                name=ticket.name,
                capacity=ticket.capacity,
                confirmed=by_ticket[ticket.id].get(RegistrationStatus.CONFIRMED, 0),
                pending=by_ticket[ticket.id].get(RegistrationStatus.PENDING, 0),
                revenue=revenue_by_ticket.get(ticket.id, 0) if finance else None,
            )
            for ticket in tickets
        ],
    )


def event_audit_log(db: Session, event: Event, *, page: int, page_size: int) -> tuple[list[AuditEntryOut], int]:
    condition = AuditLog.event_id == event.id
    total = db.scalar(select(func.count()).select_from(AuditLog).where(condition)) or 0
    rows: Iterable[AuditLog] = db.scalars(
        select(AuditLog).where(condition).order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size)
        .limit(page_size)
    )
    return [
        AuditEntryOut(
            id=row.id,
            action=row.action,
            actor_user_id=row.actor_user_id,
            target_type=row.target_type,
            target_id=row.target_id,
            details=row.details or {},
            created_at=row.created_at,
        )
        for row in rows
    ], total


# ------------------------------------------------------------------- attendee


def attendee_ticket(settings: Settings, registration: Registration, check_in: CheckIn | None) -> AttendeeTicketOut:
    if registration.status != RegistrationStatus.CONFIRMED:
        raise ConflictError("A ticket is issued once the registration is confirmed.", code="not_confirmed")
    return AttendeeTicketOut(
        registration_id=registration.id,
        ticket_number=registration.ticket_number,
        event_slug=registration.event.slug,
        event_title=registration.event.title,
        ticket_name=registration.ticket_type.name,
        attendee_name=registration.attendee.full_name,
        starts_at=registration.event.starts_at,
        qr_payload=sign_ticket(settings.jwt_secret_key, registration.id),
        checked_in_at=check_in.checked_in_at if check_in else None,
    )


def active_check_in(db: Session, registration_id: uuid.UUID) -> CheckIn | None:
    return _active_check_ins(db, [registration_id]).get(registration_id)
