"""Organiser API for shared directories: speakers and venues."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel

from app.api.deps import DbSession
from app.api.v1.auth import CurrentUser
from app.db.models import User
from app.schemas.admin_events import SpeakerFields, SpeakerOut, SpeakerUpdate, VenueFields, VenueOut, VenueUpdate
from app.services import event_admin
from app.services.authorization import require_organizer


def organizer(user: CurrentUser, db: DbSession) -> User:
    require_organizer(db, user)
    return user


Organizer = Annotated[User, Depends(organizer)]

router = APIRouter(prefix="/admin", tags=["admin: directory"])


class SpeakerPage(BaseModel):
    items: list[SpeakerOut]
    total: int
    page: int
    page_size: int


@router.get("/speakers", response_model=SpeakerPage)
def list_speakers(
    user: Organizer,
    db: DbSession,
    q: Annotated[str | None, Query(max_length=100)] = None,
    page: Annotated[int, Query(ge=1, le=10_000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> SpeakerPage:
    items, total = event_admin.list_speakers(db, q=q, page=page, page_size=page_size)
    return SpeakerPage(
        items=[SpeakerOut.model_validate(item) for item in items], total=total, page=page, page_size=page_size
    )


@router.post("/speakers", response_model=SpeakerOut, status_code=status.HTTP_201_CREATED)
def create_speaker(payload: SpeakerFields, user: Organizer, db: DbSession) -> SpeakerOut:
    return SpeakerOut.model_validate(event_admin.create_speaker(db, user, payload))


@router.patch("/speakers/{speaker_id}", response_model=SpeakerOut)
def update_speaker(speaker_id: uuid.UUID, payload: SpeakerUpdate, user: Organizer, db: DbSession) -> SpeakerOut:
    return SpeakerOut.model_validate(event_admin.update_speaker(db, user, speaker_id, payload))


@router.delete("/speakers/{speaker_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_speaker(speaker_id: uuid.UUID, user: Organizer, db: DbSession) -> None:
    """Remove a speaker. Their sessions stay on the programme without a linked speaker."""
    event_admin.delete_speaker(db, user, speaker_id)


@router.get("/venues", response_model=list[VenueOut])
def list_venues(user: Organizer, db: DbSession) -> list[VenueOut]:
    return [VenueOut.model_validate(item) for item in event_admin.list_venues(db)]


@router.post("/venues", response_model=VenueOut, status_code=status.HTTP_201_CREATED)
def create_venue(payload: VenueFields, user: Organizer, db: DbSession) -> VenueOut:
    return VenueOut.model_validate(event_admin.create_venue(db, user, payload))


@router.patch("/venues/{venue_id}", response_model=VenueOut)
def update_venue(venue_id: uuid.UUID, payload: VenueUpdate, user: Organizer, db: DbSession) -> VenueOut:
    return VenueOut.model_validate(event_admin.update_venue(db, user, venue_id, payload))
