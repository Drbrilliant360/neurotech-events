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
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    """Interim platform-admin gate: a static bearer token from the environment.

    Replaced by role-based authorization in Phase 1 identity. Kept server-side so the browser
    never decides who may see money.
    """
    if not settings.admin_api_token:
        raise HTTPException(status_code=503, detail="Admin access is not configured on this server.")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Admin bearer token required.")
    presented = authorization.split(" ", 1)[1].strip()
    if not secrets.compare_digest(presented, settings.admin_api_token):
        raise HTTPException(status_code=403, detail="Invalid admin token.")
