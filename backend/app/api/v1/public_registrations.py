from fastapi import APIRouter, Depends, status

from app.api.deps import AppSettings, DbSession, Gateway, rate_limit
from app.api.v1.auth import OptionalCurrentUser
from app.schemas.payments import FreeRegistrationRequest
from app.schemas.registrations import RegistrationOut
from app.services.payments import PaymentService
from app.services.registrations import registration_by_id, to_outs

router = APIRouter(prefix="/registrations", tags=["registrations"])


@router.post(
    "/free",
    response_model=RegistrationOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit("payments", "payment_rate_limit_per_minute"))],
)
def register_free(
    body: FreeRegistrationRequest, db: DbSession, gateway: Gateway, settings: AppSettings, user: OptionalCurrentUser
) -> RegistrationOut:
    """Confirm a free ticket. Paid tickets must go through `POST /payments/mobile`."""
    registration = PaymentService(db, gateway, settings).register_free(body, user=user)
    return to_outs(db, [registration_by_id(db, registration.id)])[0]
