import json
import time
import uuid

from sqlalchemy import select

from app.db.models import Payment, PaymentEvent, ProviderWebhookEvent, TicketType
from app.integrations.payments.snippe import SnippeError, compute_webhook_signature
from tests.conftest import ADMIN_TOKEN, WEBHOOK_SECRET

CHECKOUT = {
    "event_slug": "neurotech-summit-2026",
    "ticket_code": "tix_pro",
    "phone_number": "0712 345 678",
    "method": "mpesa",
    "attendee": {"full_name": "Asha Mwinyi", "email": "Asha@Example.org", "organization": "MUHAS"},
    "client_reference": "reg_local_1",
}


def _webhook(client, payload: dict, *, secret: str = WEBHOOK_SECRET, ts: int | None = None):
    body = json.dumps(payload).encode()
    ts_value = str(ts or int(time.time()))
    return client.post(
        "/api/v1/webhooks/snippe",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Webhook-Timestamp": ts_value,
            "X-Webhook-Signature": compute_webhook_signature(secret, ts_value, body),
        },
    )


def test_start_mobile_payment_prices_server_side(client, gateway) -> None:
    response = client.post("/api/v1/payments/mobile", json=CHECKOUT)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["amount"] == 118000  # 100,000 + 18% VAT from the database, not the client
    assert body["currency"] == "TZS"
    assert body["status"] == "processing"
    assert body["registration_status"] == "pending"
    assert body["provider"] == "snippe"
    assert body["provider_reference"] == "SN-TEST-1"
    assert body["attendee_email"] == "asha@example.org"
    assert [e["to_status"] for e in body["events"]] == ["pending", "processing"]

    sent = gateway.created[0]
    assert sent["amount"] == 118000
    assert sent["phone_number"] == "255712345678"
    assert sent["idempotency_key"] == body["reference"] and len(sent["idempotency_key"]) <= 30
    assert sent["webhook_url"] == "https://api.example.org/api/v1/webhooks/snippe"
    assert sent["metadata"]["payment_id"] == body["id"]


def test_get_payment_verifies_with_provider(client, gateway) -> None:
    payment = client.post("/api/v1/payments/mobile", json=CHECKOUT).json()
    gateway.statuses[payment["provider_reference"]] = "completed"
    gateway.providers[payment["provider_reference"]] = "airtel"

    body = client.get(f"/api/v1/payments/{payment['id']}").json()
    assert body["status"] == "paid"
    assert body["registration_status"] == "confirmed"
    assert body["paid_at"] is not None
    assert body["method"] == "airtel"  # provider-reported channel wins

    # Terminal states never regress, even if the provider later says something else.
    gateway.statuses[payment["provider_reference"]] = "failed"
    assert client.get(f"/api/v1/payments/{payment['id']}").json()["status"] == "paid"


def test_expired_payment_cancels_registration(client, gateway) -> None:
    payment = client.post("/api/v1/payments/mobile", json=CHECKOUT).json()
    gateway.statuses[payment["provider_reference"]] = "expired"
    body = client.get(f"/api/v1/payments/{payment['id']}").json()
    assert body["status"] == "cancelled"
    assert body["registration_status"] == "cancelled"


def test_webhook_confirms_payment_and_ignores_replays(client, db) -> None:
    payment = client.post("/api/v1/payments/mobile", json=CHECKOUT).json()
    event = {
        "id": "evt_abc123",
        "type": "payment.completed",
        "api_version": "2026-01-25",
        "data": {
            "reference": payment["provider_reference"],
            "status": "completed",
            "amount": {"value": 118000, "currency": "TZS"},
            "channel": {"type": "mobile_money", "provider": "mpesa"},
            "metadata": {"payment_id": payment["id"]},
        },
    }
    assert _webhook(client, event).status_code == 200
    assert client.get(f"/api/v1/payments/{payment['id']}").json()["status"] == "paid"

    assert _webhook(client, event).status_code == 200  # redelivery
    events = db.scalars(select(PaymentEvent).where(PaymentEvent.payment_id == uuid.UUID(payment["id"]))).all()
    assert [e.to_status.value for e in events] == ["pending", "processing", "paid"]
    assert db.scalar(select(ProviderWebhookEvent).where(ProviderWebhookEvent.event_id == "evt_abc123")) is not None


def test_webhook_rejects_bad_signature_and_stale_timestamp(client) -> None:
    payload = {"id": "evt_x", "type": "payment.completed", "data": {}}
    assert _webhook(client, payload, secret="wrong").status_code == 401
    assert _webhook(client, payload, ts=int(time.time()) - 3600).status_code == 401
    unsigned = client.post("/api/v1/webhooks/snippe", content=b"{}", headers={"Content-Type": "application/json"})
    assert unsigned.status_code == 401


def test_webhook_requires_secret(client, test_settings) -> None:
    test_settings.snippe_webhook_secret = None
    assert _webhook(client, {"id": "evt_y", "type": "payment.failed", "data": {}}).status_code == 503


def test_admin_endpoints_require_token(client) -> None:
    assert client.get("/api/v1/admin/payments").status_code == 401
    assert client.get("/api/v1/admin/payments", headers={"Authorization": "Bearer nope"}).status_code == 403


def test_admin_sees_platform_and_provider_transactions(client, gateway) -> None:
    headers = {"Authorization": f"Bearer {ADMIN_TOKEN}"}
    client.post("/api/v1/payments/mobile", json=CHECKOUT)

    platform = client.get("/api/v1/admin/payments", headers=headers).json()
    assert platform["total"] == 1
    assert platform["items"][0]["attendee_name"] == "Asha Mwinyi"
    assert platform["items"][0]["event_slug"] == "neurotech-summit-2026"

    filtered = client.get("/api/v1/admin/payments?status=paid", headers=headers).json()
    assert filtered["total"] == 0

    provider = client.get("/api/v1/admin/payments/provider", headers=headers).json()
    assert provider["items"][0]["reference"] == "SN-OTHER-APP"  # made outside this platform, still visible

    balance = client.get("/api/v1/admin/payments/balance", headers=headers).json()
    assert (balance["available"], balance["currency"]) == (350, "TZS")

    payment_id = platform["items"][0]["id"]
    gateway.statuses[platform["items"][0]["provider_reference"]] = "completed"
    verified = client.post(f"/api/v1/admin/payments/{payment_id}/verify", headers=headers).json()
    assert verified["status"] == "paid"


def test_validation_and_conflict_rules(client, db) -> None:
    free = {**CHECKOUT, "event_slug": "research-methods-bootcamp", "ticket_code": "tix_b"}
    assert client.post("/api/v1/payments/mobile", json=free).status_code == 400  # below provider minimum

    inactive = {**CHECKOUT, "ticket_code": "tix_early"}
    assert client.post("/api/v1/payments/mobile", json=inactive).status_code == 409

    assert client.post("/api/v1/payments/mobile", json={**CHECKOUT, "event_slug": "nope"}).status_code == 404
    assert client.post("/api/v1/payments/mobile", json={**CHECKOUT, "ticket_code": "nope"}).status_code == 404

    draft = {**CHECKOUT, "event_slug": "ai-in-healthcare-conference", "ticket_code": "tix_c"}
    assert client.post("/api/v1/payments/mobile", json=draft).status_code == 409

    bad_phone = {**CHECKOUT, "phone_number": "12345"}
    assert client.post("/api/v1/payments/mobile", json=bad_phone).status_code == 422

    vip = db.scalar(select(TicketType).where(TicketType.code == "tix_vip"))
    vip.capacity = 1
    db.commit()
    first = client.post("/api/v1/payments/mobile", json={**CHECKOUT, "ticket_code": "tix_vip"})
    assert first.status_code == 201
    second = client.post(
        "/api/v1/payments/mobile",
        json={**CHECKOUT, "ticket_code": "tix_vip", "attendee": {"full_name": "Juma K", "email": "juma@example.org"}},
    )
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "sold_out"


def test_gateway_rejection_is_recorded_as_failed(client, gateway, db) -> None:
    gateway.fail_create = SnippeError("phone_number must be a valid phone number", status_code=400)
    response = client.post("/api/v1/payments/mobile", json=CHECKOUT)
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "gateway_error"
    payment = db.scalar(select(Payment))
    assert payment.status.value == "failed"
    assert "rejected" in payment.events[-1].note


def test_payments_unavailable_without_gateway(client) -> None:
    from app.api.deps import payment_gateway

    app_overrides = client.app.dependency_overrides
    app_overrides[payment_gateway] = lambda: None
    response = client.post("/api/v1/payments/mobile", json=CHECKOUT)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "payments_unavailable"
