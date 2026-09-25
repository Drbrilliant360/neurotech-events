import secrets
from collections.abc import Generator
from functools import lru_cache
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.core.rate_limit import limiter
from app.db.session import get_db
from app.integrations.payments.snippe import PaymentGateway, SnippeClient
from app.services.errors import RateLimitedError


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
    if (
        settings.environment.lower() in {"development", "test"}
        and settings.admin_api_token
        and secrets.compare_digest(presented, settings.admin_api_token)
    ):
        return
    try:
        user = get_user_from_token(db, presented, settings)
    except AuthenticationError as exc:
        raise HTTPException(status_code=403, detail="Invalid admin token.") from exc
    if user.role != UserRole.PLATFORM_ADMIN:
        raise HTTPException(status_code=403, detail="Platform admin role required.")


def client_ip(request: Request) -> str:
    # Uvicorn's --proxy-headers rewrites request.client from X-Forwarded-For, but only for
    # proxies listed in --forwarded-allow-ips, so this value cannot be spoofed by clients.
    return request.client.host if request.client else "unknown"


def rate_limit(bucket: str, setting: str):
    """Dependency factory: limit a route to `settings.<setting>` requests per minute per client IP."""

    def dependency(request: Request, settings: AppSettings) -> None:
        enforce_rate_limit(settings, f"{bucket}:{client_ip(request)}", getattr(settings, setting))

    return dependency


def enforce_rate_limit(settings: Settings, key: str, per_minute: int) -> None:
    if not settings.rate_limit_enabled:
        return
    retry_after = limiter.hit(key, per_minute)
    if retry_after is not None:
        raise RateLimitedError("Too many requests. Please wait and try again.", retry_after=retry_after)


def login_failure_keys(settings: Settings, email: str, ip: str) -> list[tuple[str, int]]:
    per_account = settings.login_failures_per_account_per_minute
    return [(f"login-fail:{email}:{ip}", per_account), (f"login-fail:{email}", per_account * 4)]


def check_login_lockout(settings: Settings, email: str, ip: str) -> None:
    """Only failures count, so a victim's own successful logins never lock them out, and an
    attacker must fail from many IPs to hit the account-wide ceiling."""
    if not settings.rate_limit_enabled:
        return
    waits = [limiter.retry_after(key, limit) for key, limit in login_failure_keys(settings, email, ip)]
    waits = [wait for wait in waits if wait is not None]
    if waits:
        raise RateLimitedError("Too many failed sign-in attempts. Please wait and try again.", retry_after=max(waits))


def record_login_failure(settings: Settings, email: str, ip: str) -> None:
    if settings.rate_limit_enabled:
        for key, limit in login_failure_keys(settings, email, ip):
            limiter.hit(key, limit)
