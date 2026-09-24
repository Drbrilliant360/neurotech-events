from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.api.deps import AppSettings, DbSession
from app.db.models import User
from app.schemas.auth import LoginRequest, ProfileUpdateRequest, RegisterRequest, TokenResponse, UserResponse
from app.services.auth import (
    AuthenticationError,
    RegistrationConflictError,
    authenticate_user,
    create_access_token,
    get_user_from_token,
    register_user,
    update_profile,
    user_response,
)

router = APIRouter(prefix="/auth", tags=["authentication"])
bearer = HTTPBearer(auto_error=False)


def current_user(
    db: DbSession,
    settings: AppSettings,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)] = None,
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "missing_token", "message": "Authentication required."},
        )
    try:
        return get_user_from_token(db, credentials.credentials, settings)
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_token", "message": str(exc)},
        ) from exc


CurrentUser = Annotated[User, Depends(current_user)]


def optional_current_user(
    db: DbSession,
    settings: AppSettings,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)] = None,
) -> User | None:
    if credentials is None:
        return None
    try:
        return get_user_from_token(db, credentials.credentials, settings)
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_token", "message": str(exc)},
        ) from exc


OptionalCurrentUser = Annotated[User | None, Depends(optional_current_user)]


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: DbSession, settings: AppSettings) -> TokenResponse:
    try:
        user = register_user(db, payload)
    except RegistrationConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "email_in_use", "message": str(exc)},
        ) from exc
    return TokenResponse(access_token=create_access_token(user, settings), user=user_response(user))


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: DbSession, settings: AppSettings) -> TokenResponse:
    try:
        user = authenticate_user(db, payload)
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_credentials", "message": str(exc)},
        ) from exc
    return TokenResponse(access_token=create_access_token(user, settings), user=user_response(user))


@router.get("/me", response_model=UserResponse)
def me(user: CurrentUser) -> UserResponse:
    return user_response(user)


@router.patch("/me", response_model=UserResponse)
def update_current_profile(payload: ProfileUpdateRequest, user: CurrentUser, db: DbSession) -> UserResponse:
    return user_response(update_profile(db, user, payload))
