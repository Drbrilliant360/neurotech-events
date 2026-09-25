from app.db.models.enums import OrganizationRole
from tests.helpers import ORGANIZATION_ID, SUMMIT_ID, event_staff, org_member, signup

NEW_EVENT = {
    "slug": "neuro-ethics-forum",
    "title": "Neuro Ethics Forum",
    "category": "Forum",
    "format": "hybrid",
    "starts_at": "2027-03-10T09:00:00+03:00",
    "ends_at": "2027-03-11T17:00:00+03:00",
    "capacity": 150,
    "registration_closes_at": "2027-03-09T23:59:00+03:00",
    "highlights": ["Ethics", "Policy"],
}


def _create(client, headers, **overrides) -> dict:
    response = client.post("/api/v1/admin/events", json={**NEW_EVENT, **overrides}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_owner_creates_draft_event_and_publishes_it(client, db) -> None:
    owner = org_member(client, db, "owner@example.org")
    event = _create(client, owner)
    assert event["status"] == "draft"
    assert event["organization_id"] == str(ORGANIZATION_ID)

    # Drafts are invisible publicly until published.
    assert client.get(f"/api/v1/events/{event['slug']}").status_code == 404
    published = client.post(f"/api/v1/admin/events/{event['id']}/status", json={"status": "published"}, headers=owner)
    assert published.status_code == 200 and published.json()["status"] == "published"
    assert client.get(f"/api/v1/events/{event['slug']}").status_code == 200


def test_event_creation_requires_organization_manager(client, db) -> None:
    attendee, _ = signup(client, "plain@example.org")
    assert client.post("/api/v1/admin/events", json=NEW_EVENT, headers=attendee).status_code == 400  # no org
    finance = org_member(client, db, "finance@example.org", OrganizationRole.FINANCE)
    response = client.post(
        "/api/v1/admin/events", json={**NEW_EVENT, "organization_id": str(ORGANIZATION_ID)}, headers=finance
    )
    assert response.status_code == 403
    assert client.post("/api/v1/admin/events", json=NEW_EVENT).status_code == 401


def test_event_validation_rules(client, db) -> None:
    owner = org_member(client, db, "owner@example.org")
    bad = [
        {"slug": "Not A Slug"},
        {"ends_at": "2027-03-09T09:00:00+03:00"},
        {"starts_at": "2027-03-10T09:00:00"},  # no timezone
        {"registration_closes_at": "2027-04-01T00:00:00+03:00"},  # after event end
    ]
    for override in bad:
        response = client.post("/api/v1/admin/events", json={**NEW_EVENT, **override}, headers=owner)
        assert response.status_code == 422, override
    _create(client, owner)
    duplicate = client.post("/api/v1/admin/events", json=NEW_EVENT, headers=owner)
    assert duplicate.status_code == 409 and duplicate.json()["error"]["code"] == "slug_in_use"


def test_status_transitions_are_enforced(client, db) -> None:
    owner = org_member(client, db, "owner@example.org")
    event = _create(client, owner)
    url = f"/api/v1/admin/events/{event['id']}/status"
    assert client.post(url, json={"status": "completed"}, headers=owner).status_code == 409
    assert client.post(url, json={"status": "cancelled"}, headers=owner).status_code == 200
    reopened = client.post(url, json={"status": "published"}, headers=owner)
    assert reopened.status_code == 409 and reopened.json()["error"]["code"] == "invalid_transition"


def test_slug_is_frozen_after_publishing(client, db) -> None:
    owner = org_member(client, db, "owner@example.org")
    event = _create(client, owner)
    url = f"/api/v1/admin/events/{event['id']}"
    assert client.patch(url, json={"slug": "renamed-forum"}, headers=owner).json()["slug"] == "renamed-forum"
    client.post(f"{url}/status", json={"status": "published"}, headers=owner)
    assert client.patch(url, json={"slug": "another-name"}, headers=owner).status_code == 409
    assert client.patch(url, json={"title": "Neuro Ethics Forum 2027"}, headers=owner).status_code == 200
    assert client.patch(url, json={"title": None}, headers=owner).status_code == 400


def test_event_manager_scope_is_limited_to_assigned_event(client, db) -> None:
    owner = org_member(client, db, "owner@example.org")
    other = _create(client, owner)
    manager = event_staff(client, db, "manager@example.org", "manager")

    listing = client.get("/api/v1/admin/events", headers=manager).json()
    assert [item["id"] for item in listing["items"]] == [str(SUMMIT_ID)]
    edit = client.patch(f"/api/v1/admin/events/{SUMMIT_ID}", json={"capacity": 1300}, headers=manager)
    assert edit.status_code == 200
    # Unrelated events are reported as missing rather than forbidden.
    assert client.get(f"/api/v1/admin/events/{other['id']}", headers=manager).status_code == 404


def test_check_in_staff_can_view_but_not_edit(client, db) -> None:
    staff = event_staff(client, db, "door@example.org", "check_in")
    assert client.get(f"/api/v1/admin/events/{SUMMIT_ID}", headers=staff).status_code == 200
    response = client.patch(f"/api/v1/admin/events/{SUMMIT_ID}", json={"capacity": 1}, headers=staff)
    assert response.status_code == 403


def test_ticket_type_lifecycle(client, db) -> None:
    owner = org_member(client, db, "owner@example.org")
    event = _create(client, owner)
    url = f"/api/v1/admin/events/{event['id']}/ticket-types"
    created = client.post(url, json={"name": "Standard", "tier": "standard", "price": 30000, "capacity": 100},
                          headers=owner)
    assert created.status_code == 201, created.text
    ticket = created.json()
    assert ticket["currency"] == "TZS" and ticket["code"].startswith("tt_") and ticket["available"] == 100

    patched = client.patch(f"{url}/{ticket['id']}", json={"price": 35000, "active": False}, headers=owner)
    assert patched.json()["price"] == 35000 and patched.json()["active"] is False
    dup = client.post(url, json={"code": ticket["code"], "name": "Dup", "tier": "x", "price": 1, "capacity": 1},
                      headers=owner)
    assert dup.status_code == 409
    assert client.delete(f"{url}/{ticket['id']}", headers=owner).status_code == 204


def test_ticket_capacity_cannot_drop_below_seats_taken(client, db) -> None:
    from tests.test_payments_api import CHECKOUT

    owner = org_member(client, db, "owner@example.org")
    assert client.post("/api/v1/payments/mobile", json=CHECKOUT).status_code == 201
    tickets = client.get(f"/api/v1/admin/events/{SUMMIT_ID}/ticket-types", headers=owner).json()
    pro = next(item for item in tickets if item["code"] == CHECKOUT["ticket_code"])
    assert pro["sold"] == 1
    url = f"/api/v1/admin/events/{SUMMIT_ID}/ticket-types/{pro['id']}"
    assert client.patch(url, json={"capacity": 0}, headers=owner).status_code == 409
    assert client.delete(url, headers=owner).status_code == 409


def test_program_management_and_public_program(client, db) -> None:
    owner = org_member(client, db, "owner@example.org")
    speaker = client.post(
        "/api/v1/admin/speakers",
        json={"name": "Dr Neema Said", "role": "Neuroscientist", "social_url": "https://example.org/neema"},
        headers=owner,
    )
    assert speaker.status_code == 201 and speaker.json()["initials"] == "DN"
    unsafe = client.post("/api/v1/admin/speakers", json={"name": "Bad", "social_url": "javascript:alert(1)"},
                         headers=owner)
    assert unsafe.status_code == 422

    url = f"/api/v1/admin/events/{SUMMIT_ID}/sessions"
    session = {
        "title": "Opening keynote", "session_date": "2026-11-20", "start_time": "09:00", "end_time": "10:00",
        "session_type": "keynote", "room": "Main hall", "speaker_id": speaker.json()["id"],
    }
    created = client.post(url, json=session, headers=owner)
    assert created.status_code == 201, created.text
    assert created.json()["speaker"]["name"] == "Dr Neema Said" and created.json()["day_index"] == 0
    assert client.post(url, json={**session, "session_date": "2027-06-01"}, headers=owner).status_code == 400
    assert client.post(url, json={**session, "end_time": "08:00"}, headers=owner).status_code == 422

    milestone = client.post(
        f"/api/v1/admin/events/{SUMMIT_ID}/milestones",
        json={"title": "Call for papers closes", "milestone_date": "2026-10-01"}, headers=owner,
    )
    assert milestone.status_code == 201

    program = client.get("/api/v1/events/neurotech-summit-2026/program")
    assert program.status_code == 200 and "max-age" in program.headers["cache-control"]
    assert program.json()["sessions"][0]["title"] == "Opening keynote"
    assert program.json()["milestones"][0]["title"] == "Call for papers closes"
    speakers = client.get("/api/v1/events/neurotech-summit-2026/speakers").json()
    assert [item["name"] for item in speakers] == ["Dr Neema Said"]


def test_directory_requires_organizer(client, db) -> None:
    attendee, _ = signup(client, "plain@example.org")
    assert client.get("/api/v1/admin/speakers", headers=attendee).status_code == 403
    assert client.post("/api/v1/admin/venues", json={"name": "Hall"}, headers=attendee).status_code == 403
    owner = org_member(client, db, "owner@example.org")
    venue = client.post("/api/v1/admin/venues", json={"name": "Kilimanjaro Hall", "city": "Moshi"}, headers=owner)
    assert venue.status_code == 201
    assert client.post("/api/v1/admin/venues", json={"name": "kilimanjaro hall"}, headers=owner).status_code == 409


def test_draft_event_can_be_deleted_but_not_one_with_registrations(client, db) -> None:
    owner = org_member(client, db, "owner@example.org")
    event = _create(client, owner)
    assert client.delete(f"/api/v1/admin/events/{event['id']}", headers=owner).status_code == 204
    assert client.delete(f"/api/v1/admin/events/{SUMMIT_ID}", headers=owner).status_code == 409


def test_public_event_list_filters(client) -> None:
    featured = client.get("/api/v1/events", params={"featured": True}).json()
    assert [item["slug"] for item in featured] == ["neurotech-summit-2026"]
    assert client.get("/api/v1/events", params={"q": "bci"}).json()[0]["slug"] == "bci-hands-on-workshop"
    assert len(client.get("/api/v1/events", params={"limit": 1}).json()) == 1


def test_shared_directory_records_are_protected_across_organizations(client, db) -> None:
    import uuid

    from app.db.models import EventSession, Organization, Speaker
    from app.db.seed import seed_id

    owner = org_member(client, db, "owner@example.org")
    speaker = client.post("/api/v1/admin/speakers", json={"name": "Shared Speaker"}, headers=owner).json()
    client.post(
        f"/api/v1/admin/events/{SUMMIT_ID}/sessions",
        json={"title": "Talk", "session_date": "2026-11-20", "start_time": "09:00", "end_time": "10:00",
              "speaker_id": speaker["id"]},
        headers=owner,
    )
    # A manager of one event, and an admin of a different organization, cannot touch it.
    manager = event_staff(client, db, "manager@example.org", "manager", seed_id("evt_bci_workshop"))
    assert client.delete(f"/api/v1/admin/speakers/{speaker['id']}", headers=manager).status_code == 403
    other_org = Organization(id=uuid.uuid4(), name="Other", brand_name="Other", contact_email="o@example.org")
    db.add(other_org)
    db.commit()
    headers, user_id = signup(client, "other-owner@example.org")
    from app.db.models import OrganizationMembership

    db.add(OrganizationMembership(organization_id=other_org.id, user_id=user_id, role=OrganizationRole.OWNER))
    db.commit()
    url = f"/api/v1/admin/speakers/{speaker['id']}"
    assert client.patch(url, json={"bio": "x"}, headers=headers).status_code == 403
    assert client.patch(url, json={"bio": "ok"}, headers=owner).status_code == 200
    assert db.get(Speaker, uuid.UUID(speaker["id"])) is not None and db.query(EventSession).count() == 1
