"""Snippe payment gateway adapter (https://snippe.sh, API version 2026-01-25).

Collections only: Tanzanian mobile money (M-Pesa, Airtel Money, Mixx by Yas, HaloPesa).
Disbursements are intentionally out of scope. The `PaymentGateway` protocol is what the
payment service depends on, so tests can substitute a fake without touching the network.
"""

import hashlib
import hmac
import time
from dataclasses import dataclass, field
from typing import Any, Protocol

import httpx

API_VERSION = "2026-01-25"
MIN_AMOUNT_TZS = 500
IDEMPOTENCY_KEY_MAX_LENGTH = 30
WEBHOOK_TOLERANCE_SECONDS = 300


class SnippeError(Exception):
    """Raised when Snippe rejects a request or cannot be reached."""

    def __init__(self, message: str, *, status_code: int | None = None, error_code: str | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.error_code = error_code


@dataclass(frozen=True)
class GatewayPayment:
    """Provider-side view of a payment, normalised from Snippe's response shapes."""

    reference: str
    status: str
    amount: int
    currency: str
    expires_at: str | None = None
    external_reference: str | None = None
    provider: str | None = None
    failure_reason: str | None = None
    completed_at: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)


class PaymentGateway(Protocol):
    name: str

    def create_mobile_payment(
        self,
        *,
        amount: int,
        phone_number: str,
        first_name: str,
        last_name: str,
        email: str,
        idempotency_key: str,
        metadata: dict[str, str] | None = None,
        webhook_url: str | None = None,
    ) -> GatewayPayment: ...

    def get_payment(self, reference: str) -> GatewayPayment: ...

    def list_payments(self, **params: Any) -> dict[str, Any]: ...

    def get_balance(self) -> dict[str, Any]: ...


def parse_gateway_payment(data: dict[str, Any]) -> GatewayPayment:
    """Normalise a Snippe payment object. `amount` is an object in some responses and an int in others."""
    amount = data.get("amount")
    if isinstance(amount, dict):
        value, currency = amount.get("value"), amount.get("currency")
    else:
        value, currency = amount, data.get("currency")
    channel = data.get("channel") if isinstance(data.get("channel"), dict) else {}
    return GatewayPayment(
        reference=str(data.get("reference") or ""),
        status=str(data.get("status") or "").lower(),
        amount=int(value or 0),
        currency=str(currency or "TZS"),
        expires_at=data.get("expires_at"),
        external_reference=data.get("external_reference"),
        provider=channel.get("provider"),
        failure_reason=data.get("failure_reason"),
        completed_at=data.get("completed_at"),
        raw=data,
    )


class SnippeClient:
    """Thin synchronous HTTP client for the Snippe API."""

    name = "snippe"

    def __init__(
        self,
        api_key: str,
        *,
        base_url: str = "https://api.snippe.sh",
        timeout: float = 20.0,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._client = httpx.Client(
            base_url=base_url,
            timeout=timeout,
            headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"},
            transport=transport,
        )

    def _request(
        self,
        method: str,
        path: str,
        *,
        json_body: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        try:
            response = self._client.request(method, path, json=json_body, params=params, headers=headers)
        except httpx.HTTPError as exc:
            raise SnippeError(f"Snippe request failed: {exc.__class__.__name__}") from exc
        try:
            body = response.json()
        except ValueError:
            body = {}
        if response.status_code >= 400 or body.get("status") == "error":
            raise SnippeError(
                str(body.get("message") or f"Snippe returned HTTP {response.status_code}"),
                status_code=response.status_code,
                error_code=body.get("error_code"),
            )
        data = body.get("data", body)
        return data if isinstance(data, dict) else {"items": data}

    def create_mobile_payment(
        self,
        *,
        amount: int,
        phone_number: str,
        first_name: str,
        last_name: str,
        email: str,
        idempotency_key: str,
        metadata: dict[str, str] | None = None,
        webhook_url: str | None = None,
    ) -> GatewayPayment:
        if amount < MIN_AMOUNT_TZS:
            raise SnippeError(f"amount {amount} is below the Snippe minimum of {MIN_AMOUNT_TZS} TZS", status_code=400)
        payload: dict[str, Any] = {
            "payment_type": "mobile",
            "details": {"amount": int(amount), "currency": "TZS"},
            "phone_number": normalise_phone(phone_number),
            "customer": {"firstname": first_name, "lastname": last_name, "email": email},
            "metadata": metadata or {},
        }
        if webhook_url:
            payload["webhook_url"] = webhook_url
        data = self._request(
            "POST",
            "/v1/payments",
            json_body=payload,
            headers={"Idempotency-Key": idempotency_key[:IDEMPOTENCY_KEY_MAX_LENGTH]},
        )
        return parse_gateway_payment(data)

    def get_payment(self, reference: str) -> GatewayPayment:
        return parse_gateway_payment(self._request("GET", f"/v1/payments/{reference}"))

    def list_payments(self, **params: Any) -> dict[str, Any]:
        return self._request("GET", "/v1/payments", params={k: v for k, v in params.items() if v is not None})

    def get_balance(self) -> dict[str, Any]:
        return self._request("GET", "/v1/payments/balance")


def normalise_phone(phone: str) -> str:
    """Return a Tanzanian MSISDN in the `255XXXXXXXXX` form Snippe expects."""
    digits = "".join(ch for ch in phone if ch.isdigit())
    if digits.startswith("0") and len(digits) == 10:
        digits = "255" + digits[1:]
    return digits


def compute_webhook_signature(signing_key: str, timestamp: str, raw_body: bytes) -> str:
    message = f"{timestamp}.".encode() + raw_body
    return hmac.new(signing_key.encode(), message, hashlib.sha256).hexdigest()


def verify_webhook_signature(
    signing_key: str | None,
    timestamp: str | None,
    signature: str | None,
    raw_body: bytes,
    *,
    now: float | None = None,
    tolerance_seconds: int = WEBHOOK_TOLERANCE_SECONDS,
) -> bool:
    """HMAC-SHA256 over `{timestamp}.{raw_body}`, constant-time compared, rejecting stale timestamps."""
    if not signing_key or not timestamp or not signature:
        return False
    try:
        event_time = int(timestamp)
    except ValueError:
        return False
    current = int(now if now is not None else time.time())
    if abs(current - event_time) > tolerance_seconds:
        return False
    expected = compute_webhook_signature(signing_key, timestamp, raw_body)
    return hmac.compare_digest(expected, signature.strip().lower())
