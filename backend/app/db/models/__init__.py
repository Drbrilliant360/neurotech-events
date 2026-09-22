"""SQLAlchemy persistence models.

Importing this package registers every table on `Base.metadata`, which Alembic
autogenerate and the test suite rely on. Keep new model modules listed here.
"""

from app.db.models.engagement import Communication, Connection, NetworkingProfile, Notification, SavedSession
from app.db.models.events import Event, EventSession, Speaker, TimelineMilestone, Venue
from app.db.models.identity import Attendee, Organization, User
from app.db.models.sponsors import Sponsor, SponsorEvent
from app.db.models.ticketing import Certificate, CheckIn, Payment, PaymentEvent, Registration, TicketType

__all__ = [
    "Attendee",
    "Certificate",
    "CheckIn",
    "Communication",
    "Connection",
    "Event",
    "EventSession",
    "NetworkingProfile",
    "Notification",
    "Organization",
    "Payment",
    "PaymentEvent",
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
