from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.db.models  # noqa: F401
from app.api.deps import database_session, payment_gateway, settings_dependency
from app.config import Settings
from app.core.rate_limit import limiter
from app.db.base import Base
from app.db.seed import seed
from app.integrations.payments.snippe import GatewayPayment
from app.main import app

ADMIN_TOKEN = "test-admin-token"
WEBHOOK_SECRET = "whsec_test_secret"


class FakeGateway:
    """In-memory stand-in for Snippe. Records what the service sends and lets tests script outcomes."""

    name = "snippe"

    def __init__(self) -> None:
        self.created: list[dict] = []
        self.statuses: dict[str, str] = {}
        self.providers: dict[str, str] = {}
        self.fail_create: Exception | None = None
        self.counter = 0
        self.balance = {"available": {"currency": "TZS", "value": 350}, "balance": {"currency": "TZS", "value": 350}}
        self.listed = {
            "items": [
                {"reference": "SN-OTHER-APP", "status": "completed", "amount": {"value": 50000, "currency": "TZS"}}
            ],
            "meta": {"page": 1},
        }

    def create_mobile_payment(self, **kwargs) -> GatewayPayment:
        if self.fail_create:
            raise self.fail_create
        self.counter += 1
        reference = f"SN-TEST-{self.counter}"
        self.created.append(kwargs)
        self.statuses[reference] = "pending"
        return GatewayPayment(
            reference=reference,
            status="pending",
            amount=kwargs["amount"],
            currency="TZS",
            expires_at="2026-09-23T00:00:00Z",
        )

    def get_payment(self, reference: str) -> GatewayPayment:
        return GatewayPayment(
            reference=reference,
            status=self.statuses.get(reference, "pending"),
            amount=0,
            currency="TZS",
            provider=self.providers.get(reference),
        )

    def list_payments(self, **params) -> dict:
        return self.listed

    def get_balance(self) -> dict:
        return self.balance


@pytest.fixture
def engine():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def db_factory(engine):
    return sessionmaker(bind=engine, autoflush=False)


@pytest.fixture
def db(db_factory) -> Iterator[Session]:
    with db_factory() as session:
        seed(session)
        yield session


@pytest.fixture
def gateway() -> FakeGateway:
    return FakeGateway()


@pytest.fixture
def test_settings() -> Settings:
    # _env_file=None keeps the real backend/.env (and any real API key) out of the tests.
    return Settings(
        _env_file=None,
        database_url="sqlite://",
        admin_api_token=ADMIN_TOKEN,
        snippe_api_key="snp_test",
        snippe_webhook_secret=WEBHOOK_SECRET,
        public_base_url="https://api.example.org",
        rate_limit_enabled=False,
    )


@pytest.fixture
def client(db_factory, db, gateway, test_settings) -> Iterator[TestClient]:
    def _db():
        with db_factory() as session:
            yield session

    app.dependency_overrides[database_session] = _db
    app.dependency_overrides[payment_gateway] = lambda: gateway
    app.dependency_overrides[settings_dependency] = lambda: test_settings
    limiter.reset()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    limiter.reset()
