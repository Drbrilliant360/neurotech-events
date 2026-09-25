import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.errors import register_error_handlers
from app.config import Settings
from app.core.middleware import BodySizeLimitMiddleware, RequestContextMiddleware


def test_responses_carry_request_id_and_security_headers(client) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert len(response.headers["x-request-id"]) >= 8
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"


def test_valid_incoming_request_id_is_propagated(client) -> None:
    response = client.get("/health", headers={"X-Request-ID": "trace-abc-12345"})
    assert response.headers["x-request-id"] == "trace-abc-12345"


def test_malformed_request_id_is_replaced(client) -> None:
    response = client.get("/health", headers={"X-Request-ID": "bad id with spaces\n"})
    assert response.headers["x-request-id"] != "bad id with spaces\n"


def test_readiness_checks_database(client) -> None:
    response = client.get("/health/ready")
    assert response.status_code == 200
    assert response.json()["database"] == "reachable"


def test_oversized_body_is_rejected_before_routing() -> None:
    app = FastAPI()
    app.add_middleware(BodySizeLimitMiddleware, max_bytes=16)

    @app.post("/echo")
    async def echo(payload: dict) -> dict:
        return payload

    client = TestClient(app)
    body = b'{"value":"' + b"x" * 64 + b'"}'
    response = client.post("/echo", content=body, headers={"content-type": "application/json"})
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "payload_too_large"


def test_unhandled_errors_return_generic_envelope_without_internals() -> None:
    app = FastAPI()
    app.add_middleware(RequestContextMiddleware, hsts=False)
    register_error_handlers(app)

    @app.get("/boom")
    def boom() -> None:
        raise RuntimeError("secret internal detail")

    response = TestClient(app, raise_server_exceptions=False).get("/boom")
    assert response.status_code == 500
    body = response.json()["error"]
    assert body["code"] == "internal_error"
    assert "secret" not in response.text
    assert body["request_id"]


def test_validation_errors_do_not_echo_submitted_secrets(client) -> None:
    response = client.post("/api/v1/auth/register", json={"email": "not-an-email", "password": "hunter2-secret"})
    assert response.status_code == 422
    assert "hunter2-secret" not in response.text


def test_docs_are_hidden_by_default_in_production() -> None:
    settings = Settings(_env_file=None, environment="production", jwt_secret_key="x" * 64)
    assert settings.docs_visible is False
    assert Settings(_env_file=None).docs_visible is True


def test_production_rejects_debug_mode() -> None:
    with pytest.raises(ValidationError, match="DEBUG"):
        Settings(_env_file=None, environment="production", jwt_secret_key="x" * 64, debug=True)
