from fastapi import APIRouter, Depends

from app.api.deps import DbSession, require_super_admin
from app.schemas.events import CatalogueSyncIn, CatalogueSyncOut
from app.services.catalogue import sync_catalogue

router = APIRouter(prefix="/admin/catalogue", tags=["admin"], dependencies=[Depends(require_super_admin)])


@router.put("", response_model=CatalogueSyncOut)
def put_catalogue(payload: CatalogueSyncIn, db: DbSession) -> CatalogueSyncOut:
    """Upsert the admin console's events and ticket types so live payments can price them."""
    return sync_catalogue(db, payload)
