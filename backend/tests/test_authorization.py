import uuid

from app.db.models import Event, EventStaffAssignment, OrganizationMembership, User
from app.db.models.enums import EventAssignmentRole, OrganizationRole
from app.db.seed import seed_id


def register(client, email: str) -> tuple[str, str]:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "full_name": "Access Tester"},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    return body["access_token"], body["user"]["id"]


def test_event_access_requires_authentication_and_defaults_to_denied(client, db) -> None:
    event_id = seed_id("evt_summit_2026")
    assert client.get(f"/api/v1/authorization/events/{event_id}").status_code == 401

    token, _ = register(client, "scoped-attendee@example.com")
    response = client.get(
        f"/api/v1/authorization/events/{event_id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["event_roles"] == []
    assert body["can_manage_event"] is False
    assert body["can_check_in"] is False


def test_event_access_combines_organization_and_event_scopes(client, db) -> None:
    token, user_id = register(client, "scoped-manager@example.com")
    user = db.get(User, uuid.UUID(user_id))
    event = db.get(Event, seed_id("evt_summit_2026"))
    assert user is not None and event is not None
    db.add(
        OrganizationMembership(
            organization_id=event.organization_id,
            user_id=user.id,
            role=OrganizationRole.FINANCE,
        )
    )
    db.add(
        EventStaffAssignment(
            event_id=event.id,
            user_id=user.id,
            role=EventAssignmentRole.MANAGER.value,
        )
    )
    db.commit()

    response = client.get(
        f"/api/v1/authorization/events/{event.id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["organization_roles"] == ["finance"]
    assert body["event_roles"] == ["manager"]
    assert body["can_manage_event"] is True
    assert body["can_manage_finance"] is True
    assert body["can_check_in"] is True


def test_event_access_does_not_disclose_unknown_event(client) -> None:
    token, _ = register(client, "missing-event@example.com")
    response = client.get(
        "/api/v1/authorization/events/00000000-0000-0000-0000-000000000000",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 404


def test_event_manager_can_assign_and_deactivate_event_staff(client, db) -> None:
    token, manager_id = register(client, "assignment-manager@example.com")
    _, target_id = register(client, "assignment-target@example.com")
    manager = db.get(User, uuid.UUID(manager_id))
    event = db.get(Event, seed_id("evt_summit_2026"))
    assert manager is not None and event is not None
    db.add(
        OrganizationMembership(
            organization_id=event.organization_id,
            user_id=manager.id,
            role=OrganizationRole.ADMIN,
        )
    )
    db.commit()
    headers = {"Authorization": f"Bearer {token}"}
    response = client.put(
        f"/api/v1/authorization/events/{event.id}/assignments/{target_id}",
        headers=headers,
        json={"user_id": target_id, "role": "check_in"},
    )
    assert response.status_code == 200
    assert response.json()["role"] == "check_in"
    response = client.delete(
        f"/api/v1/authorization/events/{event.id}/assignments/{target_id}",
        headers=headers,
    )
    assert response.status_code == 204
