"""Organiser team: list members and event staff, and add them by the email they signed up with.

Removing someone uses the existing `/authorization/...` DELETE routes, which take the user id
returned here.
"""

import uuid

from fastapi import APIRouter

from app.api.deps import DbSession
from app.api.v1.auth import CurrentUser
from app.schemas.authorization_admin import (
    EventStaffAdd,
    EventStaffOut,
    OrganizationTeamOut,
    TeamMemberAdd,
    TeamMemberOut,
)
from app.services import team

router = APIRouter(prefix="/admin", tags=["admin: team"])


@router.get("/organizations/{organization_id}/team", response_model=OrganizationTeamOut)
def get_team(organization_id: uuid.UUID, user: CurrentUser, db: DbSession) -> OrganizationTeamOut:
    members, staff = team.organization_team(db, user, organization_id)
    return OrganizationTeamOut(
        members=[
            TeamMemberOut(user_id=u.id, email=u.email, full_name=u.full_name, role=m.role.value) for m, u in members
        ],
        event_staff=[
            EventStaffOut(user_id=u.id, email=u.email, full_name=u.full_name, role=a.role, event_id=a.event_id)
            for a, u in staff
        ],
    )


@router.post("/organizations/{organization_id}/team", response_model=TeamMemberOut)
def add_member(organization_id: uuid.UUID, payload: TeamMemberAdd, user: CurrentUser, db: DbSession) -> TeamMemberOut:
    membership, target = team.add_member(db, user, organization_id, str(payload.email), payload.role)
    return TeamMemberOut(user_id=target.id, email=target.email, full_name=target.full_name, role=membership.role.value)


@router.post("/events/{event_id}/staff", response_model=EventStaffOut)
def add_event_staff(event_id: uuid.UUID, payload: EventStaffAdd, user: CurrentUser, db: DbSession) -> EventStaffOut:
    assignment, target = team.add_event_staff(db, user, event_id, str(payload.email), payload.role)
    return EventStaffOut(
        user_id=target.id, email=target.email, full_name=target.full_name, role=assignment.role, event_id=event_id
    )
