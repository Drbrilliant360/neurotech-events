import uuid

from fastapi import APIRouter, Response

from app.api.deps import AppSettings, DbSession, Gateway
from app.api.v1.auth import CurrentUser
from app.schemas.workspace import AdminWorkspaceOut, OrganizationOut, OrganizationUpdate, PublicCatalogueOut
from app.services import event_admin, workspace
from app.services.payments import PaymentService

router = APIRouter(tags=["workspace"])


@router.get("/catalogue", response_model=PublicCatalogueOut, tags=["public"])
def public_catalogue(db: DbSession, response: Response) -> PublicCatalogueOut:
    """Published events with tickets, sessions, speakers, milestones and organization settings."""
    response.headers["Cache-Control"] = "public, max-age=30, stale-while-revalidate=120"
    return workspace.public_catalogue(db)


@router.get("/admin/workspace", response_model=AdminWorkspaceOut, tags=["admin: events"])
def admin_workspace(
    user: CurrentUser, db: DbSession, gateway: Gateway, settings: AppSettings, response: Response
) -> AdminWorkspaceOut:
    """Everything the organiser console can show for the caller, filtered per event by access."""
    response.headers["Cache-Control"] = "no-store"
    return workspace.admin_workspace(db, user, PaymentService(db, gateway, settings))


@router.get("/admin/organizations", response_model=list[OrganizationOut], tags=["admin: events"])
def list_organizations(user: CurrentUser, db: DbSession) -> list[OrganizationOut]:
    return [OrganizationOut.model_validate(item) for item in workspace._organizations(db, user)]


@router.patch("/admin/organizations/{organization_id}", response_model=OrganizationOut, tags=["admin: events"])
def update_organization(
    organization_id: uuid.UUID, payload: OrganizationUpdate, user: CurrentUser, db: DbSession
) -> OrganizationOut:
    """Organization defaults; VAT here is what checkout charges. Owner/admin only."""
    changes = payload.model_dump(exclude_unset=True)
    return OrganizationOut.model_validate(event_admin.update_organization(db, user, organization_id, changes))
