from fastapi import APIRouter

from app.api.deps import DbSession
from app.schemas.events import EventDetailOut, EventSummaryOut, TicketQuoteOut
from app.services.catalogue import get_public_event, list_public_events, quote_ticket

router = APIRouter(prefix="/events", tags=["public"])


@router.get("", response_model=list[EventSummaryOut])
def list_events(db: DbSession) -> list[EventSummaryOut]:
    """Published, ongoing and completed events, soonest first."""
    return list_public_events(db)


@router.get("/{slug}", response_model=EventDetailOut)
def get_event(slug: str, db: DbSession) -> EventDetailOut:
    return get_public_event(db, slug)


@router.get("/{slug}/tickets/{code}/quote", response_model=TicketQuoteOut)
def get_ticket_quote(slug: str, code: str, db: DbSession) -> TicketQuoteOut:
    """The exact amount the server will charge for this ticket, VAT included."""
    return quote_ticket(db, slug, code)
