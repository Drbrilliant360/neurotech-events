import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, JSONList, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.models.enums import OrganizationRole, UserRole, string_enum

if TYPE_CHECKING:
    from app.db.models.engagement import NetworkingProfile
    from app.db.models.events import Event
    from app.db.models.ticketing import Registration


class Organization(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """The organiser running events. Carries what the frontend calls OrganizationSettings."""

    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    brand_name: Mapped[str] = mapped_column(String(200), nullable=False)
    contact_email: Mapped[str] = mapped_column(String(320), nullable=False)
    contact_phone: Mapped[str | None] = mapped_column(String(40))
    default_currency: Mapped[str] = mapped_column(String(3), nullable=False, default="TZS")
    default_city: Mapped[str | None] = mapped_column(String(120))
    default_country: Mapped[str | None] = mapped_column(String(120))
    vat_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("0"))
    registration_open_by_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notify_on_registration: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notify_on_payment: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    events: Mapped[list["Event"]] = relationship(back_populates="organization")
    memberships: Mapped[list["OrganizationMembership"]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )


class OrganizationMembership(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "organization_memberships"
    __table_args__ = (UniqueConstraint("organization_id", "user_id", name="uq_org_membership_user"),)

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role: Mapped[OrganizationRole] = mapped_column(
        string_enum(OrganizationRole, "organization_role"), nullable=False, default=OrganizationRole.MEMBER
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    organization: Mapped["Organization"] = relationship(back_populates="memberships")
    user: Mapped["User"] = relationship(back_populates="organization_memberships")


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Login identity. Authorization is decided server-side from `role`."""

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        string_enum(UserRole, "user_role"), nullable=False, default=UserRole.ATTENDEE
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Embedded in access tokens; incrementing it revokes every token issued before.
    token_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=text("0"))

    attendee: Mapped["Attendee | None"] = relationship(back_populates="user", uselist=False)
    organization_memberships: Mapped[list[OrganizationMembership]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    event_assignments: Mapped[list["EventStaffAssignment"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Attendee(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Person who registers for events. May exist without a login (e.g. guest registration)."""

    __tablename__ = "attendees"

    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), unique=True)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    phone: Mapped[str | None] = mapped_column(String(40))
    organization: Mapped[str | None] = mapped_column(String(200))
    job_title: Mapped[str | None] = mapped_column(String(200))
    country: Mapped[str | None] = mapped_column(String(120))
    role_title: Mapped[str | None] = mapped_column(String(200))
    dietary: Mapped[str | None] = mapped_column(Text)
    accessibility: Mapped[str | None] = mapped_column(Text)
    interests: Mapped[list[str]] = mapped_column(JSONList, nullable=False, default=list)
    is_demo_user: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    user: Mapped["User | None"] = relationship(back_populates="attendee")
    registrations: Mapped[list["Registration"]] = relationship(back_populates="attendee")
    networking_profile: Mapped["NetworkingProfile | None"] = relationship(back_populates="attendee", uselist=False)


class EventStaffAssignment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "event_staff_assignments"
    __table_args__ = (UniqueConstraint("event_id", "user_id", name="uq_event_assignment_user"),)

    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    event: Mapped["Event"] = relationship(back_populates="staff_assignments")
    user: Mapped["User"] = relationship(back_populates="event_assignments")
