import json

from fastapi import APIRouter, HTTPException, Request, status

from app.api.deps import AppSettings, DbSession, Gateway
from app.integrations.payments.snippe import verify_webhook_signature
from app.services.payments import PaymentService

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/snippe", status_code=status.HTTP_200_OK)
async def snippe_webhook(request: Request, db: DbSession, gateway: Gateway, settings: AppSettings) -> dict[str, str]:
    """Receive Snippe events. Unsigned or stale deliveries are rejected; duplicates are ignored."""
    raw_body = await request.body()
    if not settings.snippe_webhook_secret:
        # Never accept unverifiable money events. Polling remains the verification path.
        raise HTTPException(status_code=503, detail="Webhook secret is not configured.")
    if not verify_webhook_signature(
        settings.snippe_webhook_secret,
        request.headers.get("x-webhook-timestamp"),
        request.headers.get("x-webhook-signature"),
        raw_body,
    ):
        raise HTTPException(status_code=401, detail="Invalid webhook signature.")
    try:
        event = json.loads(raw_body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Webhook body is not valid JSON.") from exc
    if not isinstance(event, dict):
        raise HTTPException(status_code=400, detail="Webhook body must be a JSON object.")
    PaymentService(db, gateway, settings).handle_webhook("snippe", event)
    return {"status": "received"}
