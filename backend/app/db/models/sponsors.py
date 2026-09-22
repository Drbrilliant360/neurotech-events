import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.models.enums import SponsorTier, string_enum

if TYPE_CHECKING:
    from app.db.models.events import Event


class Sponsor(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "sponsors"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    tier: Mapped[SponsorTier] = mapped_column(string_enum(SponsorTier, "sponsor_tier"), nullable=False)
    website: Mapped[str | None] = mapped_column(String(500))
    contact: Mapped[str | None] = mapped_column(String(320))
    logo_url: Mapped[str | None] = mapped_column(String(500))
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    event_links: Mapped[list["SponsorEvent"]] = relationship(back_populates="sponsor", cascade="all, delete-orphan")


class SponsorEvent(Base):
    """Join table replacing the frontend's `eventIds` array on Sponsor."""

    __tablename__ = "sponsor_events"

    sponsor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sponsors.id", ondelete="CASCADE"), primary_key=True)
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    sponsor: Mapped["Sponsor"] = relationship(back_populates="event_links")
    event: Mapped["Event"] = relationship(back_populates="sponsor_links")
