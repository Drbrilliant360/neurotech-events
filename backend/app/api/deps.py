import secrets
from collections.abc import Generator
from functools import lru_cache
from typing import Annotated

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db.session import get_db
from app.integrations.payments.snippe import PaymentGateway, SnippeClient


def database_session() -> Generator[Session, None, None]:
    yield from get_db()


def settings_dependency() -> Settings:
    return get_settings()


DbSession = Annotated[Session, Depends(database_session)]
AppSettings = Annotated[Settings, Depends(settings_dependency)]


@lru_cache
def _snippe_client(api_key: str, base_url: str) -> SnippeClient:
    return SnippeClient(api_key, base_url=base_url)


def payment_gateway(settings: AppSettings) -> PaymentGateway | None:
    """The configured payment provider, or None when no API key is set (payments disabled)."""
    if not settings.snippe_api_key:
        return None
    return _snippe_client(settings.snippe_api_key, settings.snippe_base_url)


Gateway = Annotated[PaymentGateway | None, Depends(payment_gateway)]


def require_super_admin(
    settings: AppSettings,
    db: DbSession,
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    """Platform-admin gate for money and cross-tenant data.

    Accepts either the static `ADMIN_API_TOKEN` (operational break-glass) or a JWT belonging to
    an active user with the `platform_admin` role. Enforced server-side; the browser never
    decides who may see transactions.
    """
    from app.db.models.enums import UserRole
    from app.services.auth import AuthenticationError, get_user_from_token

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Admin bearer token required.")
    presented = authorization.split(" ", 1)[1].strip()
    if settings.admin_api_token and secrets.compare_digest(presented, settings.admin_api_token):
        return
    try:
        user = get_user_from_token(db, presented, settings)
    except AuthenticationError as exc:
        raise HTTPException(status_code=403, detail="Invalid admin token.") from exc
    if user.role != UserRole.PLATFORM_ADMIN:
        raise HTTPException(status_code=403, detail="Platform admin role required.")
