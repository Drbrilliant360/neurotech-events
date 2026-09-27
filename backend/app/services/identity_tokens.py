import hashlib
import logging
import secrets
from datetime import UTC, datetime, timedelta
from urllib.parse import quote

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config import Settings
from app.db.models import IdentityToken, RefreshToken, User
from app.integrations.messaging import NotificationProvider
from app.services.auth import normalize_email, password_hash

VERIFY = "verify_email"
RESET = "reset_password"
logger = logging.getLogger(__name__)


class InvalidIdentityToken(Exception):
    pass


def _now() -> datetime:
    return datetime.now(UTC)


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def _digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def request_identity_link(
    db: Session, settings: Settings, provider: NotificationProvider, *, email: str, purpose: str
) -> None:
    user = db.scalar(select(User).where(User.email == normalize_email(email)))
    if user is None or not user.is_active or (purpose == VERIFY and user.email_verified_at is not None):
        return
    now = _now()
    db.execute(
        update(IdentityToken)
        .where(
            IdentityToken.user_id == user.id,
            IdentityToken.purpose == purpose,
            IdentityToken.consumed_at.is_(None),
        )
        .values(consumed_at=now)
    )
    raw = secrets.token_urlsafe(48)
    lifetime = (
        timedelta(hours=settings.email_verification_expire_hours)
        if purpose == VERIFY
        else timedelta(minutes=settings.password_reset_expire_minutes)
    )
    db.add(IdentityToken(user_id=user.id, purpose=purpose, token_hash=_digest(raw), expires_at=now + lifetime))
    db.commit()
    path = "/verify-email" if purpose == VERIFY else "/reset-password"
    try:
        provider.send_identity_link(
            recipient=user.email,
            kind=purpose,
            url=f"{settings.frontend_base_url.rstrip('/')}{path}?token={quote(raw)}",
        )
    except Exception:
        # Delivery failures must not make known-account responses distinguishable. Never log the URL/token.
        logger.exception("Identity notification delivery failed (kind=%s)", purpose)


def _consume(db: Session, raw_token: str, purpose: str) -> tuple[IdentityToken, User]:
    record = db.scalar(
        select(IdentityToken)
        .where(IdentityToken.token_hash == _digest(raw_token), IdentityToken.purpose == purpose)
        .with_for_update()
    )
    now = _now()
    if record is None or record.consumed_at is not None or _aware(record.expires_at) <= now:
        raise InvalidIdentityToken("This link is invalid or has expired.")
    user = db.get(User, record.user_id)
    if user is None or not user.is_active:
        raise InvalidIdentityToken("This link is invalid or has expired.")
    record.consumed_at = now
    return record, user


def verify_email(db: Session, raw_token: str) -> User:
    _, user = _consume(db, raw_token, VERIFY)
    user.email_verified_at = _now()
    db.execute(
        update(IdentityToken)
        .where(IdentityToken.user_id == user.id, IdentityToken.purpose == VERIFY, IdentityToken.consumed_at.is_(None))
        .values(consumed_at=_now())
    )
    db.commit()
    return user


def reset_password(db: Session, raw_token: str, new_password: str) -> User:
    _, user = _consume(db, raw_token, RESET)
    user.password_hash = password_hash.hash(new_password)
    user.token_version = (user.token_version or 0) + 1
    now = _now()
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    db.execute(
        update(IdentityToken)
        .where(IdentityToken.user_id == user.id, IdentityToken.purpose == RESET, IdentityToken.consumed_at.is_(None))
        .values(consumed_at=now)
    )
    db.commit()
    return user
