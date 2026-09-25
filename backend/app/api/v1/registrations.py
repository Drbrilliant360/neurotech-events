import uuid

from fastapi import APIRouter, status

from app.api.deps import AppSettings, DbSession
from app.api.v1.auth import CurrentUser
from app.schemas.operations import AttendeeTicketOut
from app.schemas.registrations import RegistrationOut
from app.services import operations
from app.services.registrations import attendee_registration, attendee_registrations, cancel_registration

router = APIRouter(prefix="/attendee/registrations", tags=["attendee"])


def to_out(registration) -> RegistrationOut:
    return RegistrationOut(
        id=registration.id,
        event_id=registration.event_id,
        event_slug=registration.event.slug,
        event_title=registration.event.title,
        ticket_type_id=registration.ticket_type_id,
        ticket_name=registration.ticket_type.name,
        ticket_number=registration.ticket_number,
        status=registration.status.value,
        created_at=registration.created_at,
        cancelled_at=registration.cancelled_at,
    )


@router.get("", response_model=list[RegistrationOut])
def list_my_registrations(user: CurrentUser, db: DbSession) -> list[RegistrationOut]:
    return [to_out(item) for item in attendee_registrations(db, user)]


@router.get("/{registration_id}", response_model=RegistrationOut)
def get_my_registration(registration_id: uuid.UUID, user: CurrentUser, db: DbSession) -> RegistrationOut:
    return to_out(attendee_registration(db, user, registration_id))


@router.delete("/{registration_id}", response_model=RegistrationOut, status_code=status.HTTP_200_OK)
def cancel_my_registration(registration_id: uuid.UUID, user: CurrentUser, db: DbSession) -> RegistrationOut:
    return to_out(cancel_registration(db, user, registration_id))


@router.get("/{registration_id}/ticket", response_model=AttendeeTicketOut)
def get_my_ticket(
    registration_id: uuid.UUID, user: CurrentUser, db: DbSession, settings: AppSettings
) -> AttendeeTicketOut:
    """The attendee's ticket with a signed QR payload for door check-in (confirmed only)."""
    registration = attendee_registration(db, user, registration_id)
    return operations.attendee_ticket(settings, registration, operations.active_check_in(db, registration.id))
