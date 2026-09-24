from functools import lru_cache

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Neurotech Events API"
    environment: str = "development"
    api_prefix: str = "/api/v1"
    database_url: str = "sqlite:///./neurotech-events.db"
    debug: bool = False
    jwt_secret_key: str = "unsafe-development-secret-change-me-32"
    access_token_expire_minutes: int = 30

    # Comma-separated browser origins allowed to call this API.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    # Public HTTPS origin of this API (e.g. https://api.example.org). Used to build provider
    # webhook URLs. Leave empty in local development; status is then verified by polling.
    public_base_url: str | None = None
    # Bearer token for the interim super-admin endpoints until Phase 1 identity replaces it.
    admin_api_token: str | None = None

    # Snippe (https://snippe.sh): mobile-money collections for Tanzania.
    snippe_api_key: str | None = None
    snippe_webhook_secret: str | None = None
    snippe_base_url: str = "https://api.snippe.sh"

    model_config = SettingsConfigDict(env_file=".env", env_prefix="", extra="ignore")

    @field_validator("database_url", mode="before")
    @classmethod
    def use_psycopg_driver(cls, value: str) -> str:
        """Use the installed Psycopg 3 driver for standard PostgreSQL URLs."""
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        if self.environment.lower() in {"production", "staging"}:
            if self.jwt_secret_key == "unsafe-development-secret-change-me-32" or len(self.jwt_secret_key) < 32:
                raise ValueError("JWT_SECRET_KEY must be a unique secret with at least 32 characters.")
            if "*" in self.cors_origin_list:
                raise ValueError("CORS_ORIGINS must explicitly list trusted origins.")
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def snippe_webhook_url(self) -> str | None:
        if not self.public_base_url:
            return None
        return f"{self.public_base_url.rstrip('/')}{self.api_prefix}/webhooks/snippe"


@lru_cache
def get_settings() -> Settings:
    return Settings()
