import uuid
from datetime import datetime

from pydantic import BaseModel


class RegistrationOut(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    event_slug: str
    event_title: str
    event_starts_at: datetime
    event_ends_at: datetime
    attendee_id: uuid.UUID
    ticket_type_id: uuid.UUID
    ticket_code: str | None
    ticket_name: str
    ticket_price: int
    currency: str
    ticket_number: str
    status: str
    created_at: datetime
    cancelled_at: datetime | None
    # The most recent payment attempt, if the ticket was paid for.
    payment_id: uuid.UUID | None = None
    payment_status: str | None = None
    payment_reference: str | None = None
    payment_method: str | None = None
    amount_paid: int = 0
    checked_in_at: datetime | None = None
