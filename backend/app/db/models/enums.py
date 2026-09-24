from enum import StrEnum

from sqlalchemy import Enum


def string_enum(enum_cls: type[StrEnum], name: str) -> Enum:
    """Store enum *values* as VARCHAR with a CHECK constraint.

    Avoids native PostgreSQL enums, which are awkward to alter in migrations, while
    keeping the database honest about the allowed set.
    """
    return Enum(
        enum_cls,
        name=name,
        native_enum=False,
        create_constraint=True,
        validate_strings=True,
        values_callable=lambda cls: [member.value for member in cls],
    )


class UserRole(StrEnum):
    ATTENDEE = "attendee"
    EVENT_STAFF = "event_staff"
    EVENT_ADMIN = "event_admin"
    PLATFORM_ADMIN = "platform_admin"


class OrganizationRole(StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    FINANCE = "finance"
    MEMBER = "member"


class EventAssignmentRole(StrEnum):
    MANAGER = "manager"
    STAFF = "staff"
    CHECK_IN = "check_in"
    SPEAKER = "speaker"


class EventStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ONGOING = "ongoing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class EventFormat(StrEnum):
    PHYSICAL = "physical"
    ONLINE = "online"
    HYBRID = "hybrid"


class SessionType(StrEnum):
    CEREMONY = "ceremony"
    KEYNOTE = "keynote"
    PANEL = "panel"
    WORKSHOP = "workshop"
    SESSION = "session"
    SHOWCASE = "showcase"
    ROUNDTABLE = "roundtable"
    PITCH = "pitch"
    DEMO = "demo"
    BREAK = "break"
    NETWORKING = "networking"


class MilestoneStatus(StrEnum):
    DONE = "done"
    LIVE = "live"
    SCHEDULED = "scheduled"


class RegistrationStatus(StrEnum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"


class PaymentStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    PAID = "paid"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class PaymentMethod(StrEnum):
    MPESA = "mpesa"
    AIRTEL = "airtel"
    MIXX = "mixx"
    HALOPESA = "halopesa"
    CARD = "card"
    BANK = "bank"


class SponsorTier(StrEnum):
    TITLE = "title"
    PLATINUM = "platinum"
    GOLD = "gold"
    SILVER = "silver"
    PARTNER = "partner"


class NotificationCategory(StrEnum):
    REGISTRATION = "registration"
    SCHEDULE = "schedule"
    REMINDER = "reminder"
    ANNOUNCEMENT = "announcement"
    PAYMENT = "payment"
    CERTIFICATE = "certificate"


class CommunicationChannel(StrEnum):
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"


class CommunicationStatus(StrEnum):
    DRAFT = "draft"
    SENT = "sent"


class AudienceSegment(StrEnum):
    ALL = "all"
    PAID = "paid"
    STUDENT = "student"
    VIP = "vip"
    CHECKED_IN = "checked-in"
