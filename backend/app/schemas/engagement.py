"""Attendee engagement (agenda, networking, notifications, certificates) and organiser outreach
(sponsors, communications)."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.db.models.enums import AudienceSegment, CommunicationChannel, NotificationCategory, SponsorTier
from app.schemas.admin_events import SafeUrl

# ------------------------------------------------------------------ attendee


class SavedSessionOut(BaseModel):
    session_id: uuid.UUID
    event_id: uuid.UUID
    saved_at: datetime


class NetworkingProfileIn(BaseModel):
    public_name: str = Field(min_length=2, max_length=200)
    job_title: str | None = Field(default=None, max_length=200)
    organization: str | None = Field(default=None, max_length=200)
    interests: list[str] = Field(default_factory=list, max_length=20)
    bio: str | None = Field(default=None, max_length=1000)
    is_visible: bool = True

    @field_validator("interests")
    @classmethod
    def _clean(cls, value: list[str]) -> list[str]:
        return [item.strip()[:60] for item in value if item.strip()]


class NetworkingProfileOut(BaseModel):
    """What other attendees may see. Never includes email or phone."""

    model_config = ConfigDict(from_attributes=True)

    attendee_id: uuid.UUID
    public_name: str
    initials: str | None
    job_title: str | None
    organization: str | None
    interests: list[str]
    bio: str | None


class MyNetworkingProfileOut(NetworkingProfileOut):
    is_visible: bool


class NetworkingOut(BaseModel):
    profile: MyNetworkingProfileOut | None
    people: list[NetworkingProfileOut]
    # Attendee ids this attendee has connected with.
    connections: list[uuid.UUID]


class ConnectionIn(BaseModel):
    attendee_id: uuid.UUID


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    body: str | None
    category: NotificationCategory
    is_read: bool
    created_at: datetime


class CertificateOut(BaseModel):
    id: uuid.UUID
    certificate_code: str
    event_id: uuid.UUID
    event_title: str
    event_slug: str
    issued_at: datetime


class CertificateVerification(BaseModel):
    """Public verification: enough to confirm a certificate, nothing more."""

    certificate_code: str
    attendee_name: str
    event_title: str
    event_starts_on: date
    event_ends_on: date
    issued_at: datetime


# ----------------------------------------------------------------- organiser


class SponsorFields(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    tier: SponsorTier = SponsorTier.PARTNER
    website: SafeUrl = None
    contact: EmailStr | None = None
    active: bool = True
    event_ids: list[uuid.UUID] = Field(default_factory=list, max_length=50)


class SponsorUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    tier: SponsorTier | None = None
    website: SafeUrl = None
    contact: EmailStr | None = None
    active: bool | None = None
    event_ids: list[uuid.UUID] | None = Field(default=None, max_length=50)


class SponsorOut(BaseModel):
    id: uuid.UUID
    name: str
    tier: SponsorTier
    website: str | None
    contact: str | None
    active: bool
    event_ids: list[uuid.UUID]


class PublicSponsorOut(BaseModel):
    """Sponsor as shown on public pages: no contact address."""

    id: uuid.UUID
    name: str
    tier: SponsorTier
    website: str | None
    event_ids: list[uuid.UUID]


class CommunicationFields(BaseModel):
    channel: CommunicationChannel = CommunicationChannel.EMAIL
    audience: AudienceSegment = AudienceSegment.ALL
    subject: str = Field(min_length=2, max_length=200)
    body: str = Field(min_length=2, max_length=5000)


class CommunicationUpdate(BaseModel):
    channel: CommunicationChannel | None = None
    audience: AudienceSegment | None = None
    subject: str | None = Field(default=None, min_length=2, max_length=200)
    body: str | None = Field(default=None, min_length=2, max_length=5000)


class CommunicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    event_id: uuid.UUID
    channel: CommunicationChannel
    audience: AudienceSegment
    subject: str
    body: str
    status: str
    created_at: datetime
    sent_at: datetime | None


class CommunicationSendOut(CommunicationOut):
    # Attendees who received the in-app notification.
    recipients: int
    # Email/SMS/push need a provider; until one is configured only the in-app copy is delivered.
    external_delivery: str


class CertificateIssueOut(BaseModel):
    issued: int
    total: int
