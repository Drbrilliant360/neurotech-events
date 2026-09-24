import pytest
from pydantic import ValidationError

from app.config import Settings


def test_production_rejects_default_jwt_secret() -> None:
    with pytest.raises(ValidationError, match="JWT_SECRET_KEY"):
        Settings(_env_file=None, environment="production")


def test_production_rejects_wildcard_cors() -> None:
    with pytest.raises(ValidationError, match="CORS_ORIGINS"):
        Settings(
            _env_file=None,
            environment="production",
            jwt_secret_key="x" * 64,
            cors_origins="*",
        )
