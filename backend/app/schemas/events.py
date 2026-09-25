import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class VenueOut(BaseModel):
    id: uuid.UUID
    name: str
    city: str | None
    country: str | None


class TicketQuoteOut(BaseModel):
    """Server-authoritative price for one ticket type."""

    event_slug: str
    code: str
    name: str
    tier: str
    currency: str
    price: int
    vat_percent: Decimal
    vat: int
    total: int
    active: bool
    capacity: int
    sold: int
    available: int
    payable_online: bool


class TicketTypeOut(BaseModel):
    id: uuid.UUID
    code: str | None
    name: str
    tier: str
    price: int
    currency: str
    perks: str | None
    capacity: int
    sold: int
    active: bool


class EventSummaryOut(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    slug: str
    title: str
    subtitle: str | None
    category: str | None
    status: str
    format: str
    starts_at: datetime
    ends_at: datetime
    capacity: int
    featured: bool
    banner_label: str | None
    venue: VenueOut | None


class EventDetailOut(EventSummaryOut):
    description: str | None
    theme: str | None
    registration_opens_at: datetime | None
    registration_closes_at: datetime | None
    highlights: list[str]
    faqs: list[str]
    ticket_types: list[TicketTypeOut]


class CatalogueEventIn(BaseModel):
    """An event as the admin console knows it. `id` is the console's own identifier."""

    id: str = Field(min_length=1, max_length=80)
    slug: str = Field(min_length=1, max_length=160)
    title: str = Field(min_length=1, max_length=200)
    subtitle: str | None = Field(default=None, max_length=300)
    description: str | None = None
    theme: str | None = Field(default=None, max_length=200)
    category: str | None = Field(default=None, max_length=100)
    status: str
    format: str
    starts_at: datetime
    ends_at: datetime
    capacity: int = Field(ge=0)
    registration_opens_at: datetime | None = None
    registration_closes_at: datetime | None = None
    featured: bool = False
    banner_label: str | None = Field(default=None, max_length=120)
    highlights: list[str] = Field(default_factory=list)
    faqs: list[str] = Field(default_factory=list)
    venue_name: str | None = Field(default=None, max_length=200)
    venue_city: str | None = Field(default=None, max_length=120)


class CatalogueTicketIn(BaseModel):
    id: str = Field(min_length=1, max_length=60)
    event_id: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=120)
    tier: str = Field(min_length=1, max_length=40)
    price: int = Field(ge=0)
    currency: str = Field(default="TZS", min_length=3, max_length=3)
    perks: str | None = None
    capacity: int = Field(ge=0)
    active: bool = True


class CatalogueSyncIn(BaseModel):
    events: list[CatalogueEventIn]
    ticket_types: list[CatalogueTicketIn]
    vat_percent: Decimal | None = Field(default=None, ge=0, le=100)


class CatalogueSyncOut(BaseModel):
    events_upserted: int
    ticket_types_upserted: int
    ticket_types_deactivated: int
