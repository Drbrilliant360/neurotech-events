"""Organiser API: events, ticket types, programme and timeline, scoped per event."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import DbSession
from app.api.v1.auth import CurrentUser
from app.db.models import Event, User
from app.db.models.enums import EventStatus
from app.schemas.admin_events import (
    AdminEventOut,
    AdminEventPage,
    AdminTicketTypeOut,
    EventCreate,
    EventStatusChange,
    EventUpdate,
    MilestoneFields,
    MilestoneOut,
    MilestoneUpdate,
    SessionFields,
    SessionOut,
    SessionUpdate,
    TicketTypeCreate,
    TicketTypeUpdate,
)
from app.services import event_admin
from app.services.authorization import Capability, require_event

router = APIRouter(prefix="/admin/events", tags=["admin: events"])

Page = Annotated[int, Query(ge=1, le=10_000)]
PageSize = Annotated[int, Query(ge=1, le=100)]


def _event(db: DbSession, user: User, event_id: uuid.UUID, capability: Capability = Capability.MANAGE) -> Event:
    return require_event(db, user, event_id, capability)[0]


# --------------------------------------------------------------------- events


@router.get("", response_model=AdminEventPage)
def list_events(
    user: CurrentUser,
    db: DbSession,
    status_filter: Annotated[EventStatus | None, Query(alias="status")] = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    page: Page = 1,
    page_size: PageSize = 25,
) -> AdminEventPage:
    """Events the caller can see through any platform, organization or event role."""
    items, total = event_admin.list_events(db, user, status=status_filter, q=q, page=page, page_size=page_size)
    return AdminEventPage(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=AdminEventOut, status_code=status.HTTP_201_CREATED)
def create_event(payload: EventCreate, user: CurrentUser, db: DbSession) -> AdminEventOut:
    """Create a draft event. Requires owner/admin on the organization (or platform admin)."""
    return event_admin.event_out(db, event_admin.create_event(db, user, payload))


@router.get("/{event_id}", response_model=AdminEventOut)
def get_event(event_id: uuid.UUID, user: CurrentUser, db: DbSession) -> AdminEventOut:
    return event_admin.event_out(db, _event(db, user, event_id, Capability.VIEW))


@router.patch("/{event_id}", response_model=AdminEventOut)
def update_event(event_id: uuid.UUID, payload: EventUpdate, user: CurrentUser, db: DbSession) -> AdminEventOut:
    event = _event(db, user, event_id)
    return event_admin.event_out(db, event_admin.update_event(db, user, event, payload))


@router.post("/{event_id}/status", response_model=AdminEventOut)
def change_status(
    event_id: uuid.UUID, payload: EventStatusChange, user: CurrentUser, db: DbSession
) -> AdminEventOut:
    """Publish, start, complete, cancel or unpublish an event, following allowed transitions."""
    event = _event(db, user, event_id)
    return event_admin.event_out(db, event_admin.change_event_status(db, user, event, payload))


@router.post("/{event_id}/duplicate", response_model=AdminEventOut, status_code=status.HTTP_201_CREATED)
def duplicate_event(event_id: uuid.UUID, user: CurrentUser, db: DbSession) -> AdminEventOut:
    """Copy the event, its ticket types and sessions into a new draft."""
    event = _event(db, user, event_id)
    return event_admin.event_out(db, event_admin.duplicate_event(db, user, event))


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: uuid.UUID, user: CurrentUser, db: DbSession) -> None:
    event_admin.delete_event(db, user, _event(db, user, event_id))


# --------------------------------------------------------------- ticket types


@router.get("/{event_id}/ticket-types", response_model=list[AdminTicketTypeOut])
def list_ticket_types(event_id: uuid.UUID, user: CurrentUser, db: DbSession) -> list[AdminTicketTypeOut]:
    return event_admin.list_ticket_types(db, _event(db, user, event_id, Capability.VIEW))


@router.post("/{event_id}/ticket-types", response_model=AdminTicketTypeOut, status_code=status.HTTP_201_CREATED)
def create_ticket_type(
    event_id: uuid.UUID, payload: TicketTypeCreate, user: CurrentUser, db: DbSession
) -> AdminTicketTypeOut:
    event = _event(db, user, event_id)
    return event_admin.ticket_out(db, event_admin.create_ticket_type(db, user, event, payload))


@router.patch("/{event_id}/ticket-types/{ticket_type_id}", response_model=AdminTicketTypeOut)
def update_ticket_type(
    event_id: uuid.UUID, ticket_type_id: uuid.UUID, payload: TicketTypeUpdate, user: CurrentUser, db: DbSession
) -> AdminTicketTypeOut:
    event = _event(db, user, event_id)
    return event_admin.ticket_out(db, event_admin.update_ticket_type(db, user, event, ticket_type_id, payload))


@router.delete("/{event_id}/ticket-types/{ticket_type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ticket_type(event_id: uuid.UUID, ticket_type_id: uuid.UUID, user: CurrentUser, db: DbSession) -> None:
    event_admin.delete_ticket_type(db, user, _event(db, user, event_id), ticket_type_id)


# ------------------------------------------------------------------- sessions


@router.get("/{event_id}/sessions", response_model=list[SessionOut])
def list_sessions(event_id: uuid.UUID, user: CurrentUser, db: DbSession) -> list[SessionOut]:
    event = _event(db, user, event_id, Capability.VIEW)
    return [event_admin.to_session_out(item) for item in event_admin.list_sessions(db, event.id)]


@router.post("/{event_id}/sessions", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def create_session(event_id: uuid.UUID, payload: SessionFields, user: CurrentUser, db: DbSession) -> SessionOut:
    event = _event(db, user, event_id)
    return event_admin.to_session_out(event_admin.create_session(db, user, event, payload))


@router.patch("/{event_id}/sessions/{session_id}", response_model=SessionOut)
def update_session(
    event_id: uuid.UUID, session_id: uuid.UUID, payload: SessionUpdate, user: CurrentUser, db: DbSession
) -> SessionOut:
    event = _event(db, user, event_id)
    return event_admin.to_session_out(event_admin.update_session(db, user, event, session_id, payload))


@router.delete("/{event_id}/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(event_id: uuid.UUID, session_id: uuid.UUID, user: CurrentUser, db: DbSession) -> None:
    event_admin.delete_session(db, user, _event(db, user, event_id), session_id)


# ----------------------------------------------------------------- milestones


@router.get("/{event_id}/milestones", response_model=list[MilestoneOut])
def list_milestones(event_id: uuid.UUID, user: CurrentUser, db: DbSession) -> list[MilestoneOut]:
    event = _event(db, user, event_id, Capability.VIEW)
    return [event_admin.to_milestone_out(item) for item in event_admin.list_milestones(db, event.id)]


@router.post("/{event_id}/milestones", response_model=MilestoneOut, status_code=status.HTTP_201_CREATED)
def create_milestone(
    event_id: uuid.UUID, payload: MilestoneFields, user: CurrentUser, db: DbSession
) -> MilestoneOut:
    event = _event(db, user, event_id)
    return event_admin.to_milestone_out(event_admin.create_milestone(db, user, event, payload))


@router.patch("/{event_id}/milestones/{milestone_id}", response_model=MilestoneOut)
def update_milestone(
    event_id: uuid.UUID, milestone_id: uuid.UUID, payload: MilestoneUpdate, user: CurrentUser, db: DbSession
) -> MilestoneOut:
    event = _event(db, user, event_id)
    return event_admin.to_milestone_out(event_admin.update_milestone(db, user, event, milestone_id, payload))


@router.delete("/{event_id}/milestones/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_milestone(event_id: uuid.UUID, milestone_id: uuid.UUID, user: CurrentUser, db: DbSession) -> None:
    event_admin.delete_milestone(db, user, _event(db, user, event_id), milestone_id)
