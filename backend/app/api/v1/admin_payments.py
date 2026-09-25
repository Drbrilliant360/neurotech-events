import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from app.api.deps import AppSettings, DbSession, Gateway, require_super_admin
from app.schemas.payments import BalanceOut, PaymentOut, PaymentPageOut, ProviderTransactionsOut
from app.services.payments import PaymentService

router = APIRouter(prefix="/admin/payments", tags=["admin"], dependencies=[Depends(require_super_admin)])


def _service(db: DbSession, gateway: Gateway, settings: AppSettings) -> PaymentService:
    return PaymentService(db, gateway, settings)


Service = Annotated[PaymentService, Depends(_service)]


@router.get("", response_model=PaymentPageOut)
def list_platform_payments(
    service: Service,
    status: Annotated[str | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 50,
) -> PaymentPageOut:
    """Every payment this platform created, newest first, with its full audit trail."""
    items, total = service.list_payments(status=status, page=page, page_size=page_size)
    return PaymentPageOut(items=[service.to_out(item) for item in items], total=total, page=page, page_size=page_size)


@router.get("/provider", response_model=ProviderTransactionsOut)
def list_provider_transactions(
    service: Service,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    page: Annotated[int | None, Query(ge=1)] = None,
    status: Annotated[str | None, Query()] = None,
) -> ProviderTransactionsOut:
    """Every transaction on the provider account, including ones made outside this platform."""
    data: dict[str, Any] = service.list_provider_transactions(limit=limit, page=page, status=status)
    items = data.get("items") if isinstance(data.get("items"), list) else []
    return ProviderTransactionsOut(provider="snippe", items=items, raw={k: v for k, v in data.items() if k != "items"})


@router.get("/balance", response_model=BalanceOut)
def provider_balance(service: Service) -> BalanceOut:
    data = service.provider_balance()
    available = data.get("available") if isinstance(data.get("available"), dict) else {}
    balance = data.get("balance") if isinstance(data.get("balance"), dict) else {}
    return BalanceOut(
        provider="snippe",
        available=int(available.get("value") or 0),
        balance=int(balance.get("value") or 0),
        currency=str(available.get("currency") or balance.get("currency") or "TZS"),
    )


@router.post("/{payment_id}/verify", response_model=PaymentOut)
def verify_payment(payment_id: uuid.UUID, service: Service) -> PaymentOut:
    """Force a status check against the provider for one payment."""
    return service.to_out(service.sync_with_gateway(service.get_payment(payment_id), force=True))
