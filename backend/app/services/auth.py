from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import AttendeeProfile, User
from app.schemas.auth import LoginRequest, ProfileUpdateRequest, RegisterRequest

password_hash = PasswordHash.recommended()


class AuthenticationError(Exception):
    """Raised when credentials cannot authenticate a user."""


class RegistrationConflictError(Exception):
    """Raised when registration violates an identity constraint."""


def normalize_email(email: str) -> str:
    return email.strip().lower()


def register_user(db: Session, payload: RegisterRequest) -> User:
    email = normalize_email(str(payload.email))
    existing = db.scalar(select(User).where(User.email == email))
    if existing:
        raise RegistrationConflictError("An account with this email already exists.")

    user = User(
        email=email,
        password_hash=password_hash.hash(payload.password),
        full_name=payload.full_name.strip(),
        profile=AttendeeProfile(**payload.profile.model_dump()),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_profile(db: Session, user: User, payload: ProfileUpdateRequest) -> User:
    changes = payload.model_dump(exclude_unset=True)
    if "full_name" in changes:
        user.full_name = changes.pop("full_name").strip()
    profile_changes = {key: value for key, value in changes.items() if value is not None}
    if user.profile is None:
        user.profile = AttendeeProfile()
    for key, value in profile_changes.items():
        setattr(user.profile, key, value)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, payload: LoginRequest) -> User:
    email = normalize_email(str(payload.email))
    user = db.scalar(select(User).where(User.email == email))
    if not user or not user.is_active or not password_hash.verify(payload.password, user.password_hash):
        raise AuthenticationError("Invalid email or password.")
    return user


def create_access_token(user: User) -> str:
    settings = get_settings()
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode(
        {"sub": user.id, "role": user.role, "exp": expires_at},
        settings.jwt_secret_key,
        algorithm="HS256",
    )


def get_user_from_token(db: Session, token: str) -> User:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=["HS256"])
        user_id = payload.get("sub")
    except jwt.PyJWTError as exc:
        raise AuthenticationError("Invalid or expired access token.") from exc

    user = db.get(User, user_id) if user_id else None
    if not user or not user.is_active:
        raise AuthenticationError("Invalid or expired access token.")
    return user
