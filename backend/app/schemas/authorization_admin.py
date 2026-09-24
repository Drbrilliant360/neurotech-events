import uuid

from pydantic import BaseModel, ConfigDict

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
