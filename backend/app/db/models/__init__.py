"""SQLAlchemy persistence models.

Importing this package registers every table on `Base.metadata`, which Alembic
autogenerate and the test suite rely on. Keep new model modules listed here.
"""

from app.db.models.engagement import Communication, Connection, NetworkingProfile, Notification, SavedSession
from app.db.models.events import Event, EventSession, Speaker, TimelineMilestone, Venue
from app.db.models.identity import Attendee, EventStaffAssignment, Organization, OrganizationMembership, User
from app.db.models.integrations import ProviderWebhookEvent
from app.db.models.security import AuditLog, IdentityToken, RefreshToken
from app.db.models.sponsors import Sponsor, SponsorEvent
from app.db.models.ticketing import (
    Certificate,
    CheckIn,
    OfflineCheckInOperation,
    Payment,
    PaymentEvent,
    Refund,
    Registration,
    TicketType,
)

__all__ = [
    "Attendee",
    "AuditLog",
    "Certificate",
    "CheckIn",
    "Communication",
    "Connection",
    "Event",
    "EventStaffAssignment",
    "EventSession",
    "IdentityToken",
    "NetworkingProfile",
    "Notification",
    "OfflineCheckInOperation",
    "Organization",
    "OrganizationMembership",
    "Payment",
    "PaymentEvent",
    "ProviderWebhookEvent",
    "RefreshToken",
    "Refund",
    "Registration",
    "SavedSession",
    "Speaker",
    "Sponsor",
    "SponsorEvent",
    "TicketType",
    "TimelineMilestone",
    "User",
    "Venue",
]
