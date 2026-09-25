from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.db.models import Event, Registration, TicketType
from app.integrations.payments.snippe import SnippeError
from tests.test_payments_api import CHECKOUT, _webhook

OTHER_BUYER = {"full_name": "Juma Kassim", "email": "juma@example.org"}


def _single_seat(db) -> TicketType:
    ticket = db.scalar(select(TicketType).where(TicketType.code == CHECKOUT["ticket_code"]))
    ticket.capacity = 1
    db.commit()
    return ticket


def test_abandoned_checkout_releases_its_seat_after_the_hold_window(client, db) -> None:
    _single_seat(db)
    assert client.post("/api/v1/payments/mobile", json=CHECKOUT).status_code == 201
    blocked = client.post("/api/v1/payments/mobile", json={**CHECKOUT, "attendee": OTHER_BUYER})
    assert blocked.json()["error"]["code"] == "sold_out"

    for registration in db.scalars(select(Registration)):
        registration.created_at = datetime.now(UTC) - timedelta(hours=2)
    db.commit()
    assert client.post("/api/v1/payments/mobile", json={**CHECKOUT, "attendee": OTHER_BUYER}).status_code == 201


def test_provider_rejection_frees_the_seat(client, db, gateway) -> None:
    _single_seat(db)
    gateway.fail_create = SnippeError("provider down", status_code=503)
    assert client.post("/api/v1/payments/mobile", json=CHECKOUT).status_code == 502
    gateway.fail_create = None
    response = client.post("/api/v1/payments/mobile", json={**CHECKOUT, "attendee": OTHER_BUYER})
    assert response.status_code == 201, response.text


def test_event_capacity_is_enforced_across_ticket_types(client, db) -> None:
    event = db.scalar(select(Event).where(Event.slug == CHECKOUT["event_slug"]))
    event.capacity = 1
    db.commit()
    assert client.post("/api/v1/payments/mobile", json=CHECKOUT).status_code == 201
    other_ticket = {**CHECKOUT, "ticket_code": "tix_student", "attendee": OTHER_BUYER}
    assert client.post("/api/v1/payments/mobile", json=other_ticket).json()["error"]["code"] == "sold_out"


def test_registration_and_sales_windows_are_enforced(client, db) -> None:
    event = db.scalar(select(Event).where(Event.slug == CHECKOUT["event_slug"]))
    event.registration_closes_at = datetime.now(UTC) - timedelta(days=1)
    db.commit()
    closed = client.post("/api/v1/payments/mobile", json=CHECKOUT)
    assert closed.status_code == 409 and "closed" in closed.json()["error"]["message"]

    event.registration_closes_at = None
    ticket = db.scalar(select(TicketType).where(TicketType.code == CHECKOUT["ticket_code"]))
    ticket.sales_start_at = datetime.now(UTC) + timedelta(days=1)
    db.commit()
    early = client.post("/api/v1/payments/mobile", json=CHECKOUT)
    assert early.status_code == 409 and "not started" in early.json()["error"]["message"]
    quote = client.get(f"/api/v1/events/{CHECKOUT['event_slug']}/tickets/{CHECKOUT['ticket_code']}/quote").json()
    assert quote["payable_online"] is False


def test_payment_collected_after_attendee_cancellation_is_honoured(client, gateway) -> None:
    account = client.post(
        "/api/v1/auth/register",
        json={"email": CHECKOUT["attendee"]["email"], "password": "password123", "full_name": "Asha Mwinyi"},
    ).json()
    headers = {"Authorization": f"Bearer {account['access_token']}"}
    payment = client.post("/api/v1/payments/mobile", json=CHECKOUT, headers=headers).json()
    client.delete(f"/api/v1/attendee/registrations/{payment['registration_id']}", headers=headers)

    response = _webhook(
        client,
        {"id": "evt_late_1", "type": "payment.completed",
         "data": {"reference": payment["provider_reference"], "status": "completed"}},
    )
    assert response.status_code == 200
    body = client.get(f"/api/v1/payments/{payment['id']}").json()
    assert body["status"] == "paid"
    assert body["registration_status"] == "confirmed"
    assert "after local cancellation" in body["events"][-1]["note"]


def test_client_polling_is_throttled_before_reaching_the_provider(client, gateway, monkeypatch) -> None:
    payment = client.post("/api/v1/payments/mobile", json=CHECKOUT).json()
    calls: list[str] = []
    original = gateway.get_payment

    def counting(reference: str):
        calls.append(reference)
        return original(reference)

    monkeypatch.setattr(gateway, "get_payment", counting)
    for _ in range(5):
        assert client.get(f"/api/v1/payments/{payment['id']}").status_code == 200
    assert len(calls) == 1


def test_ticket_numbers_have_forty_bits_of_entropy(client) -> None:
    ticket_number = client.post("/api/v1/payments/mobile", json=CHECKOUT).json()["ticket_number"]
    assert ticket_number.startswith("NTS-") and len(ticket_number) == 14
