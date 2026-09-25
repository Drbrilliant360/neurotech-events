"""Identity service: registration, login, JWT access tokens, refresh tokens and profile updates.

Login identity lives in `users`; the person who attends events lives in `attendees` and is
linked by `attendees.user_id`. Registering an account creates (or claims) the attendee record
with the same email, so guest registrations made before sign-up attach to the account.

Sessions use a short-lived JWT access token plus an opaque, rotating refresh token. Access
tokens carry the user's `token_version`; bumping it (password change, sign out everywhere)
invalidates every outstanding access token immediately.
"""

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db.models import Attendee, RefreshToken, User
from app.db.models.enums import UserRole
from app.schemas.auth import LoginRequest, ProfileFields, ProfileUpdateRequest, RegisterRequest, UserResponse

password_hash = PasswordHash.recommended()
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_TYPE = "access"
_dummy_hash: str | None = None


class AuthenticationError(Exception):
    """Raised when credentials or a token cannot authenticate a user."""


class RegistrationConflictError(Exception):
    """Raised when registration violates an identity constraint."""


@dataclass(frozen=True)
class TokenPair:
    access_token: str
    refresh_token: str
    expires_in: int


def normalize_email(email: str) -> str:
    return email.strip().lower()


def _now() -> datetime:
    return datetime.now(UTC)


def _aware(value: datetime) -> datetime:
    # SQLite returns naive datetimes; every timestamp this service writes is UTC.
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _digest(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


def _burn_password_check(password: str) -> None:
    """Spend the same time as a real check so response timing does not reveal unknown emails."""
    global _dummy_hash
    if _dummy_hash is None:
        _dummy_hash = password_hash.hash(secrets.token_urlsafe(16))
    password_hash.verify(password, _dummy_hash)


def _attendee_for(db: Session, email: str, full_name: str) -> Attendee:
    attendee = db.scalar(select(Attendee).where(func.lower(Attendee.email) == email, Attendee.user_id.is_(None)))
    if attendee is None:
        attendee = Attendee(email=email, full_name=full_name, interests=[])
        db.add(attendee)
    return attendee


def register_user(db: Session, payload: RegisterRequest, *, role: UserRole = UserRole.ATTENDEE) -> User:
    email = normalize_email(str(payload.email))
    if db.scalar(select(User).where(User.email == email)) is not None:
        raise RegistrationConflictError("An account with this email already exists.")

    user = User(
        email=email,
        password_hash=password_hash.hash(payload.password),
        full_name=payload.full_name.strip(),
        role=role,
    )
    attendee = _attendee_for(db, email, user.full_name)
    attendee.full_name = user.full_name
    for key, value in payload.profile.model_dump().items():
        if value not in (None, []):
            setattr(attendee, key, value)
    user.attendee = attendee
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_profile(db: Session, user: User, payload: ProfileUpdateRequest) -> User:
    changes = payload.model_dump(exclude_unset=True)
    if "full_name" in changes:
        user.full_name = changes.pop("full_name").strip()
    attendee = user.attendee
    if attendee is None:
        attendee = _attendee_for(db, user.email, user.full_name)
        user.attendee = attendee
    attendee.full_name = user.full_name
    for key, value in changes.items():
        if value is not None:
            setattr(attendee, key, value)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, payload: LoginRequest) -> User:
    email = normalize_email(str(payload.email))
    user = db.scalar(select(User).where(User.email == email))
    if not user or not user.password_hash:
        _burn_password_check(payload.password)
        raise AuthenticationError("Invalid email or password.")
    valid, upgraded_hash = password_hash.verify_and_update(payload.password, user.password_hash)
    if not valid or not user.is_active:
        raise AuthenticationError("Invalid email or password.")
    if upgraded_hash:
        user.password_hash = upgraded_hash
    user.last_login_at = _now()
    db.commit()
    return user


def create_access_token(user: User, settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    issued_at = _now()
    return jwt.encode(
        {
            "sub": str(user.id),
            "role": user.role.value,
            "ver": user.token_version or 0,
            "typ": ACCESS_TOKEN_TYPE,
            "iss": settings.jwt_issuer,
            "aud": settings.jwt_audience,
            "iat": issued_at,
            "exp": issued_at + timedelta(minutes=settings.access_token_expire_minutes),
            "jti": secrets.token_hex(8),
        },
        settings.jwt_secret_key,
        algorithm=JWT_ALGORITHM,
    )


def get_user_from_token(db: Session, token: str, settings: Settings | None = None) -> User:
    settings = settings or get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[JWT_ALGORITHM],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
            options={"require": ["exp", "iat", "sub", "aud", "iss"]},
        )
        if payload.get("typ") != ACCESS_TOKEN_TYPE:
            raise AuthenticationError("Invalid or expired access token.")
        user_id = uuid.UUID(str(payload.get("sub")))
    except (jwt.PyJWTError, ValueError) as exc:
        raise AuthenticationError("Invalid or expired access token.") from exc

    user = db.get(User, user_id)
    if not user or not user.is_active or payload.get("ver", 0) != (user.token_version or 0):
        raise AuthenticationError("Invalid or expired access token.")
    return user


# ------------------------------------------------------------------ sessions


def issue_tokens(db: Session, user: User, settings: Settings, *, family_id: uuid.UUID | None = None) -> TokenPair:
    raw, _ = _new_refresh_token(db, user, settings, family_id or uuid.uuid4())
    db.commit()
    return TokenPair(
        access_token=create_access_token(user, settings),
        refresh_token=raw,
        expires_in=settings.access_token_expire_minutes * 60,
    )


def _new_refresh_token(
    db: Session, user: User, settings: Settings, family_id: uuid.UUID
) -> tuple[str, RefreshToken]:
    raw = secrets.token_urlsafe(48)
    record = RefreshToken(
        user_id=user.id,
        family_id=family_id,
        token_hash=_digest(raw),
        expires_at=_now() + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(record)
    db.flush()
    return raw, record


def _revoke_family(db: Session, family_id: uuid.UUID) -> None:
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=_now())
    )


def rotate_refresh_token(db: Session, raw_token: str, settings: Settings) -> tuple[User, TokenPair]:
    """Exchange a refresh token for a new pair. Replaying a rotated token revokes its family."""
    record = db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == _digest(raw_token)).with_for_update()
    )
    if record is None:
        raise AuthenticationError("Invalid refresh token.")
    if record.revoked_at is not None:
        _revoke_family(db, record.family_id)
        db.commit()
        raise AuthenticationError("Refresh token has been revoked. Please sign in again.")
    if _aware(record.expires_at) <= _now():
        raise AuthenticationError("Refresh token has expired. Please sign in again.")
    user = db.get(User, record.user_id)
    if user is None or not user.is_active:
        raise AuthenticationError("Invalid refresh token.")

    raw, replacement = _new_refresh_token(db, user, settings, record.family_id)
    record.revoked_at = _now()
    record.replaced_by_id = replacement.id
    db.commit()
    return user, TokenPair(
        access_token=create_access_token(user, settings),
        refresh_token=raw,
        expires_in=settings.access_token_expire_minutes * 60,
    )


def revoke_refresh_token(db: Session, raw_token: str) -> User | None:
    """Sign out one session. Unknown tokens are ignored so sign-out never leaks token validity."""
    record = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == _digest(raw_token)))
    if record is None:
        return None
    _revoke_family(db, record.family_id)
    db.commit()
    return db.get(User, record.user_id)


def revoke_all_sessions(db: Session, user: User) -> None:
    """Sign out everywhere: invalidates every access token and refresh token for the user."""
    user.token_version = (user.token_version or 0) + 1
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=_now())
    )
    db.commit()


def change_password(db: Session, user: User, current_password: str, new_password: str) -> None:
    if not user.password_hash or not password_hash.verify(current_password, user.password_hash):
        raise AuthenticationError("Current password is incorrect.")
    user.password_hash = password_hash.hash(new_password)
    revoke_all_sessions(db, user)


def user_response(user: User) -> UserResponse:
    profile = ProfileFields.model_validate(user.attendee) if user.attendee is not None else None
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value,
        is_active=user.is_active,
        profile=profile,
    )
