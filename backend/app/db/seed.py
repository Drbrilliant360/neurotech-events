"""Seed the demo catalogue (organisation, venues, events, ticket types) into the database.

Mirrors `src/data/seed/database.ts` so the API can price the same tickets the frontend shows.
IDs are deterministic (UUID5 of the frontend id) and every row is upserted, so re-running is safe:

    python -m app.db.seed
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from app.db.models import Event, Organization, TicketType, Venue
from app.db.models.enums import EventFormat, EventStatus
from app.db.session import SessionLocal

NAMESPACE = uuid.UUID("6f1b3e0c-2f0a-4c7c-9b1a-5d2c8a1e7f10")


def seed_id(key: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, key)


ORGANIZATION = {
    "id": seed_id("org_neurotech"),
    "name": "NeuroTech Events",
    "brand_name": "NeuroTech Summit",
    "contact_email": "hello@neurotech.co.tz",
    "contact_phone": "+255 22 212 3456",
    "default_currency": "TZS",
    "default_city": "Dar es Salaam",
    "default_country": "Tanzania",
    "vat_percent": Decimal("18"),
}

VENUES = [
    ("ven_jnicc", "Julius Nyerere Convention Centre", "Dar es Salaam"),
    ("ven_nmaist", "NM-AIST", "Arusha"),
    ("ven_dodoma", "University of Dodoma", "Dodoma"),
    ("ven_mwanza", "Mwanza Conference Hall", "Mwanza"),
    ("ven_online", "Online", None),
    ("ven_zanzibar", "Zanzibar Beach Resort", "Zanzibar"),
]

# (frontend id, slug, title, subtitle, category, status, format, starts, ends, venue, capacity, reg_open, reg_close)
EVENTS = [
    (
        "evt_summit_2026",
        "neurotech-summit-2026",
        "NeuroTech Summit 2026",
        "Connecting minds with future technology",
        "Summit",
        EventStatus.PUBLISHED,
        EventFormat.PHYSICAL,
        "2026-11-20T08:00:00+03:00",
        "2026-11-22T18:00:00+03:00",
        "ven_jnicc",
        1200,
        "2026-09-01T00:00:00+03:00",
        "2026-11-15T23:59:00+03:00",
    ),
    (
        "evt_bci_workshop",
        "bci-hands-on-workshop",
        "BCI Hands-on Workshop",
        "Signal acquisition and assistive prototypes",
        "Workshop",
        EventStatus.PUBLISHED,
        EventFormat.PHYSICAL,
        "2026-12-10T09:00:00+03:00",
        "2026-12-10T17:00:00+03:00",
        "ven_nmaist",
        80,
        "2026-10-01T00:00:00+03:00",
        "2026-12-05T23:59:00+03:00",
    ),
    (
        "evt_ai_health",
        "ai-in-healthcare-conference",
        "AI in Healthcare Conference",
        "Clinical AI for East African health systems",
        "Conference",
        EventStatus.DRAFT,
        EventFormat.HYBRID,
        "2027-01-15T08:30:00+03:00",
        "2027-01-16T17:00:00+03:00",
        "ven_dodoma",
        400,
        "2026-11-01T00:00:00+03:00",
        "2027-01-10T23:59:00+03:00",
    ),
    (
        "evt_clinical_forum",
        "neurohealth-clinical-forum",
        "Neurohealth Clinical Forum",
        "Primary care pathways for neurological disease",
        "Forum",
        EventStatus.DRAFT,
        EventFormat.PHYSICAL,
        "2027-02-02T09:00:00+03:00",
        "2027-02-02T16:00:00+03:00",
        "ven_mwanza",
        200,
        "2026-12-01T00:00:00+03:00",
        "2027-01-28T23:59:00+03:00",
    ),
    (
        "evt_research_bootcamp",
        "research-methods-bootcamp",
        "Research Methods Bootcamp",
        "Study design for neurotechnology trials",
        "Bootcamp",
        EventStatus.PUBLISHED,
        EventFormat.ONLINE,
        "2027-02-18T09:00:00+03:00",
        "2027-02-20T16:00:00+03:00",
        "ven_online",
        300,
        "2026-12-15T00:00:00+03:00",
        "2027-02-15T23:59:00+03:00",
    ),
    (
        "evt_zanzibar_day",
        "zanzibar-neuro-innovation-day",
        "Zanzibar Neuro Innovation Day",
        "Invite-only investor and founder gathering",
        "Investor",
        EventStatus.PUBLISHED,
        EventFormat.PHYSICAL,
        "2027-03-05T09:00:00+03:00",
        "2027-03-05T18:00:00+03:00",
        "ven_zanzibar",
        80,
        "2026-12-01T00:00:00+03:00",
        "2027-02-20T23:59:00+03:00",
    ),
    (
        "evt_summit_2025",
        "neurotech-clinical-lab-2025",
        "NeuroTech Clinical Lab 2025",
        "Completed laboratory intensive",
        "Lab",
        EventStatus.COMPLETED,
        EventFormat.PHYSICAL,
        "2025-08-12T09:00:00+03:00",
        "2025-08-13T17:00:00+03:00",
        "ven_jnicc",
        120,
        "2025-05-01T00:00:00+03:00",
        "2025-08-01T23:59:00+03:00",
    ),
]

# (frontend id = ticket code, event frontend id, name, tier, price TZS, perks, capacity, active)
TICKET_TYPES = [
    (
        "tix_student",
        "evt_summit_2026",
        "Student",
        "student",
        20000,
        "All keynotes and sessions · Student ID required",
        500,
        True,
    ),
    (
        "tix_pro",
        "evt_summit_2026",
        "Professional",
        "professional",
        100000,
        "All sessions, workshops, lunch and certificate",
        500,
        True,
    ),
    (
        "tix_vip",
        "evt_summit_2026",
        "VIP",
        "vip",
        300000,
        "Front seating, speaker dinner, investor roundtable",
        100,
        True,
    ),
    (
        "tix_early",
        "evt_summit_2026",
        "Early Bird",
        "early-bird",
        75000,
        "Professional access at early rate · limited",
        80,
        False,
    ),
    ("tix_w", "evt_bci_workshop", "Workshop", "professional", 60000, "Full-day lab access", 80, True),
    ("tix_c", "evt_ai_health", "Standard", "professional", 80000, "Conference pass", 400, True),
    ("tix_f", "evt_clinical_forum", "Clinical", "professional", 45000, "Forum pass", 200, True),
    ("tix_b", "evt_research_bootcamp", "Online", "student", 0, "Complimentary online seat", 300, True),
    ("tix_z", "evt_zanzibar_day", "Invite", "vip", 0, "Invitation only", 80, True),
    ("tix_past", "evt_summit_2025", "Lab pass", "professional", 40000, "Completed lab intensive", 120, True),
]


def _upsert(db: Session, model: type, row_id: uuid.UUID, **values: object) -> object:
    instance = db.get(model, row_id)
    if instance is None:
        instance = model(id=row_id, **values)
        db.add(instance)
    else:
        for key, value in values.items():
            setattr(instance, key, value)
    return instance


def seed(db: Session) -> dict[str, int]:
    org_values = {k: v for k, v in ORGANIZATION.items() if k != "id"}
    _upsert(db, Organization, ORGANIZATION["id"], **org_values)

    for key, name, city in VENUES:
        _upsert(db, Venue, seed_id(key), name=name, city=city, country="Tanzania" if city else None)

    for key, slug, title, subtitle, category, status, fmt, starts, ends, venue_key, capacity, opens, closes in EVENTS:
        _upsert(
            db,
            Event,
            seed_id(key),
            organization_id=ORGANIZATION["id"],
            venue_id=seed_id(venue_key),
            slug=slug,
            title=title,
            subtitle=subtitle,
            category=category,
            status=status,
            format=fmt,
            starts_at=datetime.fromisoformat(starts),
            ends_at=datetime.fromisoformat(ends),
            capacity=capacity,
            registration_opens_at=datetime.fromisoformat(opens),
            registration_closes_at=datetime.fromisoformat(closes),
            featured=key == "evt_summit_2026",
            banner_label=category,
            highlights=[],
            faqs=[],
        )

    for code, event_key, name, tier, price, perks, capacity, active in TICKET_TYPES:
        _upsert(
            db,
            TicketType,
            seed_id(code),
            event_id=seed_id(event_key),
            code=code,
            name=name,
            tier=tier,
            price=Decimal(price),
            currency="TZS",
            perks=perks,
            capacity=capacity,
            active=active,
        )

    db.commit()
    return {"organizations": 1, "venues": len(VENUES), "events": len(EVENTS), "ticket_types": len(TICKET_TYPES)}


def main() -> None:
    with SessionLocal() as db:
        counts = seed(db)
    print(f"Seeded on {date.today().isoformat()}: " + ", ".join(f"{k}={v}" for k, v in counts.items()))


if __name__ == "__main__":
    main()
