"""Organiser API for running an event: attendees, check-in, reports, payments and audit trail."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response, status

from app.api.deps import AppSettings, DbSession, Gateway, client_ip, enforce_rate_limit
from app.api.v1.auth import CurrentUser
from app.db.models.enums import RegistrationStatus
from app.schemas.operations import (
    AdminCancelRequest,
    AdminCancelResult,
    AdminRegistrationOut,
    AdminRegistrationPage,
    AuditPage,
    CheckInLookupOut,
    CheckInOut,
    CheckInPage,
    CheckInRequest,
    ComplimentaryRegistrationRequest,
    EventSummaryReport,
)
from app.schemas.payments import PaymentPageOut
from app.services import operations
from app.services.authorization import Capability, require_event
from app.services.payments import PaymentService

router = APIRouter(prefix="/admin/events/{event_id}", tags=["admin: operations"])

Page = Annotated[int, Query(ge=1, le=10_000)]
PageSize = Annotated[int, Query(ge=1, le=200)]


# -------------------------------------------------------------- registrations


@router.get("/registrations", response_model=AdminRegistrationPage)
def list_registrations(
    event_id: uuid.UUID,
    user: CurrentUser,
    db: DbSession,
    status_filter: Annotated[RegistrationStatus | None, Query(alias="status")] = None,
    ticket_type_id: uuid.UUID | None = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    checked_in: bool | None = None,
    page: Page = 1,
    page_size: PageSize = 50,
) -> AdminRegistrationPage:
    event, _ = require_event(db, user, event_id, Capability.MANAGE)
    items, total = operations.list_registrations(
        db, event, status=status_filter, ticket_type_id=ticket_type_id, q=q, checked_in=checked_in,
        page=page, page_size=page_size,
    )
    return AdminRegistrationPage(items=items, total=total, page=page, page_size=page_size)


@router.get("/registrations.csv", response_class=Response)
def export_registrations(event_id: uuid.UUID, user: CurrentUser, db: DbSession) -> Response:
    """Attendee list as CSV. Cells are neutralised against spreadsheet formula injection."""
    event, _ = require_event(db, user, event_id, Capability.MANAGE)
    return Response(
        content=operations.export_registrations_csv(db, user, event),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{event.slug}-registrations.csv"',
            "Cache-Control": "no-store",
        },
    )


@router.post("/registrations", response_model=AdminRegistrationOut, status_code=status.HTTP_201_CREATED)
def add_complimentary_registration(
    event_id: uuid.UUID, payload: ComplimentaryRegistrationRequest, user: CurrentUser, db: DbSession
) -> AdminRegistrationOut:
    """Issue a confirmed, unpaid ticket (speakers, press, VIP guests). Capacity still applies."""
    event, _ = require_event(db, user, event_id, Capability.MANAGE)
    registration = operations.create_complimentary_registration(db, user, event, payload)
    return operations.registration_out(db, registration)


@router.post("/registrations/{registration_id}/cancel", response_model=AdminCancelResult)
def cancel_registration(
    event_id: uuid.UUID, registration_id: uuid.UUID, payload: AdminCancelRequest, user: CurrentUser, db: DbSession
) -> AdminCancelResult:
    event, _ = require_event(db, user, event_id, Capability.MANAGE)
    registration, refund_required = operations.cancel_registration(db, user, event, registration_id, payload.reason)
    return AdminCancelResult(
        registration=operations.registration_out(db, registration), refund_required=refund_required
    )


# ------------------------------------------------------------------- check-in


def _check_in_rate_limit(request: Request, settings: AppSettings) -> None:
    enforce_rate_limit(settings, f"check-in:{client_ip(request)}", settings.check_in_rate_limit_per_minute)


@router.post(
    "/check-ins",
    response_model=CheckInOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_check_in_rate_limit)],
)
def check_in(
    event_id: uuid.UUID, payload: CheckInRequest, user: CurrentUser, db: DbSession, settings: AppSettings
) -> CheckInOut:
    """Admit one attendee by signed QR payload or ticket number. A ticket admits once."""
    event, _ = require_event(db, user, event_id, Capability.CHECK_IN)
    return operations.check_in(db, settings, user, event, payload.code)


@router.post("/check-ins/{check_in_id}/undo", response_model=CheckInOut)
def undo_check_in(event_id: uuid.UUID, check_in_id: uuid.UUID, user: CurrentUser, db: DbSession) -> CheckInOut:
    event, _ = require_event(db, user, event_id, Capability.CHECK_IN)
    return operations.undo_check_in(db, user, event, check_in_id)


@router.get("/check-ins", response_model=CheckInPage)
def list_check_ins(
    event_id: uuid.UUID, user: CurrentUser, db: DbSession, page: Page = 1, page_size: PageSize = 50
) -> CheckInPage:
    event, _ = require_event(db, user, event_id, Capability.CHECK_IN)
    items, total = operations.list_check_ins(db, event, page=page, page_size=page_size)
    return CheckInPage(items=items, total=total, page=page, page_size=page_size)


@router.get("/check-ins/lookup", response_model=list[CheckInLookupOut])
def lookup_attendee(
    event_id: uuid.UUID, user: CurrentUser, db: DbSession, q: Annotated[str, Query(min_length=2, max_length=100)]
) -> list[CheckInLookupOut]:
    """Find an attendee at the door by name, email or ticket number (up to 20 matches)."""
    event, _ = require_event(db, user, event_id, Capability.CHECK_IN)
    return operations.lookup_for_check_in(db, event, q)


# ------------------------------------------------------------------ reporting


@router.get("/summary", response_model=EventSummaryReport)
def event_summary(event_id: uuid.UUID, user: CurrentUser, db: DbSession) -> EventSummaryReport:
    """Registration, check-in and (for finance roles) revenue totals for the event dashboard."""
    event, access = require_event(db, user, event_id, Capability.VIEW)
    return operations.event_summary(db, event, access)


@router.get("/payments", response_model=PaymentPageOut)
def event_payments(
    event_id: uuid.UUID,
    user: CurrentUser,
    db: DbSession,
    gateway: Gateway,
    settings: AppSettings,
    status_filter: Annotated[str | None, Query(alias="status", max_length=20)] = None,
    page: Page = 1,
    page_size: PageSize = 50,
) -> PaymentPageOut:
    event, _ = require_event(db, user, event_id, Capability.FINANCE)
    service = PaymentService(db, gateway, settings)
    items, total = service.list_payments(status=status_filter, page=page, page_size=page_size, event_id=event.id)
    return PaymentPageOut(items=[service.to_out(item) for item in items], total=total, page=page, page_size=page_size)


@router.get("/audit", response_model=AuditPage)
def event_audit(
    event_id: uuid.UUID, user: CurrentUser, db: DbSession, page: Page = 1, page_size: PageSize = 50
) -> AuditPage:
    event, _ = require_event(db, user, event_id, Capability.MANAGE)
    items, total = operations.event_audit_log(db, event, page=page, page_size=page_size)
    return AuditPage(items=items, total=total, page=page, page_size=page_size)
