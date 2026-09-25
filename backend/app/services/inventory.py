"""Seat accounting shared by checkout, public availability and admin reports.

A seat is taken by a confirmed registration, or by a pending one that is still inside its
payment hold window. Abandoned checkouts therefore return their seat to sale automatically
without any background job, and a late provider confirmation still honours the payment.
"""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import ColumnElement, and_, func, or_, select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db.models import Registration
from app.db.models.enums import RegistrationStatus


def hold_cutoff(settings: Settings | None = None) -> datetime:
    settings = settings or get_settings()
    return datetime.now(UTC) - timedelta(minutes=settings.pending_registration_hold_minutes)


def holds_seat(settings: Settings | None = None) -> ColumnElement[bool]:
    return or_(
        Registration.status == RegistrationStatus.CONFIRMED,
        and_(Registration.status == RegistrationStatus.PENDING, Registration.created_at >= hold_cutoff(settings)),
    )


def taken_by_ticket_type(
    db: Session, ticket_type_ids: list[uuid.UUID], settings: Settings | None = None
) -> dict[uuid.UUID, int]:
    if not ticket_type_ids:
        return {}
    rows = db.execute(
        select(Registration.ticket_type_id, func.count())
        .where(Registration.ticket_type_id.in_(ticket_type_ids), holds_seat(settings))
        .group_by(Registration.ticket_type_id)
    ).all()
    return {ticket_type_id: count for ticket_type_id, count in rows}


def taken_for_event(db: Session, event_id: uuid.UUID, settings: Settings | None = None) -> int:
    return db.scalar(
        select(func.count()).select_from(Registration).where(Registration.event_id == event_id, holds_seat(settings))
    ) or 0
