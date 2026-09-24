import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models import Attendee, Payment, PaymentEvent, Registration, User
from app.db.models.enums import PaymentStatus, RegistrationStatus
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
