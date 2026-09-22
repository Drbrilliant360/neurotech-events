from fastapi import APIRouter

from app.api.v1 import admin_payments, payments, webhooks

router = APIRouter()
router.include_router(payments.router)
router.include_router(webhooks.router)
router.include_router(admin_payments.router)


@router.get("/meta", tags=["system"])
def api_metadata() -> dict[str, str]:
    return {
        "api_version": "v1",
        "service": "neurotech-events",
        "status": "available",
    }
