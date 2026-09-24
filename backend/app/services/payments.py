"""Payment application service.

The server is the only authority on price, status and confirmation. Clients ask to pay for a
ticket by code; the price comes from the database, the provider decides whether the customer
paid, and this service records every transition in `payment_events`.
"""

import secrets
import uuid
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.config import Settings
from app.db.models import (
    Attendee,
    Event,
    Payment,
    PaymentEvent,
    ProviderWebhookEvent,
    Registration,
    TicketType,
)
from app.db.models.enums import EventStatus, PaymentMethod, PaymentStatus, RegistrationStatus
from app.integrations.payments.snippe import (
    MIN_AMOUNT_TZS,
    GatewayPayment,
    PaymentGateway,
    SnippeError,
    parse_gateway_payment,
)
from app.schemas.payments import MobilePaymentRequest, PaymentEventOut, PaymentOut


class PaymentError(Exception):
    status_code = 400
    code = "payment_error"


class NotFoundError(PaymentError):
    status_code = 404
    code = "not_found"


class ConflictError(PaymentError):
    status_code = 409
    code = "conflict"


class ValidationError(PaymentError):
    status_code = 400
    code = "validation_error"


class GatewayError(PaymentError):
    status_code = 502
    code = "gateway_error"


class GatewayUnavailable(PaymentError):
    status_code = 503
    code = "payments_unavailable"


GATEWAY_STATUS_MAP: dict[str, PaymentStatus] = {
    "pending": PaymentStatus.PROCESSING,
    "processing": PaymentStatus.PROCESSING,
    "active": PaymentStatus.PROCESSING,
    "completed": PaymentStatus.PAID,
    "failed": PaymentStatus.FAILED,
    "voided": PaymentStatus.CANCELLED,
    "expired": PaymentStatus.CANCELLED,
    "cancelled": PaymentStatus.CANCELLED,
}

GATEWAY_METHOD_MAP: dict[str, PaymentMethod] = {
    "mpesa": PaymentMethod.MPESA,
    "vodacom": PaymentMethod.MPESA,
    "airtel": PaymentMethod.AIRTEL,
    "mixx": PaymentMethod.MIXX,
    "mixx_by_yas": PaymentMethod.MIXX,
    "tigo": PaymentMethod.MIXX,
    "halopesa": PaymentMethod.HALOPESA,
    "halotel": PaymentMethod.HALOPESA,
}

TERMINAL_STATUSES = {PaymentStatus.PAID, PaymentStatus.FAILED, PaymentStatus.CANCELLED, PaymentStatus.REFUNDED}
OPEN_EVENT_STATUSES = {EventStatus.PUBLISHED, EventStatus.ONGOING}


def compute_total(price: Decimal, vat_percent: Decimal) -> int:
    """Mirror the frontend quote: VAT rounded half-up to whole shillings, then added to the price."""
    vat = (Decimal(price) * Decimal(vat_percent) / Decimal(100)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return int((Decimal(price) + vat).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def new_payment_reference() -> str:
    # Doubles as the provider idempotency key, which Snippe caps at 30 characters.
    return f"NT-{secrets.token_hex(5).upper()}"


def new_ticket_number() -> str:
    return f"NTS-{secrets.token_hex(3).upper()}"


def _split_name(full_name: str) -> tuple[str, str]:
    parts = full_name.strip().split()
    if len(parts) == 1:
        return parts[0], parts[0]
    return parts[0], " ".join(parts[1:])


def _now() -> datetime:
    return datetime.now(UTC)


class PaymentService:
    def __init__(self, db: Session, gateway: PaymentGateway | None, settings: Settings) -> None:
        self.db = db
        self.gateway = gateway
        self.settings = settings

    # ----------------------------------------------------------------- commands

    def start_mobile_payment(self, request: MobilePaymentRequest) -> Payment:
        if self.gateway is None:
            raise GatewayUnavailable("Payments are not configured on this server.")

        event = self.db.scalar(select(Event).where(Event.slug == request.event_slug))
        if event is None:
            raise NotFoundError("Event not found.")
        if event.status not in OPEN_EVENT_STATUSES:
            raise ConflictError("This event is not open for registration.")

        ticket = self.db.scalar(
            select(TicketType).where(TicketType.event_id == event.id, TicketType.code == request.ticket_code)
        )
        if ticket is None:
            raise NotFoundError("Ticket type not found for this event.")
        if not ticket.active:
            raise ConflictError("This ticket type is not on sale.")

        sold = self.db.scalar(
            select(func.count())
            .select_from(Registration)
            .where(Registration.ticket_type_id == ticket.id, Registration.status != RegistrationStatus.CANCELLED)
        )
        if (sold or 0) >= ticket.capacity:
            raise ConflictError("This ticket type is sold out.")

        total = compute_total(ticket.price, event.organization.vat_percent)
        if total < MIN_AMOUNT_TZS:
            raise ValidationError(f"Mobile money payments must be at least {MIN_AMOUNT_TZS} TZS.")

        attendee = self._upsert_attendee(request)
        registration = Registration(
            event_id=event.id,
            attendee_id=attendee.id,
            ticket_type_id=ticket.id,
            status=RegistrationStatus.PENDING,
            ticket_number=new_ticket_number(),
        )
        payment = Payment(
            registration=registration,
            attendee_id=attendee.id,
            event_id=event.id,
            reference=new_payment_reference(),
            amount=Decimal(total),
            currency=ticket.currency,
            method=PaymentMethod(request.method),
            status=PaymentStatus.PENDING,
            provider=self.gateway.name,
        )
        self.db.add_all([registration, payment])
        self.db.flush()
        payment.events.append(
            PaymentEvent(from_status=None, to_status=PaymentStatus.PENDING, note="Payment intent created")
        )

        first_name, last_name = _split_name(attendee.full_name)
        try:
            provider_payment = self.gateway.create_mobile_payment(
                amount=total,
                phone_number=request.phone_number,
                first_name=first_name,
                last_name=last_name,
                email=attendee.email,
                idempotency_key=payment.reference,
                metadata={
                    "payment_id": str(payment.id),
                    "registration_id": str(registration.id),
                    "event_slug": event.slug,
                    "client_reference": request.client_reference or "",
                },
                webhook_url=self.settings.snippe_webhook_url,
            )
        except SnippeError as exc:
            self._transition(payment, PaymentStatus.FAILED, note=f"Provider rejected the payment intent: {exc}")
            self.db.commit()
            raise GatewayError(str(exc)) from exc

        payment.provider_reference = provider_payment.reference
        self._apply_gateway_payment(payment, provider_payment, note="Provider accepted the payment intent")
        self.db.commit()
        return self.get_payment(payment.id)

    def sync_with_gateway(self, payment: Payment) -> Payment:
        """Ask the provider for the current status. This is the real verification path when webhooks
        cannot reach us (for example in local development)."""
        if payment.status in TERMINAL_STATUSES or not payment.provider_reference or self.gateway is None:
            return payment
        try:
            provider_payment = self.gateway.get_payment(payment.provider_reference)
        except SnippeError as exc:
            raise GatewayError(str(exc)) from exc
        self._apply_gateway_payment(payment, provider_payment, note="Status verified with provider")
        self.db.commit()
        return self.get_payment(payment.id)

    def handle_webhook(self, provider: str, event: dict[str, Any]) -> ProviderWebhookEvent:
        event_id = str(event.get("id") or "")
        event_type = str(event.get("type") or "unknown")
        data = event.get("data") if isinstance(event.get("data"), dict) else {}
        if not event_id:
            raise ValidationError("Webhook event is missing an id.")

        existing = self.db.scalar(
            select(ProviderWebhookEvent).where(
                ProviderWebhookEvent.provider == provider, ProviderWebhookEvent.event_id == event_id
            )
        )
        if existing is not None:
            return existing  # Redelivery: already recorded, do nothing.

        record = ProviderWebhookEvent(provider=provider, event_id=event_id, event_type=event_type, payload=event)
        payment = self._find_payment_for_webhook(data)
        if payment is None:
            record.note = "No matching payment for this event."
        else:
            record.payment_id = payment.id
            self._apply_gateway_payment(payment, parse_gateway_payment(data), note=f"Webhook {event_type}")
            record.processed_at = _now()
        self.db.add(record)
        self.db.commit()
        return record

    # ------------------------------------------------------------------ queries

    def get_payment(self, payment_id: uuid.UUID) -> Payment:
        payment = self.db.scalar(self._payment_query().where(Payment.id == payment_id))
        if payment is None:
            raise NotFoundError("Payment not found.")
        return payment

    def list_payments(self, *, status: str | None, page: int, page_size: int) -> tuple[list[Payment], int]:
        query = self._payment_query()
        count_query = select(func.count()).select_from(Payment)
        if status:
            try:
                wanted = PaymentStatus(status)
            except ValueError as exc:
                raise ValidationError(f"Unknown payment status '{status}'.") from exc
            query = query.where(Payment.status == wanted)
            count_query = count_query.where(Payment.status == wanted)
        total = self.db.scalar(count_query) or 0
        items = list(
            self.db.scalars(query.order_by(Payment.created_at.desc()).offset((page - 1) * page_size).limit(page_size))
        )
        return items, total

    def list_provider_transactions(self, **params: Any) -> dict[str, Any]:
        if self.gateway is None:
            raise GatewayUnavailable("Payments are not configured on this server.")
        try:
            return self.gateway.list_payments(**params)
        except SnippeError as exc:
            raise GatewayError(str(exc)) from exc

    def provider_balance(self) -> dict[str, Any]:
        if self.gateway is None:
            raise GatewayUnavailable("Payments are not configured on this server.")
        try:
            return self.gateway.get_balance()
        except SnippeError as exc:
            raise GatewayError(str(exc)) from exc

    @staticmethod
    def to_out(payment: Payment) -> PaymentOut:
        registration = payment.registration
        return PaymentOut(
            id=payment.id,
            reference=payment.reference,
            status=payment.status.value,
            amount=int(payment.amount),
            currency=payment.currency,
            method=payment.method.value,
            provider=payment.provider,
            provider_reference=payment.provider_reference,
            registration_id=registration.id,
            registration_status=registration.status.value,
            ticket_number=registration.ticket_number,
            event_slug=registration.event.slug,
            event_title=registration.event.title,
            ticket_name=registration.ticket_type.name,
            attendee_name=registration.attendee.full_name,
            attendee_email=registration.attendee.email,
            created_at=payment.created_at,
            updated_at=payment.updated_at,
            paid_at=payment.paid_at,
            events=[
                PaymentEventOut(
                    from_status=item.from_status.value if item.from_status else None,
                    to_status=item.to_status.value,
                    note=item.note,
                    created_at=item.created_at,
                )
                for item in payment.events
            ],
        )

    # ----------------------------------------------------------------- internals

    def _payment_query(self):
        return select(Payment).options(
            selectinload(Payment.events),
            selectinload(Payment.registration).selectinload(Registration.attendee),
            selectinload(Payment.registration).selectinload(Registration.event),
            selectinload(Payment.registration).selectinload(Registration.ticket_type),
        )

    def _upsert_attendee(self, request: MobilePaymentRequest) -> Attendee:
        details = request.attendee
        attendee = self.db.scalar(select(Attendee).where(func.lower(Attendee.email) == details.email))
        if attendee is None:
            attendee = Attendee(email=details.email, full_name=details.full_name, interests=[])
            self.db.add(attendee)
        attendee.full_name = details.full_name
        attendee.phone = request.phone_number
        if details.organization:
            attendee.organization = details.organization
        if details.job_title:
            attendee.job_title = details.job_title
        if details.country:
            attendee.country = details.country
        self.db.flush()
        return attendee

    def _find_payment_for_webhook(self, data: dict[str, Any]) -> Payment | None:
        reference = data.get("reference")
        if reference:
            payment = self.db.scalar(self._payment_query().where(Payment.provider_reference == str(reference)))
            if payment is not None:
                return payment
        metadata = data.get("metadata") if isinstance(data.get("metadata"), dict) else {}
        raw_id = metadata.get("payment_id")
        if raw_id:
            try:
                return self.db.scalar(self._payment_query().where(Payment.id == uuid.UUID(str(raw_id))))
            except ValueError:
                return None
        return None

    def _apply_gateway_payment(self, payment: Payment, provider_payment: GatewayPayment, *, note: str) -> None:
        if provider_payment.provider and provider_payment.provider.lower() in GATEWAY_METHOD_MAP:
            payment.method = GATEWAY_METHOD_MAP[provider_payment.provider.lower()]
        if provider_payment.external_reference and not payment.provider_reference:
            payment.provider_reference = provider_payment.reference
        target = GATEWAY_STATUS_MAP.get(provider_payment.status)
        if target is None or target == payment.status or payment.status in TERMINAL_STATUSES:
            return
        detail = f"{note} (provider status: {provider_payment.status})"
        if provider_payment.failure_reason:
            detail += f" — {provider_payment.failure_reason}"
        self._transition(payment, target, note=detail)
        registration = payment.registration
        if target == PaymentStatus.PAID:
            payment.paid_at = _now()
            registration.status = RegistrationStatus.CONFIRMED
        elif target == PaymentStatus.CANCELLED:
            registration.status = RegistrationStatus.CANCELLED
            registration.cancelled_at = _now()

    def _transition(self, payment: Payment, to_status: PaymentStatus, *, note: str) -> None:
        payment.events.append(PaymentEvent(from_status=payment.status, to_status=to_status, note=note))
        payment.status = to_status
