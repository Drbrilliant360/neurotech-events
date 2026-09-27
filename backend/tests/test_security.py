import pytest
from pydantic import ValidationError

from app.config import Settings


def test_production_rejects_default_jwt_secret() -> None:
    with pytest.raises(ValidationError, match="JWT_SECRET_KEY"):
        Settings(_env_file=None, environment="production")


def test_production_rejects_default_or_weak_ticket_signing_key() -> None:
    with pytest.raises(ValidationError, match="TICKET_SIGNING_KEY"):
        Settings(_env_file=None, environment="production", jwt_secret_key="j" * 64)
    with pytest.raises(ValidationError, match="TICKET_SIGNING_KEY"):
        Settings(
            _env_file=None,
            environment="production",
            jwt_secret_key="j" * 64,
            ticket_signing_key="too-short",
        )


def test_production_requires_distinct_auth_and_ticket_keys() -> None:
    shared_key = "a-production-secret-that-is-at-least-32-characters"
    with pytest.raises(ValidationError, match="distinct from JWT_SECRET_KEY"):
        Settings(
            _env_file=None,
            environment="production",
            jwt_secret_key=shared_key,
            ticket_signing_key=shared_key,
        )


def test_production_rejects_wildcard_cors() -> None:
    with pytest.raises(ValidationError, match="CORS_ORIGINS"):
        Settings(
            _env_file=None,
            environment="production",
            jwt_secret_key="x" * 64,
            ticket_signing_key="t" * 64,
            cors_origins="*",
        )
