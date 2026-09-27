"""Attendee engagement: personal agenda, networking, in-app notifications and certificates.

Every read and write is scoped to the signed-in user's own attendee record. Networking only
reveals opted-in profiles of people who share a confirmed registration with the caller.
"""

import secrets
import uuid
from datetime import UTC, datetime

from sqlalchemy import delete, exists, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased

from app.db.models import (
    Attendee,
    Certificate,
    CheckIn,
    Connection,
    Event,
    EventSession,
    NetworkingProfile,
    Notification,
    Registration,
    SavedSession,
    User,
)
from app.db.models.enums import EventStatus, NotificationCategory, RegistrationStatus
from app.schemas.engagement import NetworkingProfileIn
from app.services.auth import ensure_attendee
from app.services.catalogue import PUBLIC_STATUSES
from app.services.errors import NotFoundError, ValidationError
from app.services.notifications import notify


def _now() -> datetime:
    return datetime.now(UTC)


def _initials(name: str) -> str:
    return "".join(part[0] for part in name.split() if part[:1].isalpha())[:2].upper()


# ---------------------------------------------------------------- notifications


def notifications(db: Session, user: User, limit: int = 100) -> list[Notification]:
    attendee = ensure_attendee(db, user)
    db.commit()
    return list(
        db.scalars(
            select(Notification)
            .where(Notification.attendee_id == attendee.id)
            .order_by(Notification.created_at.desc())
            .limit(limit)
        )
    )


def mark_read(db: Session, user: User, notification_id: uuid.UUID) -> Notification:
    attendee = ensure_attendee(db, user)
    item = db.get(Notification, notification_id)
    if item is None or item.attendee_id != attendee.id:
        raise NotFoundError("Notification not found.")
    if not item.is_read:
        item.is_read, item.read_at = True, _now()
    db.commit()
    return item


def mark_all_read(db: Session, user: User) -> int:
    attendee = ensure_attendee(db, user)
    result = db.execute(
        update(Notification)
        .where(Notification.attendee_id == attendee.id, Notification.is_read.is_(False))
        .values(is_read=True, read_at=_now())
    )
    db.commit()
    return result.rowcount or 0


# --------------------------------------------------------------------- agenda


def saved_sessions(db: Session, user: User) -> list[tuple[SavedSession, uuid.UUID]]:
    attendee = ensure_attendee(db, user)
    db.commit()
    return [
        (saved, event_id)
        for saved, event_id in db.execute(
            select(SavedSession, EventSession.event_id)
            .join(EventSession, EventSession.id == SavedSession.session_id)
            .where(SavedSession.attendee_id == attendee.id)
            .order_by(SavedSession.created_at)
        )
    ]


def save_session(db: Session, user: User, session_id: uuid.UUID) -> None:
    attendee = ensure_attendee(db, user)
    session = db.get(EventSession, session_id)
    # Only programme slots of public events can be saved; drafts stay invisible.
    if session is None or db.get(Event, session.event_id).status not in PUBLIC_STATUSES:
        raise NotFoundError("Session not found.")
    if db.get(SavedSession, (attendee.id, session_id)) is None:
        db.add(SavedSession(attendee_id=attendee.id, session_id=session_id))
        try:
            db.commit()
        except IntegrityError:  # a parallel request saved it first
            db.rollback()
    else:
        db.commit()


def unsave_session(db: Session, user: User, session_id: uuid.UUID) -> None:
    attendee = ensure_attendee(db, user)
    db.execute(
        delete(SavedSession).where(SavedSession.attendee_id == attendee.id, SavedSession.session_id == session_id)
    )
    db.commit()


# ----------------------------------------------------------------- networking


def _shares_an_event(attendee_id: uuid.UUID):
    """SQL condition: the profile's attendee shares a confirmed registration with `attendee_id`."""
    mine = aliased(Registration)
    theirs = aliased(Registration)
    return exists(
        select(mine.id)
        .join(theirs, theirs.event_id == mine.event_id)
        .where(
            mine.attendee_id == attendee_id,
            mine.status == RegistrationStatus.CONFIRMED,
            theirs.attendee_id == NetworkingProfile.attendee_id,
            theirs.status == RegistrationStatus.CONFIRMED,
        )
    )


def networking(db: Session, user: User) -> tuple[NetworkingProfile | None, list[NetworkingProfile], list[uuid.UUID]]:
    attendee = ensure_attendee(db, user)
    db.commit()
    profile = db.scalar(select(NetworkingProfile).where(NetworkingProfile.attendee_id == attendee.id))
    people = list(
        db.scalars(
            select(NetworkingProfile)
            .where(
                NetworkingProfile.attendee_id != attendee.id,
                NetworkingProfile.is_visible.is_(True),
                _shares_an_event(attendee.id),
            )
            .order_by(NetworkingProfile.public_name)
            .limit(500)
        )
    )
    connections = list(db.scalars(select(Connection.to_attendee_id).where(Connection.from_attendee_id == attendee.id)))
    return profile, people, connections


def save_profile(db: Session, user: User, payload: NetworkingProfileIn) -> NetworkingProfile:
    attendee = ensure_attendee(db, user)
    profile = db.scalar(select(NetworkingProfile).where(NetworkingProfile.attendee_id == attendee.id))
    if profile is None:
        profile = NetworkingProfile(attendee_id=attendee.id)
        db.add(profile)
    profile.public_name = payload.public_name.strip()
    profile.initials = _initials(profile.public_name)
    profile.job_title = payload.job_title
    profile.organization = payload.organization
    profile.interests = payload.interests
    profile.bio = payload.bio
    profile.is_visible = payload.is_visible
    db.commit()
    return profile


def connect(db: Session, user: User, to_attendee_id: uuid.UUID) -> None:
    attendee = ensure_attendee(db, user)
    if to_attendee_id == attendee.id:
        raise ValidationError("You cannot connect with yourself.")
    # Same visibility rule as the directory: unknown and hidden people look identical.
    visible = db.scalar(
        select(NetworkingProfile.id).where(
            NetworkingProfile.attendee_id == to_attendee_id,
            NetworkingProfile.is_visible.is_(True),
            _shares_an_event(attendee.id),
        )
    )
    if visible is None:
        raise NotFoundError("Attendee not found.")
    exists_already = db.scalar(
        select(Connection.id).where(
            Connection.from_attendee_id == attendee.id, Connection.to_attendee_id == to_attendee_id
        )
    )
    if exists_already is None:
        db.add(Connection(from_attendee_id=attendee.id, to_attendee_id=to_attendee_id))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
    else:
        db.commit()


def disconnect(db: Session, user: User, to_attendee_id: uuid.UUID) -> None:
    attendee = ensure_attendee(db, user)
    db.execute(
        delete(Connection).where(
            Connection.from_attendee_id == attendee.id, Connection.to_attendee_id == to_attendee_id
        )
    )
    db.commit()


# ---------------------------------------------------------------- certificates


def new_certificate_code() -> str:
    # 48 random bits; the code is the public verification key, so it must not be guessable.
    return f"NT-{secrets.token_hex(6).upper()}"


def issue_certificates(db: Session, *, event_id: uuid.UUID | None = None, attendee_id: uuid.UUID | None = None) -> int:
    """Issue missing certificates to everyone eligible, optionally limited to one event or attendee.

    Eligible: a confirmed registration, an active (not undone) check-in, and a completed event.
    Idempotent: one certificate per attendee and event. The caller commits.
    """
    query = (
        select(Registration.attendee_id, Registration.event_id, Event.title)
        .join(Event, Event.id == Registration.event_id)
        .where(
            Registration.status == RegistrationStatus.CONFIRMED,
            Event.status == EventStatus.COMPLETED,
            exists(select(CheckIn.id).where(CheckIn.registration_id == Registration.id, CheckIn.undone.is_(False))),
            ~exists(
                select(Certificate.id).where(
                    Certificate.attendee_id == Registration.attendee_id, Certificate.event_id == Registration.event_id
                )
            ),
        )
        .distinct()
    )
    if event_id is not None:
        query = query.where(Registration.event_id == event_id)
    if attendee_id is not None:
        query = query.where(Registration.attendee_id == attendee_id)
    issued = 0
    for holder, event, title in db.execute(query).all():
        db.add(Certificate(attendee_id=holder, event_id=event, certificate_code=new_certificate_code()))
        notify(
            db, holder, NotificationCategory.CERTIFICATE, "Certificate available", f"Your {title} certificate is ready."
        )
        issued += 1
    return issued


def my_certificates(db: Session, user: User) -> list[tuple[Certificate, Event]]:
    """The caller's certificates, issuing any they have become eligible for since the last read."""
    attendee = ensure_attendee(db, user)
    if issue_certificates(db, attendee_id=attendee.id):
        try:
            db.commit()
        except IntegrityError:  # issued concurrently; the read below sees it
            db.rollback()
    else:
        db.commit()
    return [
        (certificate, event)
        for certificate, event in db.execute(
            select(Certificate, Event)
            .join(Event, Event.id == Certificate.event_id)
            .where(Certificate.attendee_id == attendee.id)
            .order_by(Certificate.issued_at.desc())
        )
    ]


def verify_certificate(db: Session, code: str) -> tuple[Certificate, Attendee, Event]:
    row = db.execute(
        select(Certificate, Attendee, Event)
        .join(Attendee, Attendee.id == Certificate.attendee_id)
        .join(Event, Event.id == Certificate.event_id)
        .where(Certificate.certificate_code == code.strip().upper())
    ).first()
    if row is None:
        raise NotFoundError("No certificate matches that code.")
    return row[0], row[1], row[2]


def certificate_count(db: Session, event_id: uuid.UUID) -> int:
    return db.scalar(select(func.count(Certificate.id)).where(Certificate.event_id == event_id)) or 0
