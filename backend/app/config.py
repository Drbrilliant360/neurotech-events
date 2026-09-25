from functools import lru_cache

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEVELOPMENT_JWT_SECRET = "unsafe-development-secret-change-me-32"
HARDENED_ENVIRONMENTS = {"production", "staging"}


class Settings(BaseSettings):
    app_name: str = "Neurotech Events API"
    environment: str = "development"
    api_prefix: str = "/api/v1"
    database_url: str = "sqlite:///./neurotech-events.db"
    debug: bool = False
    # Interactive docs and the OpenAPI schema. Defaults to off in production/staging.
    docs_enabled: bool | None = None

    # Database connection pool (ignored for SQLite). Neon closes idle connections, so recycle early.
    db_pool_size: int = 5
    db_max_overflow: int = 10
    db_pool_timeout_seconds: int = 10
    db_pool_recycle_seconds: int = 300

    jwt_secret_key: str = DEVELOPMENT_JWT_SECRET
    jwt_issuer: str = "neurotech-events-api"
    jwt_audience: str = "neurotech-events"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 14

    # Per-client request budgets. In-process, so each worker keeps its own window; put an
    # edge limiter (load balancer / CDN) in front for multi-instance deployments.
    rate_limit_enabled: bool = True
    auth_rate_limit_per_minute: int = 10
    # Failed logins per account: per client IP, and a looser ceiling across all IPs (x4).
    login_failures_per_account_per_minute: int = 5
    payment_rate_limit_per_minute: int = 10
    check_in_rate_limit_per_minute: int = 120
    # Requests with larger bodies are rejected before they reach a route.
    max_request_body_bytes: int = 1_048_576

    # Unpaid registrations hold a seat this long before the seat returns to sale.
    pending_registration_hold_minutes: int = 30
    # Minimum seconds between provider status checks for one payment while a client polls.
    payment_sync_interval_seconds: int = 5

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
        if self.is_hardened:
            if self.jwt_secret_key == DEVELOPMENT_JWT_SECRET or len(self.jwt_secret_key) < 32:
                raise ValueError("JWT_SECRET_KEY must be a unique secret with at least 32 characters.")
            if "*" in self.cors_origin_list:
                raise ValueError("CORS_ORIGINS must explicitly list trusted origins.")
            if self.debug:
                raise ValueError("DEBUG must be disabled in production/staging.")
        return self

    @property
    def is_hardened(self) -> bool:
        return self.environment.lower() in HARDENED_ENVIRONMENTS

    @property
    def docs_visible(self) -> bool:
        return self.docs_enabled if self.docs_enabled is not None else not self.is_hardened

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def snippe_webhook_url(self) -> str | None:
        # Snippe only accepts HTTPS webhook URLs up to 500 characters; otherwise rely on polling.
        if not self.public_base_url or not self.public_base_url.startswith("https://"):
            return None
        url = f"{self.public_base_url.rstrip('/')}{self.api_prefix}/webhooks/snippe"
        return url if len(url) <= 500 else None


@lru_cache
def get_settings() -> Settings:
    return Settings()
