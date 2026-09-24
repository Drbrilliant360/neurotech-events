"""Identity service: registration, login, JWT access tokens and profile updates.

Login identity lives in `users`; the person who attends events lives in `attendees` and is
linked by `attendees.user_id`. Registering an account creates (or claims) the attendee record
with the same email, so guest registrations made before sign-up attach to the account.
"""

import uuid
from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db.models import Attendee, User
from app.db.models.enums import UserRole
from app.schemas.auth import LoginRequest, ProfileFields, ProfileUpdateRequest, RegisterRequest, UserResponse

password_hash = PasswordHash.recommended()
JWT_ALGORITHM = "HS256"


class AuthenticationError(Exception):
    """Raised when credentials or a token cannot authenticate a user."""


class RegistrationConflictError(Exception):
    """Raised when registration violates an identity constraint."""


def normalize_email(email: str) -> str:
    return email.strip().lower()


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
    if (
        not user
        or not user.is_active
        or not user.password_hash
        or not password_hash.verify(payload.password, user.password_hash)
    ):
        raise AuthenticationError("Invalid email or password.")
    user.last_login_at = datetime.now(UTC)
    db.commit()
    return user


def create_access_token(user: User, settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode(
        {"sub": str(user.id), "role": user.role.value, "exp": expires_at},
        settings.jwt_secret_key,
        algorithm=JWT_ALGORITHM,
    )


def get_user_from_token(db: Session, token: str, settings: Settings | None = None) -> User:
    settings = settings or get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[JWT_ALGORITHM])
        user_id = uuid.UUID(str(payload.get("sub")))
    except (jwt.PyJWTError, ValueError) as exc:
        raise AuthenticationError("Invalid or expired access token.") from exc

    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise AuthenticationError("Invalid or expired access token.")
    return user


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
