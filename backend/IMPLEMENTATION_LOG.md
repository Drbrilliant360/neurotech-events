# Backend Implementation Log

This is the durable handoff record for backend work. Add a new entry after each meaningful implementation slice so a future contributor can resume without reconstructing the entire Git history.

## Current snapshot

- Branch: `feat/backend`
- Backend style: FastAPI modular monolith
- API prefix: `/api/v1`
- Database foundation: SQLAlchemy with Alembic migrations
- Current completed phase: Phase 0
- Current active phases: Phase 1 — identity and authorization; Phase 2 — public catalogue; Phase 4 — payments
- Next priority: convert existing admin routes to scoped authorization, then expand attendee registration and operations

## Phase status

| Phase | Status | Current boundary |
| --- | --- | --- |
| Phase 0 — Contract and scaffolding | Complete | FastAPI app, configuration, health/meta routes, database foundation, tests, Dockerfile and CI |
| Phase 1 — Identity and authorization | In progress | User accounts, JWT/current-user flows, organization memberships, event assignments, scoped access and protected assignment mutations exist; broader route conversion remains |
| Phase 2 — Public events and program | Partial | Event, venue and ticket schema, deterministic seed, public event reads and server-side ticket quotes |
| Phase 3 — Ticketing and registration | Partial | Payment flow creates registrations with capacity checks; standalone registration APIs remain |
| Phase 4 — Payments | In progress | Snippe adapter, server-side pricing, polling, signed webhooks, audit events and admin views |
| Phase 5 — Attendee experience | Not started | Dashboard, schedules, networking, notifications and certificates |
| Phase 6 — Operations and check-in | Not started | Scoped check-in, audit history and exports |
| Phase 7 — Communications, media and scale | Not started | Workers, providers, storage, observability and retention |

## Completed work

### 2026-09-24 — Documentation collaboration baseline

- Added this append-only implementation log.
- Added [`Collaboration.md`](./Collaboration.md) with branch, implementation, validation and documentation rules.
- Established the requirement to update the phase table and this log after each backend slice.
- Validation: documentation-only change; no runtime checks required.

### 2026-09-24 — Local runtime and migration onboarding

- Corrected Alembic and Uvicorn commands so they run from the `backend/` directory where the configured relative paths resolve.
- Documented the deterministic local flow: migrate, seed the catalogue, start FastAPI, then start Vite with `VITE_API_BASE_URL`.
- Documented recovery for stale generated SQLite files that refer to migration revisions no longer in the current chain.
- Updated the ticket-code migration to use Alembic batch mode, making fresh SQLite upgrades and downgrades work as documented.
- Synchronized the phase table with the implemented public catalogue and Snippe payment functionality.
- Validation: backend tests, Ruff, frontend lint/build, fresh SQLite upgrade/check/downgrade.

### 2026-09-24 — Neon production branch setup

- Linked the repository to Neon project `orange-poetry-49886498`, production branch.
- Added the ignored Neon CLI files and generated local environment variables.
- Added `neon.ts` with the requested empty Neon configuration policy.
- Normalized Neon’s standard `postgresql://` connection URL to the installed Psycopg 3 SQLAlchemy driver.
- `neon config plan` and `neon deploy` completed with no policy changes.
- Applied the Alembic schema to Neon production and seeded 1 organization, 6 venues, 7 events and 10 ticket types.
- Verified the live API against Neon with `/health` and `/api/v1/events`.

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

## 2026-09-24 — Scoped authorization foundation

- Added organization memberships with owner, admin, finance and member roles.
- Added event staff assignments with manager, staff, check-in and speaker roles.
- Added `GET /api/v1/authorization/events/{event_id}` for effective event access.
- Added protected membership and event-assignment upsert/deactivation endpoints.
- Added reusable service-level checks for organization managers and event managers, preserving `401`, `403` and `404` semantics.
- Added Postman requests for the authorization contract.
- Validation: Ruff, 32 backend tests, and frontend checks all pass.
- Follow-up: add dedicated mutation endpoint tests, authorization ADR, and migrate existing catalogue/payment admin routes to scoped checks.

## Next implementation slices

1. Add organization and membership models with migrations.
2. Define role and permission checks for platform, organization and event scopes.
3. Add authorization dependencies and explicit `401`/`403` tests.
4. Add refresh-token/session revocation, email verification and password-reset design.
5. Record the identity/authorization decision in an ADR.
6. Begin Phase 2 public event and program read models only after the authorization boundary is stable.
