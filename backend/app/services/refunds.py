"""Provider-backed organiser refunds implemented as Snippe mobile-money payouts."""

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.config import Settings
from app.db.models import Payment, PaymentEvent, ProviderWebhookEvent, Refund, User
from app.db.models.enums import PaymentStatus, RefundStatus, RegistrationStatus
from app.integrations.payments.snippe import GatewayPayout, PaymentGateway, SnippeError
from app.schemas.payments import RefundOut
from app.services import audit
from app.services.errors import ConflictError, NotFoundError, ValidationError
from app.services.payments import GatewayError, GatewayUnavailable

logger = logging.getLogger("neurotech.refunds")

PAYOUT_STATUS_MAP = {
    "pending": RefundStatus.PENDING,
    "completed": RefundStatus.COMPLETED,
    "failed": RefundStatus.FAILED,
    "reversed": RefundStatus.REVERSED,
}


def _now() -> datetime:
    return datetime.now(UTC)


def _key(payment_id: uuid.UUID) -> str:
    return f"RF-{payment_id.hex[:24]}"


class RefundService:
    def __init__(self, db: Session, gateway: PaymentGateway | None, settings: Settings) -> None:
        self.db, self.gateway, self.settings = db, gateway, settings

    def request(self, payment_id: uuid.UUID, actor: User, reason: str) -> Refund:
        if self.gateway is None:
            raise GatewayUnavailable("Refunds are not configured on this server.")
        payment = self.db.scalar(
            select(Payment).options(joinedload(Payment.registration))
            .where(Payment.id == payment_id).with_for_update()
        )
        if payment is None:
            raise NotFoundError("Payment not found.")
        self.db.refresh(payment.registration)
        if payment.status == PaymentStatus.REFUNDED:
            existing = self.db.scalar(select(Refund).where(Refund.payment_id == payment.id))
            if existing:
                return existing
        if payment.status != PaymentStatus.PAID:
            raise ConflictError("Only a paid payment can be refunded.", code="not_refundable")
        if payment.registration.status != RegistrationStatus.CANCELLED:
            raise ConflictError(
                "Cancel the registration before requesting its refund.", code="registration_not_cancelled"
            )
        existing = self.db.scalar(select(Refund).where(Refund.payment_id == payment.id))
        if existing:
            return existing
        attendee = payment.registration.attendee
        if not attendee.phone:
            raise ValidationError("The attendee has no mobile number for the refund payout.")
        refund = Refund(
            payment_id=payment.id, registration_id=payment.registration_id, event_id=payment.event_id,
            requested_by_user_id=actor.id, amount=payment.amount, currency=payment.currency,
            recipient_phone=attendee.phone, recipient_name=attendee.full_name, reason=reason.strip(),
            status=RefundStatus.PENDING, idempotency_key=_key(payment.id),
        )
        self.db.add(refund)
        audit.record(self.db, "refund.requested", actor=actor, target_type="payment", target_id=payment.id,
                     event_id=payment.event_id, details={"amount": int(payment.amount), "currency": payment.currency})
        try:
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            return self.get_by_payment(payment.id)

        try:
            payout = self.gateway.create_mobile_payout(
                amount=int(refund.amount), recipient_phone=refund.recipient_phone,
                recipient_name=refund.recipient_name,
                narration=f"Refund for ticket {payment.registration.ticket_number}",
                idempotency_key=refund.idempotency_key,
                metadata={"refund_id": str(refund.id), "payment_id": str(payment.id),
                          "registration_id": str(payment.registration_id)},
                webhook_url=self.settings.snippe_webhook_url,
            )
        except SnippeError as exc:
            logger.warning("snippe refund payout failed status=%s code=%s", exc.status_code, exc.error_code)
            refund = self.get_by_payment(payment.id, lock=True)
            refund.status = RefundStatus.FAILED
            refund.failure_reason = "Provider rejected the refund payout."
            audit.record(self.db, "refund.failed", actor=actor, target_type="refund", target_id=refund.id,
                         event_id=refund.event_id, details={"provider_status": exc.status_code})
            self.db.commit()
            raise GatewayError("The refund provider could not accept this request. Try again later.") from exc
        refund = self.get_by_payment(payment.id, lock=True)
        refund.provider_reference = payout.reference
        self._apply(refund, payout, actor=actor)
        self.db.commit()
        return refund

    def get_by_payment(self, payment_id: uuid.UUID, *, lock: bool = False) -> Refund:
        query = select(Refund).where(Refund.payment_id == payment_id)
        if lock:
            query = query.with_for_update()
        refund = self.db.scalar(query)
        if refund is None:
            raise NotFoundError("Refund not found.")
        return refund

    def verify(self, payment_id: uuid.UUID, actor: User | None = None) -> Refund:
        refund = self.get_by_payment(payment_id, lock=True)
        if refund.status == RefundStatus.COMPLETED or not refund.provider_reference:
            return refund
        if self.gateway is None:
            raise GatewayUnavailable("Refunds are not configured on this server.")
        try:
            payout = self.gateway.get_payout(refund.provider_reference)
        except SnippeError as exc:
            logger.warning("snippe payout verification failed status=%s code=%s", exc.status_code, exc.error_code)
            raise GatewayError("The refund status could not be verified. Try again later.") from exc
        self._apply(refund, payout, actor=actor)
        self.db.commit()
        return refund

    def handle_webhook(self, provider: str, event: dict[str, Any]) -> ProviderWebhookEvent:
        event_id, event_type = str(event.get("id") or ""), str(event.get("type") or "unknown")
        data = event.get("data") if isinstance(event.get("data"), dict) else {}
        if not event_id:
            raise ValidationError("Webhook event is missing an id.")
        existing = self.db.scalar(select(ProviderWebhookEvent).where(
            ProviderWebhookEvent.provider == provider, ProviderWebhookEvent.event_id == event_id))
        if existing:
            return existing
        record = ProviderWebhookEvent(provider=provider, event_id=event_id, event_type=event_type, payload=event)
        refund = self._find(data)
        if refund is None:
            record.note = "No matching refund for this payout event."
        else:
            record.payment_id = refund.payment_id
            raw_amount = data.get("amount")
            amount = int(raw_amount.get("value", 0)) if isinstance(raw_amount, dict) else int(raw_amount or 0)
            currency = str(raw_amount.get("currency", "TZS")) if isinstance(raw_amount, dict) else "TZS"
            self._apply(
                refund,
                GatewayPayout(
                    reference=str(data.get("reference") or ""),
                    status=str(data.get("status") or "").lower(),
                    amount=amount,
                    currency=currency,
                    failure_reason=data.get("failure_reason"),
                    completed_at=data.get("completed_at"),
                    raw=data,
                ),
            )
            record.processed_at = _now()
        self.db.add(record)
        try:
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            return self.db.scalar(select(ProviderWebhookEvent).where(
                ProviderWebhookEvent.provider == provider, ProviderWebhookEvent.event_id == event_id))
        return record

    def _find(self, data: dict[str, Any]) -> Refund | None:
        reference = data.get("reference")
        if reference:
            found = self.db.scalar(select(Refund).where(Refund.provider_reference == str(reference)).with_for_update())
            if found:
                return found
        metadata = data.get("metadata") if isinstance(data.get("metadata"), dict) else {}
        try:
            refund_id = uuid.UUID(str(metadata.get("refund_id")))
        except (ValueError, TypeError):
            return None
        return self.db.scalar(select(Refund).where(Refund.id == refund_id).with_for_update())

    def _apply(self, refund: Refund, payout: GatewayPayout, *, actor: User | None = None) -> None:
        target = PAYOUT_STATUS_MAP.get(payout.status)
        if target is None or target == refund.status:
            return
        if refund.status == RefundStatus.COMPLETED and target != RefundStatus.REVERSED:
            return
        if payout.amount and (payout.amount != int(refund.amount) or payout.currency != refund.currency):
            audit.record(
                self.db, "refund.provider_mismatch", actor=actor, target_type="refund", target_id=refund.id,
                event_id=refund.event_id, details={"provider_status": payout.status},
            )
            return
        previous = refund.status
        # Completion is final for our payment; a provider reversal reopens it as paid.
        refund.status = target
        refund.failure_reason = "Refund payout failed." if target == RefundStatus.FAILED else None
        payment = self.db.get(Payment, refund.payment_id)
        if target == RefundStatus.COMPLETED:
            refund.completed_at = _now()
            payment.events.append(PaymentEvent(from_status=payment.status, to_status=PaymentStatus.REFUNDED,
                                               note="Refund payout completed and verified by provider"))
            payment.status, payment.refunded_at = PaymentStatus.REFUNDED, _now()
        elif target == RefundStatus.REVERSED and payment.status == PaymentStatus.REFUNDED:
            payment.events.append(PaymentEvent(from_status=payment.status, to_status=PaymentStatus.PAID,
                                               note="Provider reversed the refund payout"))
            payment.status, payment.refunded_at = PaymentStatus.PAID, None
        audit.record(self.db, f"refund.{target.value}", actor=actor, target_type="refund", target_id=refund.id,
                     event_id=refund.event_id, details={"from": previous.value, "to": target.value})

    @staticmethod
    def to_out(refund: Refund) -> RefundOut:
        return RefundOut(
            id=refund.id, payment_id=refund.payment_id, registration_id=refund.registration_id,
            event_id=refund.event_id, amount=int(refund.amount), currency=refund.currency,
            recipient_name=refund.recipient_name, status=refund.status.value,
            provider_reference=refund.provider_reference, failure_reason=refund.failure_reason,
            created_at=refund.created_at, updated_at=refund.updated_at, completed_at=refund.completed_at,
        )
