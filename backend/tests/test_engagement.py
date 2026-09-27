"""Attendee agenda, networking, notifications, certificates, and organiser sponsors and communications."""

import uuid
from datetime import date, time

from app.db.models import Attendee, CheckIn, EventSession, Registration, TicketType
from app.db.models.enums import RegistrationStatus
from app.db.seed import seed_id
from tests.helpers import SUMMIT_ID, org_member, signup

FREE_EVENT = "snippe-payments-developer-day"
FREE_EVENT_ID = seed_id("evt_research_bootcamp")
DRAFT_EVENT_ID = seed_id("evt_ai_health")
COMPLETED_EVENT_ID = seed_id("evt_summit_2025")


def register_free(client, headers, email: str, name: str = "Test User") -> dict:
    response = client.post(
        "/api/v1/registrations/free",
        json={"event_slug": FREE_EVENT, "ticket_code": "tix_b", "attendee": {"full_name": name, "email": email}},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def add_session(db, event_id: uuid.UUID, title: str = "Talk") -> uuid.UUID:
    session = EventSession(
        event_id=event_id, title=title, day_index=0, session_date=date(2027, 2, 18), start_time=time(10),
        end_time=time(11),
    )
    db.add(session)
    db.commit()
    return session.id


# ---------------------------------------------------------------------- agenda


def test_attendee_saves_and_removes_sessions(client, db) -> None:
    headers, _ = signup(client, "agenda@example.com")
    session_id = add_session(db, FREE_EVENT_ID)
    assert client.put(f"/api/v1/me/schedule/{session_id}", headers=headers).status_code == 204
    assert client.put(f"/api/v1/me/schedule/{session_id}", headers=headers).status_code == 204  # idempotent
    saved = client.get("/api/v1/me/schedule", headers=headers).json()
    assert [(item["session_id"], item["event_id"]) for item in saved] == [(str(session_id), str(FREE_EVENT_ID))]
    assert client.delete(f"/api/v1/me/schedule/{session_id}", headers=headers).status_code == 204
    assert client.get("/api/v1/me/schedule", headers=headers).json() == []


def test_draft_event_sessions_cannot_be_saved(client, db) -> None:
    headers, _ = signup(client, "agenda-draft@example.com")
    session_id = add_session(db, DRAFT_EVENT_ID)
    assert client.put(f"/api/v1/me/schedule/{session_id}", headers=headers).status_code == 404
    assert client.get("/api/v1/me/schedule").status_code == 401


# ------------------------------------------------------------------ networking


def test_networking_only_shows_visible_people_who_share_an_event(client, db) -> None:
    asha, _ = signup(client, "asha@example.com", "Asha Mwinyi")
    juma, _ = signup(client, "juma@example.com", "Juma Said")
    loner, _ = signup(client, "loner@example.com", "No Events")
    register_free(client, asha, "asha@example.com", "Asha Mwinyi")
    register_free(client, juma, "juma@example.com", "Juma Said")

    profile = {"public_name": "Juma Said", "job_title": "Engineer", "interests": ["AI agents", " "], "bio": "Hi"}
    saved = client.put("/api/v1/me/networking/profile", json=profile, headers=juma)
    assert saved.status_code == 200 and saved.json()["initials"] == "JS" and saved.json()["interests"] == ["AI agents"]
    client.put("/api/v1/me/networking/profile", json={"public_name": "No Events"}, headers=loner)

    people = client.get("/api/v1/me/networking", headers=asha).json()["people"]
    assert [person["public_name"] for person in people] == ["Juma Said"]
    assert "email" not in people[0]
    # Someone with no shared event sees nobody and cannot connect.
    assert client.get("/api/v1/me/networking", headers=loner).json()["people"] == []
    juma_id = people[0]["attendee_id"]
    connections = "/api/v1/me/networking/connections"
    assert client.post(connections, json={"attendee_id": juma_id}, headers=loner).status_code == 404

    assert client.post(connections, json={"attendee_id": juma_id}, headers=asha).status_code == 204
    assert client.get("/api/v1/me/networking", headers=asha).json()["connections"] == [juma_id]
    url = f"/api/v1/me/networking/connections/{juma_id}"
    assert client.delete(url, headers=asha).status_code == 204
    assert client.get("/api/v1/me/networking", headers=asha).json()["connections"] == []

    # Hidden profiles drop out of the directory.
    client.put("/api/v1/me/networking/profile", json={**profile, "is_visible": False}, headers=juma)
    assert client.get("/api/v1/me/networking", headers=asha).json()["people"] == []


# --------------------------------------------------------------- notifications


def test_free_registration_creates_a_notification_that_can_be_read(client, db) -> None:
    headers, _ = signup(client, "notify@example.com")
    register_free(client, headers, "notify@example.com")
    items = client.get("/api/v1/me/notifications", headers=headers).json()
    assert [(item["category"], item["title"], item["is_read"]) for item in items] == [
        ("registration", "Registration confirmed", False)
    ]
    read = client.post(f"/api/v1/me/notifications/{items[0]['id']}/read", headers=headers)
    assert read.status_code == 200 and read.json()["is_read"] is True

    other, _ = signup(client, "notify-other@example.com")
    assert client.post(f"/api/v1/me/notifications/{items[0]['id']}/read", headers=other).status_code == 404
    assert client.post("/api/v1/me/notifications/read-all", headers=headers).json() == {"updated": 0}


# ---------------------------------------------------------------- certificates


def checked_in_at_completed_event(db, email: str) -> None:
    attendee = db.query(Attendee).filter(Attendee.email == email).one()
    ticket = db.query(TicketType).filter(TicketType.code == "tix_past").one()
    registration = Registration(
        event_id=COMPLETED_EVENT_ID, attendee_id=attendee.id, ticket_type_id=ticket.id,
        status=RegistrationStatus.CONFIRMED, ticket_number=f"NTS-{uuid.uuid4().hex[:10].upper()}",
    )
    db.add(registration)
    db.flush()
    db.add(CheckIn(registration_id=registration.id, attendee_id=attendee.id, event_id=COMPLETED_EVENT_ID,
                   ticket_number=registration.ticket_number))
    db.commit()


def test_certificates_are_issued_on_read_and_verifiable_publicly(client, db) -> None:
    headers, _ = signup(client, "cert@example.com", "Neema Cert")
    assert client.get("/api/v1/me/certificates", headers=headers).json() == []
    checked_in_at_completed_event(db, "cert@example.com")

    certificates = client.get("/api/v1/me/certificates", headers=headers).json()
    assert len(certificates) == 1 and certificates[0]["event_id"] == str(COMPLETED_EVENT_ID)
    code = certificates[0]["certificate_code"]
    assert client.get("/api/v1/me/certificates", headers=headers).json()[0]["certificate_code"] == code  # no duplicate

    verified = client.get(f"/api/v1/certificates/{code.lower()}/verify")
    assert verified.status_code == 200
    assert verified.json()["attendee_name"] == "Neema Cert" and "email" not in verified.json()
    assert client.get("/api/v1/certificates/NT-000000000000/verify").status_code == 404
    categories = [item["category"] for item in client.get("/api/v1/me/notifications", headers=headers).json()]
    assert "certificate" in categories


def test_organiser_issues_certificates_for_an_event(client, db) -> None:
    owner = org_member(client, db, "cert-owner@example.com")
    signup(client, "cert-bulk@example.com")
    checked_in_at_completed_event(db, "cert-bulk@example.com")
    url = f"/api/v1/admin/events/{COMPLETED_EVENT_ID}/certificates/issue"
    assert client.post(url, headers=owner).json() == {"issued": 1, "total": 1}
    assert client.post(url, headers=owner).json() == {"issued": 0, "total": 1}
    attendee, _ = signup(client, "cert-attendee@example.com")
    assert client.post(url, headers=attendee).status_code == 404


# -------------------------------------------------------------------- sponsors


def test_sponsor_crud_and_public_listing(client, db) -> None:
    owner = org_member(client, db, "sponsor-owner@example.com")
    body = {"name": "Snippe", "tier": "title", "website": "https://snippe.sh", "contact": "hi@snippe.sh",
            "event_ids": [str(SUMMIT_ID), str(DRAFT_EVENT_ID)]}
    created = client.post("/api/v1/admin/sponsors", json=body, headers=owner)
    assert created.status_code == 201, created.text
    sponsor_id = created.json()["id"]

    public = client.get("/api/v1/catalogue").json()["sponsors"]
    assert [(item["name"], item["event_ids"]) for item in public] == [("Snippe", [str(SUMMIT_ID)])]  # draft hidden
    assert "contact" not in public[0]

    updated = client.patch(f"/api/v1/admin/sponsors/{sponsor_id}", json={"active": False}, headers=owner)
    assert updated.status_code == 200 and updated.json()["tier"] == "title"
    assert client.get("/api/v1/catalogue").json()["sponsors"] == []
    workspace = client.get("/api/v1/admin/workspace", headers=owner).json()
    assert [item["name"] for item in workspace["sponsors"]] == ["Snippe"]

    assert client.delete(f"/api/v1/admin/sponsors/{sponsor_id}", headers=owner).status_code == 204
    assert client.get("/api/v1/admin/sponsors", headers=owner).json() == []


def test_sponsors_require_organizer_and_safe_urls(client, db) -> None:
    attendee, _ = signup(client, "sponsor-attendee@example.com")
    assert client.get("/api/v1/admin/sponsors", headers=attendee).status_code == 403
    owner = org_member(client, db, "sponsor-owner2@example.com")
    bad = client.post("/api/v1/admin/sponsors", json={"name": "Bad", "website": "javascript:alert(1)"}, headers=owner)
    assert bad.status_code == 422


# -------------------------------------------------------------- communications


def test_sending_a_communication_notifies_the_audience_once(client, db) -> None:
    owner = org_member(client, db, "comms-owner@example.com")
    first, _ = signup(client, "comms-a@example.com")
    register_free(client, first, "comms-a@example.com")
    outsider, _ = signup(client, "comms-out@example.com")

    url = f"/api/v1/admin/events/{FREE_EVENT_ID}/communications"
    draft = client.post(url, json={"subject": "Room change", "body": "We moved to Hall B.", "channel": "sms"},
                        headers=owner)
    assert draft.status_code == 201 and draft.json()["status"] == "draft"
    comm_id = draft.json()["id"]
    edited = client.patch(f"/api/v1/admin/communications/{comm_id}", json={"body": "We moved to Hall C."},
                          headers=owner)
    assert edited.json()["body"] == "We moved to Hall C."

    sent = client.post(f"/api/v1/admin/communications/{comm_id}/send", headers=owner)
    assert sent.status_code == 200, sent.text
    assert sent.json()["recipients"] == 1 and sent.json()["status"] == "sent"
    assert sent.json()["external_delivery"].startswith("not_configured")
    assert client.post(f"/api/v1/admin/communications/{comm_id}/send", headers=owner).status_code == 409
    assert client.delete(f"/api/v1/admin/communications/{comm_id}", headers=owner).status_code == 409

    titles = [item["title"] for item in client.get("/api/v1/me/notifications", headers=first).json()]
    assert titles.count("Room change") == 1
    assert client.get("/api/v1/me/notifications", headers=outsider).json() == []
    assert [item["id"] for item in client.get(url, headers=owner).json()] == [comm_id]
    assert client.get(url, headers=outsider).status_code == 404
