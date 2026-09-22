from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import database_session
from app.api.v1.auth import current_user
from app.api.v1.auth import router as auth_router
from app.db.models import User
from app.schemas.auth import ProfileUpdateRequest, UserResponse
from app.services.auth import update_profile

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


@router.patch("/me", response_model=UserResponse, tags=["authentication"])
def update_current_user_profile(
    payload: ProfileUpdateRequest,
    user: User = Depends(current_user),
    db: Session = Depends(database_session),
) -> User:
    return update_profile(db, user, payload)
