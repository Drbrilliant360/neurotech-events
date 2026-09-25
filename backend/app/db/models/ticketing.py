import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.models.enums import PaymentMethod, PaymentStatus, RegistrationStatus, string_enum

if TYPE_CHECKING:
    from app.db.models.events import Event
    from app.db.models.identity import Attendee, User


class TicketType(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A purchasable ticket product for one event.

    `tier` is an open string rather than a closed enum so organisers can add products
    without a code change. Quantity sold is derived from registrations, not stored.
    """

    __tablename__ = "ticket_types"
    __table_args__ = (
        CheckConstraint("price >= 0", name="price_non_negative"),
        CheckConstraint("capacity >= 0", name="capacity_non_negative"),
        UniqueConstraint("event_id", "code", name="uq_ticket_types_event_code"),
    )

    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    # Stable, human-readable product code (e.g. "tt_summit_std"). Lets clients reference a
    # ticket without knowing its UUID while the server still owns the price.
    code: Mapped[str | None] = mapped_column(String(60))
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    tier: Mapped[str] = mapped_column(String(40), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="TZS")
    perks: Mapped[str | None] = mapped_column(Text)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sales_start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sales_end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    event: Mapped["Event"] = relationship(back_populates="ticket_types")
    registrations: Mapped[list["Registration"]] = relationship(back_populates="ticket_type")


class Registration(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "registrations"
    __table_args__ = (
        Index("ix_registrations_event_attendee", "event_id", "attendee_id"),
        # Serves the seat-count query used on every checkout and availability read.
        Index("ix_registrations_ticket_status_created", "ticket_type_id", "status", "created_at"),
    )

    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    attendee_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("attendees.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    ticket_type_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ticket_types.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    status: Mapped[RegistrationStatus] = mapped_column(
        string_enum(RegistrationStatus, "registration_status"),
        nullable=False,
        default=RegistrationStatus.PENDING,
        index=True,
    )
    ticket_number: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    dietary: Mapped[str | None] = mapped_column(Text)
    accessibility: Mapped[str | None] = mapped_column(Text)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    event: Mapped["Event"] = relationship(back_populates="registrations")
    attendee: Mapped["Attendee"] = relationship(back_populates="registrations")
    ticket_type: Mapped["TicketType"] = relationship(back_populates="registrations")
    payments: Mapped[list["Payment"]] = relationship(back_populates="registration")
    check_ins: Mapped[list["CheckIn"]] = relationship(back_populates="registration")


class Payment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Money owed or paid for a registration. Status is only ever set by the server."""

    __tablename__ = "payments"
    __table_args__ = (CheckConstraint("amount >= 0", name="amount_non_negative"),)

    registration_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("registrations.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    attendee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("attendees.id", ondelete="RESTRICT"), nullable=False)
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    reference: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    method: Mapped[PaymentMethod] = mapped_column(string_enum(PaymentMethod, "payment_method"), nullable=False)
    status: Mapped[PaymentStatus] = mapped_column(
        string_enum(PaymentStatus, "payment_status"), nullable=False, default=PaymentStatus.PENDING, index=True
    )
    provider: Mapped[str | None] = mapped_column(String(60))
    provider_reference: Mapped[str | None] = mapped_column(String(120), index=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    registration: Mapped["Registration"] = relationship(back_populates="payments")
    events: Mapped[list["PaymentEvent"]] = relationship(
        back_populates="payment", cascade="all, delete-orphan", order_by="PaymentEvent.created_at"
    )


class PaymentEvent(UUIDPrimaryKeyMixin, Base):
    """Append-only audit trail of payment status transitions."""

    __tablename__ = "payment_events"

    payment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("payments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_status: Mapped[PaymentStatus | None] = mapped_column(string_enum(PaymentStatus, "payment_event_from_status"))
    to_status: Mapped[PaymentStatus] = mapped_column(
        string_enum(PaymentStatus, "payment_event_to_status"), nullable=False
    )
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    payment: Mapped["Payment"] = relationship(back_populates="events")


class CheckIn(UUIDPrimaryKeyMixin, Base):
    """Door check-in record. Undo is recorded, never deleted."""

    __tablename__ = "check_ins"
    __table_args__ = (Index("ix_check_ins_event_undone", "event_id", "undone"),)

    registration_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("registrations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    attendee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("attendees.id", ondelete="RESTRICT"), nullable=False)
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    ticket_number: Mapped[str] = mapped_column(String(40), nullable=False)
    checked_in_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    checked_in_by_user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id", ondelete="SET NULL"))
    undone: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    undone_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    registration: Mapped["Registration"] = relationship(back_populates="check_ins")
    checked_in_by: Mapped["User | None"] = relationship()


class Certificate(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "certificates"
    __table_args__ = (UniqueConstraint("attendee_id", "event_id", name="uq_certificates_attendee_event"),)

    attendee_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("attendees.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    certificate_code: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
