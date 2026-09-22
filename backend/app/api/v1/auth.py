from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.api.deps import database_session
from app.db.models import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from app.services.auth import (
    AuthenticationError,
    RegistrationConflictError,
    authenticate_user,
    create_access_token,
    get_user_from_token,
    register_user,
)

router = APIRouter(prefix="/auth", tags=["authentication"])
bearer = HTTPBearer(auto_error=False)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(database_session)) -> TokenResponse:
    try:
        user = register_user(db, payload)
    except RegistrationConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "email_in_use", "message": str(exc)},
        ) from exc
    return TokenResponse(access_token=create_access_token(user), user=UserResponse.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(database_session)) -> TokenResponse:
    try:
        user = authenticate_user(db, payload)
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_credentials", "message": str(exc)},
        ) from exc
    return TokenResponse(access_token=create_access_token(user), user=UserResponse.model_validate(user))


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(database_session),
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "missing_token", "message": "Authentication required."},
        )
    try:
        return get_user_from_token(db, credentials.credentials)
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_token", "message": str(exc)},
        ) from exc


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(current_user)) -> User:
    return user
