import uuid
from datetime import datetime

from pydantic import BaseModel


class RegistrationOut(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    event_slug: str
    event_title: str
    ticket_type_id: uuid.UUID
    ticket_name: str
    ticket_number: str
    status: str
    created_at: datetime
    cancelled_at: datetime | None
