import json
import time
import uuid

from app.db.models.enums import OrganizationRole
from app.integrations.payments.snippe import SnippeError, compute_webhook_signature
from tests.helpers import SUMMIT_ID, event_staff, org_member
from tests.test_payments_api import CHECKOUT, _webhook

BASE = f"/api/v1/admin/events/{SUMMIT_ID}"


def paid_and_cancelled(client, owner):
    payment = client.post("/api/v1/payments/mobile", json=CHECKOUT).json()
    _webhook(client, {"id": f"evt_{uuid.uuid4().hex}", "type": "payment.completed",
                      "data": {"reference": payment["provider_reference"], "status": "completed"}})
    cancelled = client.post(f"{BASE}/registrations/{payment['registration_id']}/cancel",
                            json={"reason": "Duplicate booking"}, headers=owner)
    assert cancelled.status_code == 200
    return payment


def payout_webhook(client, payload, secret="whsec_test_secret"):
    raw = json.dumps(payload, separators=(",", ":")).encode()
    timestamp = str(int(time.time()))
    return client.post("/api/v1/webhooks/snippe", content=raw, headers={
        "content-type": "application/json", "x-webhook-timestamp": timestamp,
        "x-webhook-signature": compute_webhook_signature(secret, timestamp, raw),
    })


def test_finance_can_request_idempotent_refund_and_completion_marks_payment(client, db, gateway):
    owner = org_member(client, db, "owner@example.org")
    payment = paid_and_cancelled(client, owner)
    url = f"{BASE}/payments/{payment['id']}/refund"
    first = client.post(url, json={"reason": "Duplicate booking"}, headers=owner)
    assert first.status_code == 201, first.text
    assert first.json()["status"] == "pending"
    assert len(gateway.payouts) == 1
    sent = gateway.payouts[0]
    assert sent["amount"] == 118000 and sent["recipient_phone"] == "255712345678"
    assert sent["metadata"]["payment_id"] == payment["id"]

    second = client.post(url, json={"reason": "Retry"}, headers=owner)
    assert second.status_code == 201 and second.json()["id"] == first.json()["id"]
    assert len(gateway.payouts) == 1

    event = {"id": "evt_payout_done", "type": "payout.completed", "data": {
        "reference": first.json()["provider_reference"], "status": "completed",
        "amount": {"value": 118000, "currency": "TZS"},
    }}
    assert payout_webhook(client, event).status_code == 200
    assert payout_webhook(client, event).status_code == 200
    status = client.get(url, headers=owner).json()
    assert status["status"] == "completed"
    listed = client.get(f"{BASE}/payments", headers=owner).json()["items"][0]
    assert listed["status"] == "refunded"


def test_refund_requires_finance_cancelled_registration_and_paid_payment(client, db):
    owner = org_member(client, db, "owner@example.org")
    manager = event_staff(client, db, "manager@example.org", "manager")
    payment = client.post("/api/v1/payments/mobile", json=CHECKOUT).json()
    _webhook(client, {"id": "evt_paid_refund_auth", "type": "payment.completed",
                      "data": {"reference": payment["provider_reference"], "status": "completed"}})
    url = f"{BASE}/payments/{payment['id']}/refund"
    assert client.post(url, json={"reason": "Requested"}, headers=manager).status_code == 403
    assert client.post(url, json={"reason": "Requested"}, headers=owner).status_code == 409


def test_refund_polling_recovers_completion_and_reversal_reopens_payment(client, db, gateway):
    owner = org_member(client, db, "owner@example.org")
    finance = org_member(client, db, "finance@example.org", OrganizationRole.FINANCE)
    payment = paid_and_cancelled(client, owner)
    url = f"{BASE}/payments/{payment['id']}/refund"
    refund = client.post(url, json={"reason": "Event cancellation"}, headers=finance).json()
    gateway.payout_statuses[refund["provider_reference"]] = "completed"
    assert client.get(url, headers=finance).json()["status"] == "completed"

    reversed_event = {"id": "evt_payout_reversed", "type": "payout.reversed", "data": {
        "reference": refund["provider_reference"], "status": "reversed",
        "amount": {"value": 118000, "currency": "TZS"},
    }}
    assert payout_webhook(client, reversed_event).status_code == 200
    assert client.get(f"{BASE}/payments", headers=finance).json()["items"][0]["status"] == "paid"


def test_provider_failure_is_sanitized_and_does_not_refund_payment(client, db, gateway):
    owner = org_member(client, db, "owner@example.org")
    payment = paid_and_cancelled(client, owner)
    gateway.fail_payout = SnippeError("secret provider detail", status_code=500, error_code="internal")
    response = client.post(f"{BASE}/payments/{payment['id']}/refund",
                           json={"reason": "Duplicate booking"}, headers=owner)
    assert response.status_code == 502
    assert "secret provider detail" not in response.text
    listed = client.get(f"{BASE}/payments", headers=owner).json()["items"][0]
    assert listed["status"] == "paid"
