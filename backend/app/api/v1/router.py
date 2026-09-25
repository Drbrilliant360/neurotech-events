from fastapi import APIRouter

from app.api.deps import DbSession
from app.api.v1 import (
    admin_catalogue,
    admin_directory,
    admin_events,
    admin_operations,
    admin_payments,
    auth,
    authorization,
    payments,
    public_events,
    registrations,
    webhooks,
)
from app.api.v1.auth import CurrentUser
from app.schemas.auth import ProfileUpdateRequest, UserResponse
from app.services.auth import update_profile, user_response

router = APIRouter()
router.include_router(auth.router)
router.include_router(payments.router)
router.include_router(webhooks.router)
router.include_router(admin_payments.router)
router.include_router(admin_catalogue.router)
router.include_router(public_events.router)
router.include_router(authorization.router)
router.include_router(registrations.router)
router.include_router(admin_events.router)
router.include_router(admin_directory.router)
router.include_router(admin_operations.router)


@router.get("/meta", tags=["system"])
def api_metadata() -> dict[str, str]:
    return {
        "api_version": "v1",
        "service": "neurotech-events",
        "status": "available",
    }


# Frontend-compatible aliases for the authenticated user's own profile.
@router.get("/me", response_model=UserResponse, tags=["authentication"])
def current_user_profile(user: CurrentUser) -> UserResponse:
    return user_response(user)


@router.patch("/me", response_model=UserResponse, tags=["authentication"])
def update_current_user_profile(payload: ProfileUpdateRequest, user: CurrentUser, db: DbSession) -> UserResponse:
    return user_response(update_profile(db, user, payload))
