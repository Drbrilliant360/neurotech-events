import uuid

from pydantic import BaseModel, ConfigDict, EmailStr

from app.db.models.enums import EventAssignmentRole, OrganizationRole


class MembershipUpsertRequest(BaseModel):
    user_id: uuid.UUID
    role: OrganizationRole


class EventAssignmentUpsertRequest(BaseModel):
    user_id: uuid.UUID
    role: EventAssignmentRole


class ScopedAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    role: str
    is_active: bool


class TeamMemberAdd(BaseModel):
    email: EmailStr
    role: OrganizationRole


class EventStaffAdd(BaseModel):
    email: EmailStr
    role: EventAssignmentRole


class TeamMemberOut(BaseModel):
    user_id: uuid.UUID
    email: str
    full_name: str
    role: str


class EventStaffOut(TeamMemberOut):
    event_id: uuid.UUID


class OrganizationTeamOut(BaseModel):
    members: list[TeamMemberOut]
    event_staff: list[EventStaffOut]
