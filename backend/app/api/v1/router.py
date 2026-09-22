from fastapi import APIRouter, Depends

from app.api.v1.auth import current_user
from app.api.v1.auth import router as auth_router
from app.db.models import User
from app.schemas.auth import UserResponse

router = APIRouter()
router.include_router(auth_router)


@router.get("/meta", tags=["system"])
def api_metadata() -> dict[str, str]:
    return {
        "api_version": "v1",
        "service": "neurotech-events",
        "status": "available",
    }


@router.get("/me", response_model=UserResponse, tags=["authentication"])
def current_user_profile(user: User = Depends(current_user)) -> User:
    return user
