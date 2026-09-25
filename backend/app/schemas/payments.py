import re
import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

MobileMethod = Literal["mpesa", "airtel", "mixx", "halopesa"]
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class AttendeeInput(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    email: str = Field(max_length=320)
    organization: str | None = Field(default=None, max_length=200)
    job_title: str | None = Field(default=None, max_length=200)
    country: str | None = Field(default=None, max_length=120)

    @field_validator("email")
    @classmethod
    def _email(cls, value: str) -> str:
        value = value.strip().lower()
        if not _EMAIL.match(value):
            raise ValueError("must be a valid email address")
        return value


class MobilePaymentRequest(BaseModel):
    event_slug: str = Field(min_length=1, max_length=160)
    ticket_code: str = Field(min_length=1, max_length=60)
    phone_number: str = Field(min_length=9, max_length=20)
    method: MobileMethod = "mpesa"
    attendee: AttendeeInput
    # Opaque reference from the calling client (e.g. its local registration id) for correlation.
    client_reference: str | None = Field(default=None, max_length=60)

    @field_validator("phone_number")
    @classmethod
    def _phone(cls, value: str) -> str:
        digits = "".join(ch for ch in value if ch.isdigit())
        if digits.startswith("0") and len(digits) == 10:
            digits = "255" + digits[1:]
        if not (len(digits) == 12 and digits.startswith("255")):
            raise ValueError("must be a Tanzanian mobile number such as 255712345678 or 0712345678")
        return digits


class FreeRegistrationRequest(BaseModel):
    """Register for a ticket that costs nothing; the server confirms the total is zero."""

    event_slug: str = Field(min_length=1, max_length=160)
    ticket_code: str = Field(min_length=1, max_length=60)
    attendee: AttendeeInput
    phone_number: str | None = Field(default=None, max_length=20)


class PaymentEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    from_status: str | None
    to_status: str
    note: str | None
    created_at: datetime


class PaymentOut(BaseModel):
    id: uuid.UUID
    reference: str
    status: str
    amount: int
    currency: str
    method: str
    provider: str | None
    provider_reference: str | None
    registration_id: uuid.UUID
    registration_status: str
    event_id: uuid.UUID
    attendee_id: uuid.UUID
    ticket_type_id: uuid.UUID
    ticket_number: str
    event_slug: str
    event_title: str
    ticket_name: str
    attendee_name: str
    attendee_email: str
    created_at: datetime
    updated_at: datetime
    paid_at: datetime | None
    events: list[PaymentEventOut]


class PaymentPageOut(BaseModel):
    items: list[PaymentOut]
    total: int
    page: int
    page_size: int


class ProviderTransactionsOut(BaseModel):
    provider: str
    items: list[dict[str, Any]]
    raw: dict[str, Any]


class BalanceOut(BaseModel):
    provider: str
    available: int
    balance: int
    currency: str
