from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.api.deps import (
    AppSettings,
    DbSession,
    IdentityNotifier,
    check_login_lockout,
    client_ip,
    rate_limit,
    record_login_failure,
)
from app.db.models import User
from app.schemas.auth import (
    IdentityEmailRequest,
    IdentityTokenRequest,
    LoginRequest,
    MessageResponse,
    PasswordChangeRequest,
    PasswordResetConfirmRequest,
    ProfileUpdateRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from app.services import audit
from app.services.auth import (
    AuthenticationError,
    RegistrationConflictError,
    TokenPair,
    authenticate_user,
    change_password,
    get_user_from_token,
    issue_tokens,
    normalize_email,
    register_user,
    revoke_all_sessions,
    revoke_refresh_token,
    rotate_refresh_token,
    update_profile,
    user_response,
)
from app.services.identity_tokens import (
    RESET,
    VERIFY,
    InvalidIdentityToken,
    request_identity_link,
    reset_password,
    verify_email,
)

router = APIRouter(prefix="/auth", tags=["authentication"])
bearer = HTTPBearer(auto_error=False)
auth_rate_limit = Depends(rate_limit("auth", "auth_rate_limit_per_minute"))
identity_rate_limit = Depends(rate_limit("identity", "identity_rate_limit_per_minute"))
GENERIC_IDENTITY_MESSAGE = "If the account is eligible, instructions have been sent."


def _unauthorized(code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"code": code, "message": message},
        headers={"WWW-Authenticate": "Bearer"},
    )


def current_user(
    db: DbSession,
    settings: AppSettings,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)] = None,
) -> User:
    if not credentials:
        raise _unauthorized("missing_token", "Authentication required.")
    try:
        return get_user_from_token(db, credentials.credentials, settings)
    except AuthenticationError as exc:
        raise _unauthorized("invalid_token", str(exc)) from exc


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
        raise _unauthorized("invalid_token", str(exc)) from exc


OptionalCurrentUser = Annotated[User | None, Depends(optional_current_user)]


def _audit_user(db: DbSession, action: str, user: User, request: Request) -> None:
    audit.record(db, action, actor=user, target_type="user", target_id=user.id, ip_address=client_ip(request))


def _token_response(db: DbSession, user: User, tokens: TokenPair) -> TokenResponse:
    return TokenResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        expires_in=tokens.expires_in,
        user=user_response(user, db),
    )


@router.post(
    "/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED, dependencies=[auth_rate_limit]
)
def register(
    payload: RegisterRequest,
    request: Request,
    db: DbSession,
    settings: AppSettings,
    notifier: IdentityNotifier,
) -> TokenResponse:
    try:
        user = register_user(db, payload)
    except RegistrationConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "email_in_use", "message": str(exc)},
        ) from exc
    _audit_user(db, "auth.register", user, request)
    db.commit()
    request_identity_link(db, settings, notifier, email=user.email, purpose=VERIFY)
    return _token_response(db, user, issue_tokens(db, user, settings))


@router.post("/login", response_model=TokenResponse, dependencies=[auth_rate_limit])
def login(payload: LoginRequest, request: Request, db: DbSession, settings: AppSettings) -> TokenResponse:
    email = normalize_email(str(payload.email))
    ip = client_ip(request)
    check_login_lockout(settings, email, ip)
    try:
        user = authenticate_user(db, payload, settings)
    except AuthenticationError as exc:
        record_login_failure(settings, email, ip)
        audit.record(db, "auth.login_failed", ip_address=ip, details={"email": email})
        db.commit()
        raise _unauthorized("invalid_credentials", str(exc)) from exc
    audit.record(db, "auth.login", actor=user, target_type="user", target_id=user.id, ip_address=ip)
    return _token_response(db, user, issue_tokens(db, user, settings))


@router.post("/refresh", response_model=TokenResponse, dependencies=[auth_rate_limit])
def refresh(payload: RefreshRequest, db: DbSession, settings: AppSettings) -> TokenResponse:
    """Exchange a refresh token for a new access token and a new (rotated) refresh token."""
    try:
        user, tokens = rotate_refresh_token(db, payload.refresh_token, settings)
    except AuthenticationError as exc:
        raise _unauthorized("invalid_refresh_token", str(exc)) from exc
    return _token_response(db, user, tokens)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(payload: RefreshRequest, request: Request, db: DbSession) -> None:
    """Revoke this session's refresh token. The access token expires on its own shortly after."""
    user = revoke_refresh_token(db, payload.refresh_token)
    if user is not None:
        _audit_user(db, "auth.logout", user, request)
        db.commit()


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
def logout_everywhere(user: CurrentUser, request: Request, db: DbSession) -> None:
    """Revoke every access and refresh token for the signed-in user."""
    _audit_user(db, "auth.logout_all", user, request)
    revoke_all_sessions(db, user)


@router.post("/password", response_model=TokenResponse, dependencies=[auth_rate_limit])
def update_password(
    payload: PasswordChangeRequest, user: CurrentUser, request: Request, db: DbSession, settings: AppSettings
) -> TokenResponse:
    """Change the password, sign out every other session and return fresh tokens for this one."""
    if payload.new_password == payload.current_password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "password_unchanged", "message": "The new password must differ from the current one."},
        )
    try:
        change_password(db, user, payload.current_password, payload.new_password)
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail={"code": "invalid_password", "message": str(exc)}
        ) from exc
    _audit_user(db, "auth.password_changed", user, request)
    return _token_response(db, user, issue_tokens(db, user, settings))


@router.get("/me", response_model=UserResponse)
def me(user: CurrentUser, db: DbSession) -> UserResponse:
    return user_response(user, db)


@router.patch("/me", response_model=UserResponse)
def update_current_profile(payload: ProfileUpdateRequest, user: CurrentUser, db: DbSession) -> UserResponse:
    return user_response(update_profile(db, user, payload), db)


@router.post(
    "/email-verification/request", response_model=MessageResponse, status_code=202, dependencies=[identity_rate_limit]
)
def request_email_verification(
    payload: IdentityEmailRequest, db: DbSession, settings: AppSettings, notifier: IdentityNotifier
) -> MessageResponse:
    request_identity_link(db, settings, notifier, email=str(payload.email), purpose=VERIFY)
    return MessageResponse(message=GENERIC_IDENTITY_MESSAGE)


@router.post("/email-verification/confirm", response_model=MessageResponse, dependencies=[identity_rate_limit])
def confirm_email_verification(payload: IdentityTokenRequest, db: DbSession) -> MessageResponse:
    try:
        verify_email(db, payload.token)
    except InvalidIdentityToken as exc:
        raise HTTPException(status_code=400, detail={"code": "invalid_identity_token", "message": str(exc)}) from exc
    return MessageResponse(message="Email address verified. You can now sign in.")


@router.post(
    "/password-reset/request", response_model=MessageResponse, status_code=202, dependencies=[identity_rate_limit]
)
def request_password_reset(
    payload: IdentityEmailRequest, db: DbSession, settings: AppSettings, notifier: IdentityNotifier
) -> MessageResponse:
    request_identity_link(db, settings, notifier, email=str(payload.email), purpose=RESET)
    return MessageResponse(message=GENERIC_IDENTITY_MESSAGE)


@router.post("/password-reset/confirm", response_model=MessageResponse, dependencies=[identity_rate_limit])
def confirm_password_reset(payload: PasswordResetConfirmRequest, request: Request, db: DbSession) -> MessageResponse:
    try:
        user = reset_password(db, payload.token, payload.new_password)
    except InvalidIdentityToken as exc:
        raise HTTPException(status_code=400, detail={"code": "invalid_identity_token", "message": str(exc)}) from exc
    _audit_user(db, "auth.password_reset", user, request)
    db.commit()
    return MessageResponse(message="Password reset complete. Sign in with your new password.")
