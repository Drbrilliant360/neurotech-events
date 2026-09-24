# Backend Implementation Log

This is the durable handoff record for backend work. Add a new entry after each meaningful implementation slice so a future contributor can resume without reconstructing the entire Git history.

## Current snapshot

- Branch: `feat/backend`
- Backend style: FastAPI modular monolith
- API prefix: `/api/v1`
- Database foundation: SQLAlchemy with Alembic migrations
- Current completed phase: Phase 0
- Current active phase: Phase 1 — identity and authorization
- Next priority: complete organization membership and event-scoped authorization before implementing event APIs

## Phase status

| Phase | Status | Current boundary |
| --- | --- | --- |
| Phase 0 — Contract and scaffolding | Complete | FastAPI app, configuration, health/meta routes, database foundation, tests, Dockerfile and CI |
| Phase 1 — Identity and authorization | In progress | User accounts, attendee profiles, password hashing and JWT/current-user flows exist; authorization boundaries remain |
| Phase 2 — Public events and program | Not started | Events, venues, speakers, sessions and public read APIs |
| Phase 3 — Ticketing and registration | Not started | Ticket types, transactional inventory, registrations and entitlements |
| Phase 4 — Payments | Not started | Payment intents, provider callbacks, reconciliation, refunds and receipts |
| Phase 5 — Attendee experience | Not started | Dashboard, schedules, networking, notifications and certificates |
| Phase 6 — Operations and check-in | Not started | Scoped check-in, audit history and exports |
| Phase 7 — Communications, media and scale | Not started | Workers, providers, storage, observability and retention |

## Completed work

### 2026-09-24 — Documentation collaboration baseline

- Added this append-only implementation log.
- Added [`Collaboration.md`](./Collaboration.md) with branch, implementation, validation and documentation rules.
- Established the requirement to update the phase table and this log after each backend slice.
- Validation: documentation-only change; no runtime checks required.

### Previous identity foundation

The backend branch already contains the following implemented slices:

- FastAPI scaffolding and versioned API router.
- Health, metadata and OpenAPI endpoints.
- SQLAlchemy session and Alembic migration infrastructure.
- User model and user-table migration.
- Attendee profile model and profile-table migration.
- Argon2 password hashing.
- JWT login and bearer-token authentication.
- Registration, duplicate-email handling and invalid-credential handling.
- `GET /api/v1/me` and `PATCH /api/v1/me`.
- Backend tests, Docker packaging and GitHub Actions validation.

Refer to Git history for the exact commit associated with each earlier slice.

## Decisions and constraints

- Keep backend implementation on the long-lived `feat/backend` branch.
- Use a modular monolith before considering service extraction.
- Keep organization membership and event-scoped authorization ahead of event administration.
- Treat payment-provider webhooks as authoritative; never trust a browser-selected payment result.
- Do not model ticket availability as only a mutable `sold` counter.
- Keep the frontend’s local repository behavior intact until API contracts are implemented and integrated incrementally.

## Next implementation slices

1. Add organization and membership models with migrations.
2. Define role and permission checks for platform, organization and event scopes.
3. Add authorization dependencies and explicit `401`/`403` tests.
4. Add refresh-token/session revocation, email verification and password-reset design.
5. Record the identity/authorization decision in an ADR.
6. Begin Phase 2 public event and program read models only after the authorization boundary is stable.
