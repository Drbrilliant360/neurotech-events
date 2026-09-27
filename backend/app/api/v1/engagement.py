"""Attendee engagement under /me, plus public certificate verification."""

import uuid

from fastapi import APIRouter, Response, status

from app.api.deps import DbSession
from app.api.v1.auth import CurrentUser
from app.schemas.engagement import (
    CertificateOut,
    CertificateVerification,
    ConnectionIn,
    MyNetworkingProfileOut,
    NetworkingOut,
    NetworkingProfileIn,
    NetworkingProfileOut,
    NotificationOut,
    SavedSessionOut,
)
from app.services import engagement

router = APIRouter(tags=["attendee"])


@router.get("/me/schedule", response_model=list[SavedSessionOut])
def my_schedule(user: CurrentUser, db: DbSession) -> list[SavedSessionOut]:
    return [
        SavedSessionOut(session_id=saved.session_id, event_id=event_id, saved_at=saved.created_at)
        for saved, event_id in engagement.saved_sessions(db, user)
    ]


@router.put("/me/schedule/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def save_session(session_id: uuid.UUID, user: CurrentUser, db: DbSession) -> None:
    engagement.save_session(db, user, session_id)


@router.delete("/me/schedule/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def unsave_session(session_id: uuid.UUID, user: CurrentUser, db: DbSession) -> None:
    engagement.unsave_session(db, user, session_id)


@router.get("/me/networking", response_model=NetworkingOut)
def my_networking(user: CurrentUser, db: DbSession) -> NetworkingOut:
    profile, people, connections = engagement.networking(db, user)
    return NetworkingOut(
        profile=MyNetworkingProfileOut.model_validate(profile) if profile else None,
        people=[NetworkingProfileOut.model_validate(item) for item in people],
        connections=connections,
    )


@router.put("/me/networking/profile", response_model=MyNetworkingProfileOut)
def save_networking_profile(payload: NetworkingProfileIn, user: CurrentUser, db: DbSession) -> MyNetworkingProfileOut:
    return MyNetworkingProfileOut.model_validate(engagement.save_profile(db, user, payload))


@router.post("/me/networking/connections", status_code=status.HTTP_204_NO_CONTENT)
def connect(payload: ConnectionIn, user: CurrentUser, db: DbSession) -> None:
    engagement.connect(db, user, payload.attendee_id)


@router.delete("/me/networking/connections/{attendee_id}", status_code=status.HTTP_204_NO_CONTENT)
def disconnect(attendee_id: uuid.UUID, user: CurrentUser, db: DbSession) -> None:
    engagement.disconnect(db, user, attendee_id)


@router.get("/me/notifications", response_model=list[NotificationOut])
def my_notifications(user: CurrentUser, db: DbSession) -> list[NotificationOut]:
    return [NotificationOut.model_validate(item) for item in engagement.notifications(db, user)]


@router.post("/me/notifications/read-all", response_model=dict[str, int])
def read_all(user: CurrentUser, db: DbSession) -> dict[str, int]:
    return {"updated": engagement.mark_all_read(db, user)}


@router.post("/me/notifications/{notification_id}/read", response_model=NotificationOut)
def read_one(notification_id: uuid.UUID, user: CurrentUser, db: DbSession) -> NotificationOut:
    return NotificationOut.model_validate(engagement.mark_read(db, user, notification_id))


@router.get("/me/certificates", response_model=list[CertificateOut])
def my_certificates(user: CurrentUser, db: DbSession) -> list[CertificateOut]:
    """The caller's certificates; any newly earned ones (checked in at a completed event) are issued first."""
    return [
        CertificateOut(
            id=cert.id, certificate_code=cert.certificate_code, event_id=event.id, event_title=event.title,
            event_slug=event.slug, issued_at=cert.issued_at,
        )
        for cert, event in engagement.my_certificates(db, user)
    ]


@router.get("/certificates/{code}/verify", response_model=CertificateVerification, tags=["public"])
def verify_certificate(code: str, db: DbSession, response: Response) -> CertificateVerification:
    cert, attendee, event = engagement.verify_certificate(db, code[:40])
    response.headers["Cache-Control"] = "public, max-age=300"
    return CertificateVerification(
        certificate_code=cert.certificate_code, attendee_name=attendee.full_name, event_title=event.title,
        event_starts_on=event.starts_at.date(), event_ends_on=event.ends_at.date(), issued_at=cert.issued_at,
    )
