import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.api.deps import AppSettings, DbSession, Gateway
from app.api.v1.auth import OptionalCurrentUser
from app.schemas.payments import MobilePaymentRequest, PaymentOut
from app.services.payments import PaymentService

router = APIRouter(prefix="/payments", tags=["payments"])


def _service(db: DbSession, gateway: Gateway, settings: AppSettings) -> PaymentService:
    return PaymentService(db, gateway, settings)


Service = Annotated[PaymentService, Depends(_service)]


@router.post("/mobile", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def start_mobile_payment(body: MobilePaymentRequest, service: Service, user: OptionalCurrentUser) -> PaymentOut:
    """Price a ticket server-side, reserve a registration and push a mobile-money prompt to the payer."""
    return service.to_out(service.start_mobile_payment(body, user=user))


@router.get("/{payment_id}", response_model=PaymentOut)
def get_payment(payment_id: uuid.UUID, service: Service) -> PaymentOut:
    """Current payment state. Open payments are re-verified with the provider on every read."""
    payment = service.get_payment(payment_id)
    return service.to_out(service.sync_with_gateway(payment))
