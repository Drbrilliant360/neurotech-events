import uuid

from fastapi import APIRouter, status

from app.api.deps import AppSettings, DbSession
from app.api.v1.auth import CurrentUser
from app.schemas.operations import AttendeeTicketOut
from app.schemas.registrations import RegistrationOut
from app.services import operations
from app.services.registrations import (
    attendee_registration,
    attendee_registrations,
    cancel_registration,
    to_outs,
)

router = APIRouter(prefix="/attendee/registrations", tags=["attendee"])


@router.get("", response_model=list[RegistrationOut])
def list_my_registrations(user: CurrentUser, db: DbSession) -> list[RegistrationOut]:
    return to_outs(db, attendee_registrations(db, user))


@router.get("/{registration_id}", response_model=RegistrationOut)
def get_my_registration(registration_id: uuid.UUID, user: CurrentUser, db: DbSession) -> RegistrationOut:
    return to_outs(db, [attendee_registration(db, user, registration_id)])[0]


@router.delete("/{registration_id}", response_model=RegistrationOut, status_code=status.HTTP_200_OK)
def cancel_my_registration(registration_id: uuid.UUID, user: CurrentUser, db: DbSession) -> RegistrationOut:
    return to_outs(db, [cancel_registration(db, user, registration_id)])[0]


@router.get("/{registration_id}/ticket", response_model=AttendeeTicketOut)
def get_my_ticket(
    registration_id: uuid.UUID, user: CurrentUser, db: DbSession, settings: AppSettings
) -> AttendeeTicketOut:
    """The attendee's ticket with a signed QR payload for door check-in (confirmed only)."""
    registration = attendee_registration(db, user, registration_id)
    return operations.attendee_ticket(settings, registration, operations.active_check_in(db, registration.id))
