from tests.conftest import ADMIN_TOKEN

HEADERS = {"Authorization": f"Bearer {ADMIN_TOKEN}"}


def test_public_events_and_detail(client) -> None:
    events = client.get("/api/v1/events").json()
    slugs = {event["slug"] for event in events}
    assert "neurotech-summit-2026" in slugs
    assert "ai-in-healthcare-conference" not in slugs  # draft events stay private
    assert events == sorted(events, key=lambda event: event["starts_at"])

    detail = client.get("/api/v1/events/neurotech-summit-2026").json()
    assert detail["venue"]["city"] == "Dar es Salaam"
    codes = {ticket["code"]: ticket for ticket in detail["ticket_types"]}
    assert codes["tix_pro"]["price"] == 100000 and codes["tix_pro"]["sold"] == 0
    assert codes["tix_early"]["active"] is False
    assert client.get("/api/v1/events/ai-in-healthcare-conference").status_code == 404
    assert client.get("/api/v1/events/nope").status_code == 404


def test_ticket_quote_is_server_authoritative(client) -> None:
    quote = client.get("/api/v1/events/neurotech-summit-2026/tickets/tix_pro/quote").json()
    assert (quote["price"], quote["vat"], quote["total"], quote["currency"]) == (100000, 18000, 118000, "TZS")
    assert quote["payable_online"] is True and quote["available"] == 500

    free = client.get("/api/v1/events/research-methods-bootcamp/tickets/tix_b/quote").json()
    assert free["total"] == 0 and free["payable_online"] is False

    assert client.get("/api/v1/events/neurotech-summit-2026/tickets/nope/quote").status_code == 404


def test_catalogue_sync_upserts_and_prices_new_tickets(client) -> None:
    payload = {
        "vat_percent": 18,
        "events": [
            {
                "id": "evt_local_1",
                "slug": "neuro-hackathon-2027",
                "title": "Neuro Hackathon 2027",
                "status": "published",
                "format": "physical",
                "starts_at": "2027-05-01T09:00:00+03:00",
                "ends_at": "2027-05-02T18:00:00+03:00",
                "capacity": 150,
                "venue_name": "Buni Hub",
                "venue_city": "Dar es Salaam",
                "highlights": ["Hardware", "Prizes"],
            },
            {
                "id": "evt_summit_2026",
                "slug": "neurotech-summit-2026",
                "title": "NeuroTech Summit 2026 (renamed)",
                "status": "published",
                "format": "physical",
                "starts_at": "2026-11-20T08:00:00+03:00",
                "ends_at": "2026-11-22T18:00:00+03:00",
                "capacity": 1200,
            },
        ],
        "ticket_types": [
            {
                "id": "tix_hack",
                "event_id": "evt_local_1",
                "name": "Hacker",
                "tier": "professional",
                "price": 25000,
                "capacity": 150,
            },
            {
                "id": "tix_pro",
                "event_id": "evt_summit_2026",
                "name": "Professional",
                "tier": "professional",
                "price": 120000,
                "capacity": 500,
            },
        ],
    }
    assert client.put("/api/v1/admin/catalogue", json=payload).status_code == 401

    response = client.put("/api/v1/admin/catalogue", json=payload, headers=HEADERS)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["events_upserted"] == 2 and body["ticket_types_upserted"] == 2
    assert body["ticket_types_deactivated"] == 2  # tix_student and tix_vip stop selling; tix_early was already inactive

    quote = client.get("/api/v1/events/neuro-hackathon-2027/tickets/tix_hack/quote").json()
    assert quote["total"] == 29500
    renamed = client.get("/api/v1/events/neurotech-summit-2026").json()
    assert renamed["title"] == "NeuroTech Summit 2026 (renamed)"
    assert {t["code"] for t in renamed["ticket_types"] if t["active"]} == {"tix_pro"}
    assert client.get("/api/v1/events/neurotech-summit-2026/tickets/tix_pro/quote").json()["total"] == 141600

    # A second sync is idempotent.
    again = client.put("/api/v1/admin/catalogue", json=payload, headers=HEADERS).json()
    assert again["ticket_types_deactivated"] == 0

    bad = dict(
        payload,
        ticket_types=[{"id": "x", "event_id": "missing", "name": "X", "tier": "vip", "price": 1, "capacity": 1}],
    )
    assert client.put("/api/v1/admin/catalogue", json=bad, headers=HEADERS).status_code == 400
