from fastapi import APIRouter

from app.api.v1.auth import router as auth_router

router = APIRouter()
router.include_router(auth_router)


@router.get("/meta", tags=["system"])
def api_metadata() -> dict[str, str]:
    return {
        "api_version": "v1",
        "service": "neurotech-events",
        "status": "available",
    }
