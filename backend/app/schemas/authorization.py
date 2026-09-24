import uuid

from pydantic import BaseModel


class EventAccessResponse(BaseModel):
    event_id: uuid.UUID
    organization_id: uuid.UUID
    is_platform_admin: bool
    organization_roles: list[str]
    event_roles: list[str]
    can_manage_event: bool
    can_manage_finance: bool
    can_check_in: bool
