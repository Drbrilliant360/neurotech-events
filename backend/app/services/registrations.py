import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models import Attendee, CheckIn, Payment, PaymentEvent, Registration, User
from app.db.models.enums import PaymentStatus, RegistrationStatus
from app.schemas.registrations import RegistrationOut
from app.services.payments import ConflictError, NotFoundError


def _query():
    return select(Registration).options(
        selectinload(Registration.event),
        selectinload(Registration.ticket_type),
        selectinload(Registration.attendee),
    )


def attendee_registrations(db: Session, user: User) -> list[Registration]:
    attendee = db.scalar(select(Attendee).where(Attendee.user_id == user.id))
    if attendee is None:
        return []
    return list(
        db.scalars(
            _query()
            .where(Registration.attendee_id == attendee.id)
            .order_by(Registration.created_at.desc())
        )
    )


def attendee_registration(db: Session, user: User, registration_id: uuid.UUID) -> Registration:
    registration = db.scalar(_query().where(Registration.id == registration_id))
    if registration is None or registration.attendee.user_id != user.id:
        raise NotFoundError("Registration not found.")
    return registration


def cancel_registration(db: Session, user: User, registration_id: uuid.UUID) -> Registration:
    registration = attendee_registration(db, user, registration_id)
    if registration.status == RegistrationStatus.CANCELLED:
        return registration
    if registration.status == RegistrationStatus.CONFIRMED:
        raise ConflictError("Confirmed registrations require a refund workflow before cancellation.")
    registration.status = RegistrationStatus.CANCELLED
    registration.cancelled_at = datetime.now(UTC)
    for payment in db.scalars(
        select(Payment).where(
            Payment.registration_id == registration.id,
            Payment.status.in_([PaymentStatus.PENDING, PaymentStatus.PROCESSING]),
        )
    ):
        payment.events.append(
            PaymentEvent(
                from_status=payment.status,
                to_status=PaymentStatus.CANCELLED,
                note="Registration cancelled by attendee",
            )
        )
        payment.status = PaymentStatus.CANCELLED
    db.commit()
    return attendee_registration(db, user, registration_id)


def to_outs(db: Session, registrations: list[Registration]) -> list[RegistrationOut]:
    """Serialise registrations with their latest payment and active check-in, in two queries."""
    ids = [item.id for item in registrations]
    latest: dict[uuid.UUID, Payment] = {}
    if ids:
        for payment in db.scalars(
            select(Payment).where(Payment.registration_id.in_(ids)).order_by(Payment.created_at)
        ):
            latest[payment.registration_id] = payment
    checked: dict[uuid.UUID, datetime] = {}
    if ids:
        for check_in in db.scalars(select(CheckIn).where(CheckIn.registration_id.in_(ids), CheckIn.undone.is_(False))):
            checked[check_in.registration_id] = check_in.checked_in_at
    out = []
    for item in registrations:
        payment = latest.get(item.id)
        out.append(
            RegistrationOut(
                id=item.id,
                event_id=item.event_id,
                event_slug=item.event.slug,
                event_title=item.event.title,
                event_starts_at=item.event.starts_at,
                event_ends_at=item.event.ends_at,
                attendee_id=item.attendee_id,
                ticket_type_id=item.ticket_type_id,
                ticket_code=item.ticket_type.code,
                ticket_name=item.ticket_type.name,
                ticket_price=int(item.ticket_type.price),
                currency=item.ticket_type.currency,
                ticket_number=item.ticket_number,
                status=item.status.value,
                created_at=item.created_at,
                cancelled_at=item.cancelled_at,
                payment_id=payment.id if payment else None,
                payment_status=payment.status.value if payment else None,
                payment_reference=payment.reference if payment else None,
                payment_method=payment.method.value if payment else None,
                amount_paid=int(payment.amount) if payment and payment.status == PaymentStatus.PAID else 0,
                checked_in_at=checked.get(item.id),
            )
        )
    return out


def registration_by_id(db: Session, registration_id: uuid.UUID) -> Registration:
    registration = db.scalar(_query().where(Registration.id == registration_id))
    if registration is None:
        raise NotFoundError("Registration not found.")
    return registration
