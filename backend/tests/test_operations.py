import csv
import io
import uuid

from app.core.signing import sign_ticket, verify_ticket
from app.db.models import TicketType
from app.db.models.enums import OrganizationRole
from app.db.seed import seed_id
from tests.helpers import SUMMIT_ID, event_staff, org_member, signup
from tests.test_payments_api import CHECKOUT, _webhook

BASE = f"/api/v1/admin/events/{SUMMIT_ID}"
SECRET = "unsafe-development-secret-change-me-32"
PRO_TICKET = seed_id("tix_pro")


def _comp(client, headers, email="guest@example.org", name="Guest Speaker", ticket=PRO_TICKET) -> dict:
    response = client.post(
        f"{BASE}/registrations",
        json={"attendee": {"full_name": name, "email": email}, "ticket_type_id": str(ticket), "note": "Speaker"},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _paid_registration(client) -> dict:
    payment = client.post("/api/v1/payments/mobile", json=CHECKOUT).json()
    _webhook(client, {"id": f"evt_{uuid.uuid4().hex}", "type": "payment.completed",
                      "data": {"reference": payment["provider_reference"], "status": "completed"}})
    return payment


def test_complimentary_registration_is_confirmed_and_listed(client, db) -> None:
    owner = org_member(client, db, "owner@example.org")
    registration = _comp(client, owner)
    assert registration["status"] == "confirmed" and registration["amount_paid"] == 0

    listing = client.get(f"{BASE}/registrations", params={"q": "guest speaker"}, headers=owner).json()
    assert listing["total"] == 1 and listing["items"][0]["id"] == registration["id"]
    by_number = client.get(f"{BASE}/registrations", params={"q": registration["ticket_number"]}, headers=owner)
    assert by_number.json()["total"] == 1


def test_complimentary_registration_respects_capacity(client, db) -> None:
    owner = org_member(client, db, "owner@example.org")
    ticket = db.get(TicketType, PRO_TICKET)
    ticket.capacity = 1
    db.commit()
    _comp(client, owner)
    response = client.post(
        f"{BASE}/registrations",
        json={"attendee": {"full_name": "Second Guest", "email": "g2@example.org"}, "ticket_type_id": str(PRO_TICKET)},
        headers=owner,
    )
    assert response.status_code == 409


def test_qr_check_in_admits_once_and_undo_reopens(client, db) -> None:
    owner = org_member(client, db, "owner@example.org")
    door = event_staff(client, db, "door@example.org", "check_in")
    registration = _comp(client, owner)
    qr = sign_ticket(SECRET, uuid.UUID(registration["id"]))

    admitted = client.post(f"{BASE}/check-ins", json={"code": qr}, headers=door)
    assert admitted.status_code == 201, admitted.text
    assert admitted.json()["attendee_name"] == "Guest Speaker"
    again = client.post(f"{BASE}/check-ins", json={"code": registration["ticket_number"]}, headers=door)
    assert again.status_code == 409 and again.json()["error"]["code"] == "already_checked_in"

    undo = client.post(f"{BASE}/check-ins/{admitted.json()['id']}/undo", headers=door)
    assert undo.status_code == 200 and undo.json()["undone"] is True
    readmitted = client.post(f"{BASE}/check-ins", json={"code": registration["ticket_number"]}, headers=door)
    assert readmitted.status_code == 201
    assert client.get(f"{BASE}/check-ins", headers=door).json()["total"] == 2


def test_forged_or_foreign_tickets_are_rejected(client, db) -> None:
    owner = org_member(client, db, "owner@example.org")
    door = event_staff(client, db, "door@example.org", "check_in")
    registration = _comp(client, owner)
    forged = f"NTQ1.{uuid.UUID(registration['id']).hex}.AAAAAAAAAAAAAAAAAAAAAAAA"
    response = client.post(f"{BASE}/check-ins", json={"code": forged}, headers=door)
    assert response.status_code == 400 and response.json()["error"]["code"] == "invalid_ticket"
    assert client.post(f"{BASE}/check-ins", json={"code": "NTS-0000000000"}, headers=door).status_code == 404

    # A genuine ticket for another event is refused at this event's door.
    other_event = seed_id("evt_bci_workshop")
    other = client.post(
        f"/api/v1/admin/events/{other_event}/registrations",
        json={"attendee": {"full_name": "Other", "email": "o@example.org"}, "ticket_type_id": str(seed_id("tix_w"))},
        headers=owner,
    )
    assert other.status_code == 201, other.text
    qr = sign_ticket(SECRET, uuid.UUID(other.json()["id"]))
    wrong = client.post(f"{BASE}/check-ins", json={"code": qr}, headers=door)
    assert wrong.status_code == 409 and wrong.json()["error"]["code"] == "wrong_event"


def test_unpaid_registration_cannot_check_in(client, db) -> None:
    door = event_staff(client, db, "door@example.org", "check_in")
    pending = client.post("/api/v1/payments/mobile", json=CHECKOUT).json()
    response = client.post(f"{BASE}/check-ins", json={"code": pending["ticket_number"]}, headers=door)
    assert response.status_code == 409 and response.json()["error"]["code"] == "not_confirmed"


def test_door_staff_get_minimal_lookup_but_not_attendee_list(client, db) -> None:
    owner = org_member(client, db, "owner@example.org")
    door = event_staff(client, db, "door@example.org", "staff")
    _comp(client, owner)
    lookup = client.get(f"{BASE}/check-ins/lookup", params={"q": "guest"}, headers=door)
    assert lookup.status_code == 200 and lookup.json()[0]["attendee_name"] == "Guest Speaker"
    assert "attendee_email" not in lookup.json()[0]
    assert client.get(f"{BASE}/registrations", headers=door).status_code == 403
    assert client.get(f"{BASE}/registrations.csv", headers=door).status_code == 403


def test_outsiders_cannot_check_in(client, db) -> None:
    attendee, _ = signup(client, "outsider@example.org")
    assert client.post(f"{BASE}/check-ins", json={"code": "NTS-0000000000"}, headers=attendee).status_code == 404


def test_csv_export_neutralises_formulas(client, db) -> None:
    owner = org_member(client, db, "owner@example.org")
    _comp(client, owner, email="evil@example.org", name="=HYPERLINK(\"http://x\")")
    response = client.get(f"{BASE}/registrations.csv", headers=owner)
    assert response.status_code == 200 and response.headers["content-type"].startswith("text/csv")
    rows = list(csv.reader(io.StringIO(response.text)))
    assert rows[0][0] == "ticket_number"
    assert rows[1][2].startswith("'=")


def test_admin_cancel_of_paid_registration_flags_refund(client, db) -> None:
    owner = org_member(client, db, "owner@example.org")
    payment = _paid_registration(client)
    response = client.post(
        f"{BASE}/registrations/{payment['registration_id']}/cancel", json={"reason": "Duplicate booking"}, headers=owner
    )
    assert response.status_code == 200
    body = response.json()
    assert body["refund_required"] is True and body["registration"]["status"] == "cancelled"


def test_summary_hides_revenue_without_finance_access(client, db) -> None:
    owner = org_member(client, db, "owner@example.org")
    _paid_registration(client)
    _comp(client, owner)
    summary = client.get(f"{BASE}/summary", headers=owner).json()
    assert summary["confirmed"] == 2 and summary["revenue"] == 118000

    door = event_staff(client, db, "door@example.org", "check_in")
    limited = client.get(f"{BASE}/summary", headers=door).json()
    assert limited["confirmed"] == 2 and limited["revenue"] is None
    assert all(item["revenue"] is None for item in limited["ticket_types"])


def test_event_payments_require_finance_access(client, db) -> None:
    _paid_registration(client)
    finance = org_member(client, db, "finance@example.org", OrganizationRole.FINANCE)
    manager = event_staff(client, db, "manager@example.org", "manager")
    assert client.get(f"{BASE}/payments", headers=finance).json()["total"] == 1
    assert client.get(f"{BASE}/payments", headers=manager).status_code == 403


def test_attendee_ticket_carries_verifiable_qr(client, test_settings) -> None:
    account = client.post(
        "/api/v1/auth/register",
        json={"email": CHECKOUT["attendee"]["email"], "password": "password123", "full_name": "Asha Mwinyi"},
    ).json()
    headers = {"Authorization": f"Bearer {account['access_token']}"}
    payment = client.post("/api/v1/payments/mobile", json=CHECKOUT, headers=headers).json()
    url = f"/api/v1/attendee/registrations/{payment['registration_id']}/ticket"
    assert client.get(url, headers=headers).status_code == 409  # not paid yet

    _webhook(client, {"id": "evt_ticket_1", "type": "payment.completed",
                      "data": {"reference": payment["provider_reference"], "status": "completed"}})
    ticket = client.get(url, headers=headers).json()
    assert verify_ticket(test_settings.jwt_secret_key, ticket["qr_payload"]) == uuid.UUID(payment["registration_id"])


def test_audit_trail_records_event_operations(client, db) -> None:
    owner = org_member(client, db, "owner@example.org")
    _comp(client, owner)
    audit = client.get(f"{BASE}/audit", headers=owner).json()
    assert "registration.complimentary" in [item["action"] for item in audit["items"]]


def test_signing_rejects_tampering() -> None:
    registration_id = uuid.uuid4()
    token = sign_ticket("secret-a" * 4, registration_id)
    assert verify_ticket("secret-a" * 4, token) == registration_id
    assert verify_ticket("secret-b" * 4, token) is None
    assert verify_ticket("secret-a" * 4, token.replace(registration_id.hex, uuid.uuid4().hex)) is None
    assert verify_ticket("secret-a" * 4, "garbage") is None
