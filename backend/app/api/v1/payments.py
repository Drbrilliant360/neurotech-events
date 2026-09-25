import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.api.deps import AppSettings, DbSession, Gateway, rate_limit
from app.api.v1.auth import OptionalCurrentUser
from app.schemas.payments import MobilePaymentRequest, PaymentOut
from app.services.payments import PaymentService

router = APIRouter(prefix="/payments", tags=["payments"])


def _service(db: DbSession, gateway: Gateway, settings: AppSettings) -> PaymentService:
    return PaymentService(db, gateway, settings)


Service = Annotated[PaymentService, Depends(_service)]


@router.post(
    "/mobile",
    response_model=PaymentOut,
    status_code=status.HTTP_201_CREATED,
    # Each call pushes a prompt to a phone number, so this also guards against prompt flooding.
    dependencies=[Depends(rate_limit("payments", "payment_rate_limit_per_minute"))],
)
def start_mobile_payment(body: MobilePaymentRequest, service: Service, user: OptionalCurrentUser) -> PaymentOut:
    """Price a ticket server-side, reserve a registration and push a mobile-money prompt to the payer."""
    return service.to_out(service.start_mobile_payment(body, user=user))


@router.get("/{payment_id}", response_model=PaymentOut)
def get_payment(payment_id: uuid.UUID, service: Service) -> PaymentOut:
    """Current payment state. Open payments are re-verified with the provider on every read."""
    payment = service.get_payment(payment_id)
    return service.to_out(service.sync_with_gateway(payment))


@router.post(
    "/{payment_id}/push",
    response_model=PaymentOut,
    dependencies=[Depends(rate_limit("payments", "payment_rate_limit_per_minute"))],
)
def resend_prompt(payment_id: uuid.UUID, service: Service) -> PaymentOut:
    """Re-send the mobile money prompt to the payer's phone (for example if they missed it)."""
    return service.to_out(service.resend_prompt(service.get_payment(payment_id)))
