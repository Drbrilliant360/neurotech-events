"""Seed the demo catalogue (organisation, venues, events, ticket types, summit programme) into the database.

Mirrors `src/data/seed/database.ts` so the API can price the same tickets the frontend shows.
IDs are deterministic (UUID5 of the frontend id) and every row is upserted, so re-running is safe:

    python -m app.db.seed
"""

import uuid
from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy.orm import Session

from app.db.models import Event, EventSession, Organization, Speaker, TicketType, Venue
from app.db.models.enums import EventFormat, EventStatus, SessionType
from app.db.session import SessionLocal

NAMESPACE = uuid.UUID("6f1b3e0c-2f0a-4c7c-9b1a-5d2c8a1e7f10")


def seed_id(key: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, key)


ORGANIZATION = {
    "id": seed_id("org_neurotech"),
    "name": "Neurotech Africa",
    "brand_name": "Neurotech Events",
    "contact_email": "info@neurotech.africa",
    "contact_phone": "+255 699 920 009",
    "default_currency": "TZS",
    "default_city": "Dar es Salaam",
    "default_country": "Tanzania",
    "vat_percent": Decimal("18"),
}

# (key, name, address, city)
VENUES = [
    ("ven_skycity", "Neurotech Africa HQ", "SkyCity Mall, 9th Floor", "Dar es Salaam"),
    ("ven_jnicc", "Julius Nyerere Convention Centre", "Shaaban Robert St", "Dar es Salaam"),
    ("ven_nmaist", "NM-AIST", "Nelson Mandela Rd", "Arusha"),
    ("ven_dodoma", "University of Dodoma", "UDOM Campus", "Dodoma"),
    ("ven_mwanza", "Mwanza Conference Hall", "Nyerere Rd", "Mwanza"),
    ("ven_online", "Online", None, None),
    ("ven_zanzibar", "Zanzibar Beach Resort", "Nungwi", "Zanzibar"),
]

# Sample catalogue themed on Neurotech Africa's products and community programmes
# (https://www.neurotech.africa). Dates, prices and capacities are placeholders for the events team.
# Keys and ticket codes are stable because tests and existing registrations refer to them.
# (key, slug, title, subtitle, category, status, format, starts, ends, venue, capacity, reg_open, reg_close)
EVENTS = [
    (
        "evt_summit_2026",
        "neurotech-summit-2026",
        "Neurotech Summit 2026",
        "Infrastructure for Africa's conversational commerce",
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
        "sarufi-ai-agents-workshop",
        "Sarufi AI Agents Workshop",
        "Build and deploy a customer-facing AI agent in a day",
        "Workshop",
        EventStatus.PUBLISHED,
        EventFormat.PHYSICAL,
        "2026-12-10T09:00:00+03:00",
        "2026-12-10T17:00:00+03:00",
        "ven_skycity",
        80,
        "2026-09-15T00:00:00+03:00",
        "2026-12-05T23:59:00+03:00",
    ),
    (
        "evt_ai_health",
        "ghala-whatsapp-commerce-clinic",
        "Ghala WhatsApp Commerce Clinic",
        "Set up a storefront, catalogue and payments inside WhatsApp",
        "Clinic",
        EventStatus.DRAFT,
        EventFormat.HYBRID,
        "2027-01-15T09:00:00+03:00",
        "2027-01-15T15:00:00+03:00",
        "ven_skycity",
        120,
        "2026-11-01T00:00:00+03:00",
        "2027-01-10T23:59:00+03:00",
    ),
    (
        "evt_clinical_forum",
        "semacall-customer-operations-forum",
        "SemaCall Customer Operations Forum",
        "Modern call centres: routing, Swahili transcription and quality monitoring",
        "Forum",
        EventStatus.DRAFT,
        EventFormat.PHYSICAL,
        "2027-02-02T09:00:00+03:00",
        "2027-02-02T16:00:00+03:00",
        "ven_jnicc",
        200,
        "2026-12-01T00:00:00+03:00",
        "2027-01-28T23:59:00+03:00",
    ),
    (
        "evt_research_bootcamp",
        "snippe-payments-developer-day",
        "Snippe Payments Developer Day",
        "Accept mobile money, cards and bank transfers from your product",
        "Developer day",
        EventStatus.PUBLISHED,
        EventFormat.ONLINE,
        "2027-02-18T10:00:00+03:00",
        "2027-02-18T16:00:00+03:00",
        "ven_online",
        300,
        "2026-12-15T00:00:00+03:00",
        "2027-02-15T23:59:00+03:00",
    ),
    (
        "evt_zanzibar_day",
        "generative-ai-tanzania-meetup",
        "Generative AI Tanzania Meetup",
        "Students, professionals and builders exploring GenAI for East Africa",
        "Meetup",
        EventStatus.PUBLISHED,
        EventFormat.PHYSICAL,
        "2026-10-24T14:00:00+03:00",
        "2026-10-24T18:00:00+03:00",
        "ven_skycity",
        150,
        "2026-09-15T00:00:00+03:00",
        "2026-10-23T23:59:00+03:00",
    ),
    (
        "evt_summit_2025",
        "generative-ai-tanzania-hackathon-2025",
        "Generative AI Tanzania Hackathon 2025",
        "Completed community hackathon",
        "Hackathon",
        EventStatus.COMPLETED,
        EventFormat.PHYSICAL,
        "2025-08-12T09:00:00+03:00",
        "2025-08-13T17:00:00+03:00",
        "ven_skycity",
        120,
        "2025-05-01T00:00:00+03:00",
        "2025-08-01T23:59:00+03:00",
    ),
]

# key -> (theme, description, highlights, faqs)
EVENT_DETAILS = {
    "evt_summit_2026": (
        "Where customer journeys start in conversation",
        "The Neurotech Summit brings together African founders, operators, banks, telcos and builders around "
        "the infrastructure behind conversational commerce: AI agents, WhatsApp storefronts, cloud voice and "
        "payment rails. Three days of keynotes, product sessions and hands-on labs with the teams behind "
        "Sarufi, SemaCall, Ghala and Snippe.",
        ["AI agents", "WhatsApp commerce", "Cloud voice", "Payments", "Generative AI"],
        ["Is the ticket transferable?", "Do students get a discount?", "Will sessions be recorded?",
         "Which mobile money networks can I pay with?"],
    ),
    "evt_bci_workshop": (
        "Hands-on AI agents",
        "A practical, full-day workshop on Sarufi. Build an AI agent with its own knowledge base, deploy it to "
        "WhatsApp, SMS, USSD, web and API channels, and connect payments so it can close a sale.",
        ["AI agents", "WhatsApp", "USSD", "Hands-on"],
        ["Do I need to bring a laptop?", "Do I need coding experience?"],
    ),
    "evt_ai_health": (
        "Commerce inside the chat",
        "A working clinic for merchants and teams moving sales into WhatsApp with Ghala: storefronts, product "
        "catalogues, order management and payment collection without leaving the conversation.",
        ["WhatsApp commerce", "Merchants", "Payments"],
        ["Can I attend online?", "Should I bring my product list?"],
    ),
    "evt_clinical_forum": (
        "Customer operations at scale",
        "A forum for customer service leaders on running cloud call centres with SemaCall: call routing, "
        "transcription in Swahili and English, encryption and agent performance monitoring.",
        ["Cloud voice", "Call centres", "Swahili AI"],
        ["Who is this forum for?"],
    ),
    "evt_research_bootcamp": (
        "Payments for builders",
        "An online developer day on Snippe payment infrastructure: payment links, checkout pages and APIs for "
        "accepting mobile money, cards and bank transfers.",
        ["Payments", "Mobile money", "Developers"],
        ["Will recordings be shared?", "Is there a sandbox account?"],
    ),
    "evt_zanzibar_day": (
        "Generative AI for Tanzania and East Africa",
        "The Generative AI Tanzania meetup is a welcoming space for students, professionals and builders of every "
        "experience level to share AI trends, tools and techniques, and to meet collaborators, mentors and "
        "employers. Free to attend; registration required.",
        ["Generative AI", "Community", "Networking"],
        ["Is the meetup free?", "Do I need AI experience to attend?"],
    ),
    "evt_summit_2025": (
        "Building with generative AI",
        "A completed community hackathon where teams built generative AI prototypes for Tanzanian use cases. "
        "Certificates are available to checked-in participants.",
        ["Generative AI", "Hackathon"],
        [],
    ),
}

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
        "All sessions, labs, lunch and certificate",
        500,
        True,
    ),
    (
        "tix_vip",
        "evt_summit_2026",
        "VIP",
        "vip",
        300000,
        "Front seating, speaker dinner, partner roundtable",
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
    ("tix_w", "evt_bci_workshop", "Workshop", "professional", 60000, "Full-day lab · bring a laptop", 80, True),
    ("tix_c", "evt_ai_health", "Clinic pass", "professional", 30000, "Clinic seat and setup support", 120, True),
    ("tix_f", "evt_clinical_forum", "Forum pass", "professional", 45000, "Forum sessions and lunch", 200, True),
    ("tix_b", "evt_research_bootcamp", "Online", "student", 0, "Complimentary online seat", 300, True),
    ("tix_z", "evt_zanzibar_day", "Community seat", "student", 0, "Free seat · registration required", 150, True),
    ("tix_past", "evt_summit_2025", "Hackathon pass", "professional", 40000, "Completed hackathon", 120, True),
]

# Programme for the featured summit, loaded by `python -m app.db.seed` but not by the test fixtures.
# Speakers are the product teams rather than named individuals until the line-up is confirmed.
# (key, name, initials, role, bio, track)
SPEAKERS = [
    ("spk_sarufi", "Sarufi team", "SA", "AI agents platform",
     "Builds customer-facing AI agents for WhatsApp, SMS, USSD, web and API, with knowledge bases and payments.",
     "AI agents"),
    ("spk_semacall", "SemaCall team", "SC", "Cloud call centre",
     "Runs call routing, Swahili and English transcription, encryption and agent performance monitoring.",
     "Cloud voice"),
    ("spk_ghala", "Ghala team", "GH", "WhatsApp commerce",
     "Helps merchants run storefronts, catalogues, orders and payment collection inside WhatsApp.", "Commerce"),
    ("spk_snippe", "Snippe team", "SN", "Payment infrastructure",
     "Accepts mobile money, cards and bank transfers through payment links and checkout pages.", "Payments"),
]

# (key, event, speaker, title, day_index, day_label, date, start, end, speaker_label, room, type)
SESSIONS = [
    ("ses_open", "evt_summit_2026", None, "Opening: the conversational business stack", 0, "Day 1", "2026-11-20",
     "09:00", "09:45", "Neurotech Africa", "Main Hall", SessionType.KEYNOTE),
    ("ses_agents", "evt_summit_2026", "spk_sarufi", "AI agents that sell, support and collect", 0, "Day 1",
     "2026-11-20", "10:30", "11:30", None, "Main Hall", SessionType.SESSION),
    ("ses_voice", "evt_summit_2026", "spk_semacall", "Cloud voice and Swahili transcription", 0, "Day 1",
     "2026-11-20", "14:00", "15:00", None, "Hall A", SessionType.SESSION),
    ("ses_ghala", "evt_summit_2026", "spk_ghala", "Lab: launch a WhatsApp storefront", 1, "Day 2", "2026-11-21",
     "10:00", "12:00", None, "Lab 1", SessionType.WORKSHOP),
    ("ses_snippe", "evt_summit_2026", "spk_snippe", "Payment rails for African products", 1, "Day 2", "2026-11-21",
     "14:00", "15:00", None, "Hall A", SessionType.SESSION),
    ("ses_net", "evt_summit_2026", None, "Builders and partners networking", 1, "Day 2", "2026-11-21", "17:00",
     "18:30", None, "Terrace", SessionType.NETWORKING),
    ("ses_demo", "evt_summit_2026", None, "Product demos and community showcase", 2, "Day 3", "2026-11-22",
     "10:00", "12:30", "Community teams", "Demo Floor", SessionType.SHOWCASE),
    ("ses_close", "evt_summit_2026", None, "Closing and awards", 2, "Day 3", "2026-11-22", "16:00", "17:00",
     "Neurotech Africa", "Main Hall", SessionType.CEREMONY),
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

    for key, name, address, city in VENUES:
        _upsert(
            db, Venue, seed_id(key), name=name, address=address, city=city, region=city,
            country="Tanzania" if city else None,
        )

    for key, slug, title, subtitle, category, status, fmt, starts, ends, venue_key, capacity, opens, closes in EVENTS:
        theme, description, highlights, faqs = EVENT_DETAILS[key]
        _upsert(
            db,
            Event,
            seed_id(key),
            organization_id=ORGANIZATION["id"],
            venue_id=seed_id(venue_key),
            slug=slug,
            title=title,
            subtitle=subtitle,
            description=description,
            theme=theme,
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
            highlights=highlights,
            faqs=faqs,
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


def seed_programme(db: Session) -> dict[str, int]:
    """Speakers and sessions for the featured summit. Kept out of `seed` so tests start with no programme."""
    for key, name, initials, role, bio, track in SPEAKERS:
        _upsert(
            db, Speaker, seed_id(key), name=name, initials=initials, role=role, organization="Neurotech Africa",
            bio=bio, track=track, social_url="https://www.neurotech.africa",
        )
    for key, event_key, speaker_key, title, day, day_label, day_date, start, end, label, room, kind in SESSIONS:
        _upsert(
            db, EventSession, seed_id(key), event_id=seed_id(event_key),
            speaker_id=seed_id(speaker_key) if speaker_key else None, title=title, day_index=day,
            day_label=day_label, session_date=date.fromisoformat(day_date), start_time=time.fromisoformat(start),
            end_time=time.fromisoformat(end), speaker_label=label, room=room, session_type=kind,
        )
    db.commit()
    return {"speakers": len(SPEAKERS), "sessions": len(SESSIONS)}


def main() -> None:
    with SessionLocal() as db:
        counts = seed(db) | seed_programme(db)
    print(f"Seeded on {date.today().isoformat()}: " + ", ".join(f"{k}={v}" for k, v in counts.items()))


if __name__ == "__main__":
    main()
