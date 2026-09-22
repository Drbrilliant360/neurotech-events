import uuid
from datetime import date, datetime, time
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Integer, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, JSONList, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.models.enums import EventFormat, EventStatus, MilestoneStatus, SessionType, string_enum

if TYPE_CHECKING:
    from app.db.models.identity import Organization
    from app.db.models.sponsors import SponsorEvent
    from app.db.models.ticketing import Registration, TicketType


class Venue(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "venues"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[str | None] = mapped_column(String(300))
    city: Mapped[str | None] = mapped_column(String(120))
    region: Mapped[str | None] = mapped_column(String(120))
    country: Mapped[str | None] = mapped_column(String(120))

    events: Mapped[list["Event"]] = relationship(back_populates="venue")


class Event(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "events"
    __table_args__ = (
        CheckConstraint("ends_at >= starts_at", name="ends_after_starts"),
        CheckConstraint("capacity >= 0", name="capacity_non_negative"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    venue_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("venues.id", ondelete="SET NULL"), index=True)
    slug: Mapped[str] = mapped_column(String(160), nullable=False, unique=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    subtitle: Mapped[str | None] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text)
    theme: Mapped[str | None] = mapped_column(String(200))
    category: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[EventStatus] = mapped_column(
        string_enum(EventStatus, "event_status"), nullable=False, default=EventStatus.DRAFT, index=True
    )
    format: Mapped[EventFormat] = mapped_column(
        string_enum(EventFormat, "event_format"), nullable=False, default=EventFormat.PHYSICAL
    )
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    registration_opens_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    registration_closes_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    banner_label: Mapped[str | None] = mapped_column(String(120))
    highlights: Mapped[list[str]] = mapped_column(JSONList, nullable=False, default=list)
    faqs: Mapped[list[str]] = mapped_column(JSONList, nullable=False, default=list)

    organization: Mapped["Organization"] = relationship(back_populates="events")
    venue: Mapped["Venue | None"] = relationship(back_populates="events")
    sessions: Mapped[list["EventSession"]] = relationship(back_populates="event", cascade="all, delete-orphan")
    milestones: Mapped[list["TimelineMilestone"]] = relationship(back_populates="event", cascade="all, delete-orphan")
    ticket_types: Mapped[list["TicketType"]] = relationship(back_populates="event", cascade="all, delete-orphan")
    registrations: Mapped[list["Registration"]] = relationship(back_populates="event")
    sponsor_links: Mapped[list["SponsorEvent"]] = relationship(back_populates="event", cascade="all, delete-orphan")


class Speaker(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "speakers"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    initials: Mapped[str | None] = mapped_column(String(8))
    role: Mapped[str | None] = mapped_column(String(200))
    organization: Mapped[str | None] = mapped_column(String(200))
    bio: Mapped[str | None] = mapped_column(Text)
    track: Mapped[str | None] = mapped_column(String(120))
    social_url: Mapped[str | None] = mapped_column(String(500))

    sessions: Mapped[list["EventSession"]] = relationship(back_populates="speaker")


class EventSession(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A programme slot. Named EventSession to avoid clashing with the ORM Session."""

    __tablename__ = "sessions"

    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    speaker_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("speakers.id", ondelete="SET NULL"), index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    day_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    day_label: Mapped[str | None] = mapped_column(String(60))
    session_date: Mapped[date] = mapped_column("date", Date, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    speaker_label: Mapped[str | None] = mapped_column(String(200))
    room: Mapped[str | None] = mapped_column(String(120))
    session_type: Mapped[SessionType] = mapped_column(
        "type", string_enum(SessionType, "session_type"), nullable=False, default=SessionType.SESSION
    )
    description: Mapped[str | None] = mapped_column(Text)

    event: Mapped["Event"] = relationship(back_populates="sessions")
    speaker: Mapped["Speaker | None"] = relationship(back_populates="sessions")


class TimelineMilestone(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "timeline_milestones"

    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    milestone_date: Mapped[date] = mapped_column("date", Date, nullable=False)
    status: Mapped[MilestoneStatus] = mapped_column(
        string_enum(MilestoneStatus, "milestone_status"), nullable=False, default=MilestoneStatus.SCHEDULED
    )
    day_index: Mapped[int | None] = mapped_column(Integer)

    event: Mapped["Event"] = relationship(back_populates="milestones")
