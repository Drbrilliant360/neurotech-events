import json
import time
from decimal import Decimal

import httpx

from app.integrations.payments.snippe import (
    SnippeClient,
    compute_webhook_signature,
    normalise_phone,
    parse_gateway_payment,
    verify_webhook_signature,
)
from app.services.payments import compute_total


def test_signature_round_trip() -> None:
    body = b'{"id":"evt_1","type":"payment.completed"}'
    ts = str(int(time.time()))
    signature = compute_webhook_signature("secret", ts, body)
    assert verify_webhook_signature("secret", ts, signature, body)
    assert verify_webhook_signature("secret", ts, signature.upper(), body)


def test_signature_rejects_tampering_and_wrong_key() -> None:
    body = b'{"id":"evt_1"}'
    ts = str(int(time.time()))
    signature = compute_webhook_signature("secret", ts, body)
    assert not verify_webhook_signature("secret", ts, signature, b'{"id":"evt_2"}')
    assert not verify_webhook_signature("other", ts, signature, body)
    assert not verify_webhook_signature(None, ts, signature, body)
    assert not verify_webhook_signature("secret", ts, None, body)


def test_signature_rejects_stale_timestamp() -> None:
    body = b"{}"
    old = str(int(time.time()) - 600)
    signature = compute_webhook_signature("secret", old, body)
    assert not verify_webhook_signature("secret", old, signature, body)
    assert verify_webhook_signature("secret", old, signature, body, now=int(old) + 10)
    assert not verify_webhook_signature("secret", "not-a-number", signature, body)


def test_parse_gateway_payment_handles_object_and_scalar_amounts() -> None:
    webhook_shape = parse_gateway_payment(
        {
            "reference": "pi_1",
            "status": "COMPLETED",
            "amount": {"value": 50000, "currency": "TZS"},
            "channel": {"type": "mobile_money", "provider": "mpesa"},
            "failure_reason": None,
        }
    )
    assert (webhook_shape.amount, webhook_shape.currency, webhook_shape.status) == (50000, "TZS", "completed")
    assert webhook_shape.provider == "mpesa"

    session_shape = parse_gateway_payment(
        {"reference": "sess_1", "status": "pending", "amount": 500, "currency": "TZS"}
    )
    assert (session_shape.amount, session_shape.currency) == (500, "TZS")


def test_normalise_phone() -> None:
    assert normalise_phone("+255 712 345 678") == "255712345678"
    assert normalise_phone("0712345678") == "255712345678"
    assert normalise_phone("255712345678") == "255712345678"


def test_mobile_payout_uses_documented_contract_and_idempotency() -> None:
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = request.url.path
        captured["key"] = request.headers["Idempotency-Key"]
        captured["body"] = json.loads(request.content)
        return httpx.Response(201, json={"status": "success", "data": {
            "reference": "po_123", "status": "pending",
            "amount": {"value": 5000, "currency": "TZS"},
        }})

    client = SnippeClient("test", transport=httpx.MockTransport(handler))
    payout = client.create_mobile_payout(
        amount=5000, recipient_phone="0712345678", recipient_name="Asha Mwinyi",
        narration="Ticket refund", idempotency_key="RF-123", metadata={"payment_id": "pay_1"},
        webhook_url="https://api.example.org/api/v1/webhooks/snippe",
    )
    assert payout.reference == "po_123" and payout.amount == 5000
    assert captured["path"] == "/v1/payouts/send" and captured["key"] == "RF-123"
    assert captured["body"] == {
        "amount": 5000, "channel": "mobile", "recipient_phone": "255712345678",
        "recipient_name": "Asha Mwinyi", "narration": "Ticket refund",
        "metadata": {"payment_id": "pay_1"},
        "webhook_url": "https://api.example.org/api/v1/webhooks/snippe",
    }


def test_compute_total_matches_frontend_rounding() -> None:
    assert compute_total(Decimal("100000"), Decimal("18")) == 118000
    assert compute_total(Decimal("20000"), Decimal("18")) == 23600
    # 1 * 50% = 0.5 rounds half-up to 1, like JavaScript's Math.round.
    assert compute_total(Decimal("1"), Decimal("50")) == 2
    assert compute_total(Decimal("0"), Decimal("18")) == 0
