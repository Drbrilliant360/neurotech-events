import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, JSONList, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.models.enums import (
    AudienceSegment,
    CommunicationChannel,
    CommunicationStatus,
    NotificationCategory,
    string_enum,
)

if TYPE_CHECKING:
    from app.db.models.identity import Attendee


class Notification(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """In-app notification shown on the attendee dashboard."""

    __tablename__ = "notifications"

    attendee_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("attendees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    category: Mapped[NotificationCategory] = mapped_column(
        string_enum(NotificationCategory, "notification_category"), nullable=False
    )
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Communication(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """An organiser broadcast to an audience segment. Delivery records come in a later phase."""

    __tablename__ = "communications"

    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    channel: Mapped[CommunicationChannel] = mapped_column(
        string_enum(CommunicationChannel, "communication_channel"), nullable=False
    )
    audience: Mapped[AudienceSegment] = mapped_column(
        string_enum(AudienceSegment, "audience_segment"), nullable=False, default=AudienceSegment.ALL
    )
    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[CommunicationStatus] = mapped_column(
        string_enum(CommunicationStatus, "communication_status"),
        nullable=False,
        default=CommunicationStatus.DRAFT,
        index=True,
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class NetworkingProfile(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "networking_profiles"

    attendee_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("attendees.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    public_name: Mapped[str] = mapped_column(String(200), nullable=False)
    initials: Mapped[str | None] = mapped_column(String(8))
    job_title: Mapped[str | None] = mapped_column(String(200))
    organization: Mapped[str | None] = mapped_column(String(200))
    interests: Mapped[list[str]] = mapped_column(JSONList, nullable=False, default=list)
    bio: Mapped[str | None] = mapped_column(Text)
    is_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    attendee: Mapped["Attendee"] = relationship(back_populates="networking_profile")


class Connection(UUIDPrimaryKeyMixin, Base):
    """Directed connection request/link between two attendees."""

    __tablename__ = "connections"
    __table_args__ = (
        UniqueConstraint("from_attendee_id", "to_attendee_id", name="uq_connections_pair"),
        CheckConstraint("from_attendee_id <> to_attendee_id", name="not_self"),
    )

    from_attendee_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("attendees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    to_attendee_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("attendees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class SavedSession(Base):
    """An attendee's personal agenda entry."""

    __tablename__ = "saved_sessions"

    attendee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("attendees.id", ondelete="CASCADE"), primary_key=True)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
