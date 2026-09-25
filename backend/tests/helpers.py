"""Shared helpers for API tests that need users with specific scoped roles."""

import uuid

from app.db.models import EventStaffAssignment, OrganizationMembership
from app.db.models.enums import OrganizationRole
from app.db.seed import ORGANIZATION, seed_id

SUMMIT_ID = seed_id("evt_summit_2026")
ORGANIZATION_ID = ORGANIZATION["id"]


def signup(client, email: str, name: str = "Test User") -> tuple[dict[str, str], uuid.UUID]:
    response = client.post("/api/v1/auth/register", json={"email": email, "password": "password123", "full_name": name})
    assert response.status_code == 201, response.text
    body = response.json()
    return {"Authorization": f"Bearer {body['access_token']}"}, uuid.UUID(body["user"]["id"])


def org_member(client, db, email: str, role: OrganizationRole = OrganizationRole.OWNER) -> dict[str, str]:
    headers, user_id = signup(client, email)
    db.add(OrganizationMembership(organization_id=ORGANIZATION_ID, user_id=user_id, role=role))
    db.commit()
    return headers


def event_staff(client, db, email: str, role: str, event_id: uuid.UUID = SUMMIT_ID) -> dict[str, str]:
    headers, user_id = signup(client, email)
    db.add(EventStaffAssignment(event_id=event_id, user_id=user_id, role=role))
    db.commit()
    return headers
