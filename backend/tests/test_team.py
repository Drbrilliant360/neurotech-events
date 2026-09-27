from app.db.models.enums import OrganizationRole
from tests.helpers import ORGANIZATION_ID, SUMMIT_ID, org_member, signup


def test_owner_lists_and_adds_team_members_by_email(client, db) -> None:
    owner = org_member(client, db, "team-owner@example.com")
    signup(client, "Colleague@Example.com", "Asha Colleague")

    response = client.post(
        f"/api/v1/admin/organizations/{ORGANIZATION_ID}/team",
        headers=owner,
        json={"email": "colleague@example.com", "role": "finance"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["full_name"] == "Asha Colleague"

    team = client.get(f"/api/v1/admin/organizations/{ORGANIZATION_ID}/team", headers=owner).json()
    roles = {member["email"]: member["role"] for member in team["members"]}
    assert roles == {"team-owner@example.com": "owner", "colleague@example.com": "finance"}


def test_adding_unknown_email_returns_not_found(client, db) -> None:
    owner = org_member(client, db, "team-owner2@example.com")
    response = client.post(
        f"/api/v1/admin/organizations/{ORGANIZATION_ID}/team",
        headers=owner,
        json={"email": "nobody@example.com", "role": "member"},
    )
    assert response.status_code == 404


def test_team_requires_organization_manager(client, db) -> None:
    finance = org_member(client, db, "team-finance@example.com", OrganizationRole.FINANCE)
    attendee, _ = signup(client, "team-attendee@example.com")
    assert client.get(f"/api/v1/admin/organizations/{ORGANIZATION_ID}/team", headers=finance).status_code == 403
    assert client.get(f"/api/v1/admin/organizations/{ORGANIZATION_ID}/team", headers=attendee).status_code == 403


def test_admin_cannot_grant_owner_or_change_own_role(client, db) -> None:
    admin = org_member(client, db, "team-admin@example.com", OrganizationRole.ADMIN)
    signup(client, "team-target@example.com")
    url = f"/api/v1/admin/organizations/{ORGANIZATION_ID}/team"
    assert (
        client.post(url, headers=admin, json={"email": "team-target@example.com", "role": "owner"}).status_code == 403
    )
    assert (
        client.post(url, headers=admin, json={"email": "team-admin@example.com", "role": "member"}).status_code == 400
    )


def test_event_manager_adds_check_in_staff_by_email(client, db) -> None:
    owner = org_member(client, db, "staff-owner@example.com")
    signup(client, "door@example.com", "Door Staff")
    response = client.post(
        f"/api/v1/admin/events/{SUMMIT_ID}/staff", headers=owner, json={"email": "door@example.com", "role": "check_in"}
    )
    assert response.status_code == 200, response.text
    team = client.get(f"/api/v1/admin/organizations/{ORGANIZATION_ID}/team", headers=owner).json()
    assert [(s["email"], s["role"], s["event_id"]) for s in team["event_staff"]] == [
        ("door@example.com", "check_in", str(SUMMIT_ID))
    ]


def test_attendee_cannot_add_event_staff(client, db) -> None:
    attendee, _ = signup(client, "staff-attendee@example.com")
    signup(client, "staff-target@example.com")
    response = client.post(
        f"/api/v1/admin/events/{SUMMIT_ID}/staff",
        headers=attendee,
        json={"email": "staff-target@example.com", "role": "staff"},
    )
    assert response.status_code == 404
