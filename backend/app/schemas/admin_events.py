"""Request and response contracts for organiser-facing event management."""

import re
import uuid
from datetime import date, datetime, time
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator, model_validator

from app.db.models.enums import EventFormat, EventStatus, MilestoneStatus, SessionType

SLUG_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
CODE_PATTERN = r"^[a-z0-9][a-z0-9_-]{1,59}$"
CURRENCY_PATTERN = r"^[A-Z]{3}$"


def _https_url(value: str | None) -> str | None:
    """Only absolute http(s) URLs: blocks `javascript:` and other script-capable schemes."""
    if value is None or value == "":
        return None
    value = value.strip()
    if not re.match(r"^https?://[^\s/$.?#][^\s]*$", value, re.IGNORECASE):
        raise ValueError("must be an absolute http(s) URL")
    return value


SafeUrl = Annotated[str | None, Field(default=None, max_length=500), AfterValidator(_https_url)]
ShortText = Annotated[str, Field(min_length=1, max_length=300)]


def _aware(value: datetime | None, field: str) -> datetime | None:
    if value is not None and value.tzinfo is None:
        raise ValueError(f"{field} must include a timezone offset")
    return value


# --------------------------------------------------------------------- events


class EventFields(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    subtitle: str | None = Field(default=None, max_length=300)
    description: str | None = Field(default=None, max_length=20_000)
    theme: str | None = Field(default=None, max_length=200)
    category: str | None = Field(default=None, max_length=100)
    format: EventFormat = EventFormat.PHYSICAL
    starts_at: datetime
    ends_at: datetime
    capacity: int = Field(default=0, ge=0, le=1_000_000)
    registration_opens_at: datetime | None = None
    registration_closes_at: datetime | None = None
    featured: bool = False
    banner_label: str | None = Field(default=None, max_length=120)
    highlights: list[ShortText] = Field(default_factory=list, max_length=30)
    faqs: list[ShortText] = Field(default_factory=list, max_length=50)
    venue_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def _chronology(self):
        for name in ("starts_at", "ends_at", "registration_opens_at", "registration_closes_at"):
            _aware(getattr(self, name), name)
        validate_event_times(self.starts_at, self.ends_at, self.registration_opens_at, self.registration_closes_at)
        return self


def validate_event_times(
    starts_at: datetime, ends_at: datetime, opens: datetime | None, closes: datetime | None
) -> None:
    if ends_at < starts_at:
        raise ValueError("ends_at must not be before starts_at")
    if opens and closes and closes < opens:
        raise ValueError("registration_closes_at must not be before registration_opens_at")
    if closes and closes > ends_at:
        raise ValueError("registration_closes_at must not be after the event ends")


class EventCreate(EventFields):
    slug: str = Field(min_length=2, max_length=160, pattern=SLUG_PATTERN)
    # Optional when the caller manages exactly one organization.
    organization_id: uuid.UUID | None = None


class EventUpdate(BaseModel):
    """Partial update. Omitted fields are unchanged; explicit nulls clear optional fields."""

    slug: str | None = Field(default=None, min_length=2, max_length=160, pattern=SLUG_PATTERN)
    title: str | None = Field(default=None, min_length=2, max_length=200)
    subtitle: str | None = Field(default=None, max_length=300)
    description: str | None = Field(default=None, max_length=20_000)
    theme: str | None = Field(default=None, max_length=200)
    category: str | None = Field(default=None, max_length=100)
    format: EventFormat | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    capacity: int | None = Field(default=None, ge=0, le=1_000_000)
    registration_opens_at: datetime | None = None
    registration_closes_at: datetime | None = None
    featured: bool | None = None
    banner_label: str | None = Field(default=None, max_length=120)
    highlights: list[ShortText] | None = Field(default=None, max_length=30)
    faqs: list[ShortText] | None = Field(default=None, max_length=50)
    venue_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def _timezones(self):
        for name in ("starts_at", "ends_at", "registration_opens_at", "registration_closes_at"):
            _aware(getattr(self, name), name)
        return self


class EventStatusChange(BaseModel):
    status: EventStatus
    reason: str | None = Field(default=None, max_length=500)


class VenueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    address: str | None
    city: str | None
    region: str | None
    country: str | None


class EventCounts(BaseModel):
    registrations: int = 0
    confirmed: int = 0
    pending: int = 0
    checked_in: int = 0


class AdminEventOut(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    slug: str
    title: str
    subtitle: str | None
    description: str | None
    theme: str | None
    category: str | None
    status: str
    format: str
    starts_at: datetime
    ends_at: datetime
    capacity: int
    registration_opens_at: datetime | None
    registration_closes_at: datetime | None
    featured: bool
    banner_label: str | None
    highlights: list[str]
    faqs: list[str]
    venue: VenueOut | None
    counts: EventCounts
    created_at: datetime
    updated_at: datetime


class AdminEventPage(BaseModel):
    items: list[AdminEventOut]
    total: int
    page: int
    page_size: int


# --------------------------------------------------------------- ticket types


class TicketTypeFields(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    tier: str = Field(min_length=1, max_length=40)
    price: int = Field(ge=0, le=100_000_000)
    currency: str | None = Field(default=None, pattern=CURRENCY_PATTERN)
    perks: str | None = Field(default=None, max_length=2000)
    capacity: int = Field(ge=0, le=1_000_000)
    sales_start_at: datetime | None = None
    sales_end_at: datetime | None = None
    active: bool = True
    sort_order: int = Field(default=0, ge=0, le=10_000)

    @model_validator(mode="after")
    def _window(self):
        _aware(self.sales_start_at, "sales_start_at")
        _aware(self.sales_end_at, "sales_end_at")
        if self.sales_start_at and self.sales_end_at and self.sales_end_at < self.sales_start_at:
            raise ValueError("sales_end_at must not be before sales_start_at")
        return self


class TicketTypeCreate(TicketTypeFields):
    code: str | None = Field(default=None, pattern=CODE_PATTERN)


class TicketTypeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    tier: str | None = Field(default=None, min_length=1, max_length=40)
    price: int | None = Field(default=None, ge=0, le=100_000_000)
    perks: str | None = Field(default=None, max_length=2000)
    capacity: int | None = Field(default=None, ge=0, le=1_000_000)
    sales_start_at: datetime | None = None
    sales_end_at: datetime | None = None
    active: bool | None = None
    sort_order: int | None = Field(default=None, ge=0, le=10_000)

    @model_validator(mode="after")
    def _timezones(self):
        _aware(self.sales_start_at, "sales_start_at")
        _aware(self.sales_end_at, "sales_end_at")
        return self


class AdminTicketTypeOut(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    code: str | None
    name: str
    tier: str
    price: int
    currency: str
    perks: str | None
    capacity: int
    sold: int
    available: int
    sales_start_at: datetime | None
    sales_end_at: datetime | None
    active: bool
    sort_order: int


# -------------------------------------------------------------------- program


class SpeakerFields(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    initials: str | None = Field(default=None, max_length=8)
    role: str | None = Field(default=None, max_length=200)
    organization: str | None = Field(default=None, max_length=200)
    bio: str | None = Field(default=None, max_length=5000)
    track: str | None = Field(default=None, max_length=120)
    social_url: SafeUrl = None


class SpeakerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    initials: str | None = Field(default=None, max_length=8)
    role: str | None = Field(default=None, max_length=200)
    organization: str | None = Field(default=None, max_length=200)
    bio: str | None = Field(default=None, max_length=5000)
    track: str | None = Field(default=None, max_length=120)
    social_url: SafeUrl = None


class SpeakerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    initials: str | None
    role: str | None
    organization: str | None
    bio: str | None
    track: str | None
    social_url: str | None


class SessionFields(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    session_date: date
    start_time: time
    end_time: time
    day_label: str | None = Field(default=None, max_length=60)
    room: str | None = Field(default=None, max_length=120)
    session_type: SessionType = SessionType.SESSION
    description: str | None = Field(default=None, max_length=5000)
    speaker_id: uuid.UUID | None = None
    speaker_label: str | None = Field(default=None, max_length=200)

    @model_validator(mode="after")
    def _times(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class SessionUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    session_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    day_label: str | None = Field(default=None, max_length=60)
    room: str | None = Field(default=None, max_length=120)
    session_type: SessionType | None = None
    description: str | None = Field(default=None, max_length=5000)
    speaker_id: uuid.UUID | None = None
    speaker_label: str | None = Field(default=None, max_length=200)


class SessionOut(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    title: str
    day_index: int
    day_label: str | None
    session_date: date
    start_time: time
    end_time: time
    room: str | None
    session_type: str
    description: str | None
    speaker_label: str | None
    speaker: SpeakerOut | None


class MilestoneFields(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    milestone_date: date
    status: MilestoneStatus = MilestoneStatus.SCHEDULED
    day_index: int | None = Field(default=None, ge=0, le=365)


class MilestoneUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    milestone_date: date | None = None
    status: MilestoneStatus | None = None
    day_index: int | None = Field(default=None, ge=0, le=365)


class MilestoneOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    event_id: uuid.UUID
    title: str
    milestone_date: date
    status: str
    day_index: int | None


class ProgramOut(BaseModel):
    event_slug: str
    sessions: list[SessionOut]
    milestones: list[MilestoneOut]


# --------------------------------------------------------------------- venues


class VenueFields(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    address: str | None = Field(default=None, max_length=300)
    city: str | None = Field(default=None, max_length=120)
    region: str | None = Field(default=None, max_length=120)
    country: str | None = Field(default=None, max_length=120)


class VenueUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    address: str | None = Field(default=None, max_length=300)
    city: str | None = Field(default=None, max_length=120)
    region: str | None = Field(default=None, max_length=120)
    country: str | None = Field(default=None, max_length=120)

    @field_validator("name")
    @classmethod
    def _strip(cls, value: str | None) -> str | None:
        return value.strip() if value else value
