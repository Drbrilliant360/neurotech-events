"""Contracts for event operations: attendee lists, complimentary tickets, check-in and reporting."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.payments import AttendeeInput


class AdminRegistrationOut(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    ticket_number: str
    status: str
    attendee_id: uuid.UUID
    attendee_name: str
    attendee_email: str
    attendee_phone: str | None
    attendee_organization: str | None
    ticket_type_id: uuid.UUID
    ticket_name: str
    amount_paid: int
    checked_in_at: datetime | None
    created_at: datetime
    cancelled_at: datetime | None


class AdminRegistrationPage(BaseModel):
    items: list[AdminRegistrationOut]
    total: int
    page: int
    page_size: int


class ComplimentaryRegistrationRequest(BaseModel):
    attendee: AttendeeInput
    ticket_type_id: uuid.UUID
    note: str | None = Field(default=None, max_length=500)


class AdminCancelRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class AdminCancelResult(BaseModel):
    registration: AdminRegistrationOut
    # True when money was collected: the organiser must refund through the provider.
    refund_required: bool


class CheckInRequest(BaseModel):
    """Either the signed QR payload or the printed ticket number."""

    code: str = Field(min_length=6, max_length=120)


class CheckInOut(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    attendee_id: uuid.UUID
    registration_id: uuid.UUID
    ticket_number: str
    attendee_name: str
    ticket_name: str
    checked_in_at: datetime
    checked_in_by: str | None
    undone: bool


class CheckInPage(BaseModel):
    items: list[CheckInOut]
    total: int
    page: int
    page_size: int


class CheckInLookupOut(BaseModel):
    """Minimal attendee view for door staff: enough to identify, nothing more."""

    registration_id: uuid.UUID
    ticket_number: str
    attendee_name: str
    ticket_name: str
    status: str
    checked_in_at: datetime | None


class TicketTypeSummary(BaseModel):
    ticket_type_id: uuid.UUID
    name: str
    capacity: int
    confirmed: int
    pending: int
    revenue: int | None


class EventSummaryReport(BaseModel):
    event_id: uuid.UUID
    capacity: int
    registrations: int
    confirmed: int
    pending: int
    cancelled: int
    checked_in: int
    check_in_rate: float
    # Present only for callers with finance access.
    revenue: int | None
    currency: str
    ticket_types: list[TicketTypeSummary]


class AttendeeTicketOut(BaseModel):
    registration_id: uuid.UUID
    ticket_number: str
    event_slug: str
    event_title: str
    ticket_name: str
    attendee_name: str
    starts_at: datetime
    qr_payload: str
    checked_in_at: datetime | None


class AuditEntryOut(BaseModel):
    id: uuid.UUID
    action: str
    actor_user_id: uuid.UUID | None
    target_type: str | None
    target_id: str | None
    details: dict[str, Any]
    created_at: datetime


class AuditPage(BaseModel):
    items: list[AuditEntryOut]
    total: int
    page: int
    page_size: int
