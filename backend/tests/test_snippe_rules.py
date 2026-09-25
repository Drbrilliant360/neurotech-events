"""Rules from the Snippe integration skill (API 2026-01-25)."""

from app.integrations.payments.snippe import SnippeError, customer_message, is_valid_webhook_url
from app.services.payments import new_payment_reference
from tests.test_payments_api import CHECKOUT


def test_idempotency_key_fits_snippe_limit() -> None:
    assert all(len(new_payment_reference()) <= 30 for _ in range(100))


def test_webhook_url_must_be_https_and_short() -> None:
    assert is_valid_webhook_url("https://api.example.org/api/v1/webhooks/snippe")
    assert not is_valid_webhook_url("http://api.example.org/api/v1/webhooks/snippe")
    assert not is_valid_webhook_url("https://example.org/" + "x" * 500)


def test_http_public_base_url_is_not_sent_as_webhook(client, gateway, test_settings) -> None:
    test_settings.public_base_url = "http://insecure.example.org"
    assert client.post("/api/v1/payments/mobile", json=CHECKOUT).status_code == 201
    assert gateway.created[-1]["webhook_url"] is None  # falls back to polling


def test_provider_configuration_errors_are_not_shown_to_customers(client, gateway) -> None:
    gateway.fail_create = SnippeError("invalid or missing API key", status_code=401, error_code="unauthorized")
    response = client.post("/api/v1/payments/mobile", json=CHECKOUT)
    assert response.status_code == 502
    assert "API key" not in response.json()["error"]["message"]


def test_validation_errors_stay_actionable() -> None:
    error = SnippeError("phone_number must be a valid phone number", status_code=400, error_code="validation_error")
    assert customer_message(error) == "phone_number must be a valid phone number"
    assert "try again" in customer_message(SnippeError("x", status_code=400, error_code="PAY_001"))


def test_resend_prompt_for_open_payment(client, gateway) -> None:
    payment = client.post("/api/v1/payments/mobile", json=CHECKOUT).json()
    response = client.post(f"/api/v1/payments/{payment['id']}/push")
    assert response.status_code == 200
    assert gateway.pushed == [payment["provider_reference"]]
    assert response.json()["events"][-1]["note"] == "Prompt resent"

    gateway.statuses[payment["provider_reference"]] = "completed"
    client.get(f"/api/v1/payments/{payment['id']}")
    assert client.post(f"/api/v1/payments/{payment['id']}/push").status_code == 409
