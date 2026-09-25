"""Aggregate read models that let a client hydrate a whole screen in one request."""

import uuid
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.admin_events import (
    AdminEventOut,
    AdminTicketTypeOut,
    MilestoneOut,
    SessionOut,
    SpeakerOut,
    VenueOut,
)
from app.schemas.authorization import EventAccessResponse
from app.schemas.events import EventDetailOut
from app.schemas.operations import AdminRegistrationOut, CheckInOut
from app.schemas.payments import PaymentOut


class OrganizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    brand_name: str
    contact_email: str
    contact_phone: str | None
    default_currency: str
    default_city: str | None
    default_country: str | None
    vat_percent: Decimal
    registration_open_by_default: bool
    notify_on_registration: bool
    notify_on_payment: bool


class OrganizationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    brand_name: str | None = Field(default=None, min_length=2, max_length=200)
    contact_email: EmailStr | None = None
    contact_phone: str | None = Field(default=None, max_length=40)
    default_currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    default_city: str | None = Field(default=None, max_length=120)
    default_country: str | None = Field(default=None, max_length=120)
    vat_percent: Decimal | None = Field(default=None, ge=0, le=100)
    registration_open_by_default: bool | None = None
    notify_on_registration: bool | None = None
    notify_on_payment: bool | None = None


class PublicCatalogueOut(BaseModel):
    """Everything the public site renders: published events with tickets, programme and settings."""

    organization: OrganizationOut | None
    events: list[EventDetailOut]
    venues: list[VenueOut]
    sessions: list[SessionOut]
    speakers: list[SpeakerOut]
    milestones: list[MilestoneOut]


class AdminWorkspaceOut(BaseModel):
    """Everything the organiser console may show, filtered per event by the caller's access."""

    organizations: list[OrganizationOut]
    events: list[AdminEventOut]
    access: list[EventAccessResponse]
    ticket_types: list[AdminTicketTypeOut]
    sessions: list[SessionOut]
    milestones: list[MilestoneOut]
    speakers: list[SpeakerOut]
    venues: list[VenueOut]
    # Only for events where the caller has `manage`.
    registrations: list[AdminRegistrationOut]
    # Only for events where the caller has `check_in`.
    check_ins: list[CheckInOut]
    # Only for events where the caller has `finance`.
    payments: list[PaymentOut]
