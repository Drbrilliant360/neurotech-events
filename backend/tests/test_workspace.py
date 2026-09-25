from sqlalchemy import select

from app.db.models import Event, TicketType
from app.db.models.enums import OrganizationRole
from app.db.seed import seed_id
from tests.helpers import ORGANIZATION_ID, SUMMIT_ID, event_staff, org_member, signup
from tests.test_payments_api import CHECKOUT, _webhook


def test_public_catalogue_hydrates_the_site_in_one_request(client) -> None:
    response = client.get("/api/v1/catalogue")
    assert response.status_code == 200 and "max-age" in response.headers["cache-control"]
    body = response.json()
    assert body["organization"]["vat_percent"] == "18.00"
    slugs = [event["slug"] for event in body["events"]]
    assert "neurotech-summit-2026" in slugs and "ai-in-healthcare-conference" not in slugs  # draft hidden
    summit = next(event for event in body["events"] if event["slug"] == "neurotech-summit-2026")
    assert summit["ticket_types"] and summit["organization_id"] == str(ORGANIZATION_ID)
    assert body["venues"]


def test_me_reports_organizer_and_attendee_link(client, db) -> None:
    attendee, _ = signup(client, "plain@example.org")
    me = client.get("/api/v1/me", headers=attendee).json()
    assert me["organizer"] is False and me["attendee_id"]
    owner = org_member(client, db, "owner@example.org")
    assert client.get("/api/v1/me", headers=owner).json()["organizer"] is True


def test_workspace_filters_sensitive_rows_by_capability(client, db) -> None:
    payment = client.post("/api/v1/payments/mobile", json=CHECKOUT).json()
    _webhook(client, {"id": "evt_ws_1", "type": "payment.completed",
                      "data": {"reference": payment["provider_reference"], "status": "completed"}})

    owner = org_member(client, db, "owner@example.org")
    full = client.get("/api/v1/admin/workspace", headers=owner).json()
    assert len(full["events"]) == 7  # includes the draft
    assert len(full["registrations"]) == 1 and len(full["payments"]) == 1
    assert full["organizations"][0]["id"] == str(ORGANIZATION_ID)

    door = event_staff(client, db, "door@example.org", "check_in")
    limited = client.get("/api/v1/admin/workspace", headers=door).json()
    assert [event["id"] for event in limited["events"]] == [str(SUMMIT_ID)]
    assert limited["registrations"] == [] and limited["payments"] == []
    access = limited["access"][0]
    assert access["can_check_in"] is True and access["can_manage_event"] is False

    attendee, _ = signup(client, "plain@example.org")
    empty = client.get("/api/v1/admin/workspace", headers=attendee).json()
    assert empty["events"] == [] and empty["registrations"] == []


def test_free_registration_confirms_without_payment(client, db) -> None:
    ticket = db.scalar(select(TicketType).where(TicketType.code == "tix_b"))
    body = {"event_slug": "research-methods-bootcamp", "ticket_code": "tix_b",
            "attendee": {"full_name": "Neema Free", "email": "free@example.org"}}
    response = client.post("/api/v1/registrations/free", json=body)
    assert response.status_code == 201, response.text
    assert response.json()["status"] == "confirmed" and response.json()["ticket_type_id"] == str(ticket.id)

    paid = client.post("/api/v1/registrations/free", json={**body, "event_slug": CHECKOUT["event_slug"],
                                                             "ticket_code": CHECKOUT["ticket_code"]})
    assert paid.status_code == 409 and paid.json()["error"]["code"] == "payment_required"


def test_attendee_registrations_include_payment_details(client) -> None:
    account = client.post(
        "/api/v1/auth/register",
        json={"email": CHECKOUT["attendee"]["email"], "password": "password123", "full_name": "Asha Mwinyi"},
    ).json()
    headers = {"Authorization": f"Bearer {account['access_token']}"}
    payment = client.post("/api/v1/payments/mobile", json=CHECKOUT, headers=headers).json()
    _webhook(client, {"id": "evt_ws_2", "type": "payment.completed",
                      "data": {"reference": payment["provider_reference"], "status": "completed"}})
    registration = client.get("/api/v1/attendee/registrations", headers=headers).json()[0]
    assert registration["payment_status"] == "paid" and registration["amount_paid"] == 118000
    assert registration["ticket_code"] == CHECKOUT["ticket_code"] and registration["payment_id"] == payment["id"]


def test_organization_settings_update_requires_owner(client, db) -> None:
    owner = org_member(client, db, "owner@example.org")
    finance = org_member(client, db, "finance@example.org", OrganizationRole.FINANCE)
    url = f"/api/v1/admin/organizations/{ORGANIZATION_ID}"
    assert client.patch(url, json={"vat_percent": "16"}, headers=finance).status_code == 403
    updated = client.patch(url, json={"vat_percent": "16", "contact_phone": "+255 700 000 000"}, headers=owner)
    assert updated.status_code == 200 and updated.json()["vat_percent"] == "16.00"
    quote = client.get(f"/api/v1/events/{CHECKOUT['event_slug']}/tickets/{CHECKOUT['ticket_code']}/quote").json()
    assert quote["total"] == 116000


def test_duplicate_event_copies_tickets_as_draft(client, db) -> None:
    owner = org_member(client, db, "owner@example.org")
    response = client.post(f"/api/v1/admin/events/{SUMMIT_ID}/duplicate", headers=owner)
    assert response.status_code == 201
    copy = response.json()
    assert copy["status"] == "draft" and copy["slug"] == "neurotech-summit-2026-copy"
    tickets = client.get(f"/api/v1/admin/events/{copy['id']}/ticket-types", headers=owner).json()
    assert len(tickets) == len(db.scalars(select(TicketType).where(TicketType.event_id == SUMMIT_ID)).all())
    again = client.post(f"/api/v1/admin/events/{SUMMIT_ID}/duplicate", headers=owner).json()
    assert again["slug"] == "neurotech-summit-2026-copy-2"
    assert db.get(Event, seed_id("evt_summit_2026")) is not None


def test_catalogue_cache_is_dropped_when_the_programme_changes(client, db) -> None:
    owner = org_member(client, db, "owner@example.org")
    before = [event["slug"] for event in client.get("/api/v1/catalogue").json()["events"]]
    created = client.post(
        "/api/v1/admin/events",
        json={"slug": "cache-check", "title": "Cache Check", "starts_at": "2027-01-10T09:00:00+03:00",
              "ends_at": "2027-01-10T17:00:00+03:00"},
        headers=owner,
    ).json()
    client.post(f"/api/v1/admin/events/{created['id']}/status", json={"status": "published"}, headers=owner)
    after = [event["slug"] for event in client.get("/api/v1/catalogue").json()["events"]]
    assert "cache-check" not in before and "cache-check" in after
