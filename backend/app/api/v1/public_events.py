from typing import Annotated

from fastapi import APIRouter, Query, Response

from app.api.deps import DbSession
from app.schemas.admin_events import ProgramOut, SpeakerOut
from app.schemas.events import EventDetailOut, EventSummaryOut, TicketQuoteOut
from app.services.catalogue import get_public_event, get_public_program, list_public_events, quote_ticket

router = APIRouter(prefix="/events", tags=["public"])

# Public catalogue data changes rarely; let browsers and CDNs reuse it briefly.
CATALOGUE_CACHE = "public, max-age=30, stale-while-revalidate=120"


@router.get("", response_model=list[EventSummaryOut])
def list_events(
    db: DbSession,
    response: Response,
    q: Annotated[str | None, Query(max_length=100)] = None,
    category: Annotated[str | None, Query(max_length=100)] = None,
    featured: bool | None = None,
    upcoming: bool = False,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
    offset: Annotated[int, Query(ge=0, le=10_000)] = 0,
) -> list[EventSummaryOut]:
    """Published, ongoing and completed events, soonest first."""
    response.headers["Cache-Control"] = CATALOGUE_CACHE
    return list_public_events(
        db, q=q, category=category, featured=featured, upcoming=upcoming, limit=limit, offset=offset
    )


@router.get("/{slug}", response_model=EventDetailOut)
def get_event(slug: str, db: DbSession, response: Response) -> EventDetailOut:
    response.headers["Cache-Control"] = CATALOGUE_CACHE
    return get_public_event(db, slug)


@router.get("/{slug}/program", response_model=ProgramOut)
def get_program(slug: str, db: DbSession, response: Response) -> ProgramOut:
    """Sessions (with speakers) and timeline milestones for a public event."""
    response.headers["Cache-Control"] = CATALOGUE_CACHE
    return get_public_program(db, slug)


@router.get("/{slug}/speakers", response_model=list[SpeakerOut])
def get_speakers(slug: str, db: DbSession, response: Response) -> list[SpeakerOut]:
    response.headers["Cache-Control"] = CATALOGUE_CACHE
    program = get_public_program(db, slug)
    seen: dict = {}
    for session in program.sessions:
        if session.speaker is not None:
            seen.setdefault(session.speaker.id, session.speaker)
    return sorted(seen.values(), key=lambda speaker: speaker.name)


@router.get("/{slug}/tickets/{code}/quote", response_model=TicketQuoteOut)
def get_ticket_quote(slug: str, code: str, db: DbSession, response: Response) -> TicketQuoteOut:
    """The exact amount the server will charge for this ticket, VAT included."""
    # Availability changes with every sale, so quotes are never cached.
    response.headers["Cache-Control"] = "no-store"
    return quote_ticket(db, slug, code)
