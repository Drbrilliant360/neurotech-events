# Backend Implementation Log

This is the durable handoff record for backend work. Add a new entry after each meaningful implementation slice so a future contributor can resume without reconstructing the entire Git history.

## Current snapshot

- Branch: `feat/backend`
- Backend style: FastAPI modular monolith
- API prefix: `/api/v1`
- Database foundation: SQLAlchemy with Alembic migrations
- Current completed phases: Phase 0, Phase 2
- Current active phases: Phase 1 (email verification/reset), Phase 3 and 4 (refunds), Phase 6 (offline check-in)
- Next priority: refunds through Snippe, then an email/SMS provider; Neon is deferred while testing runs on local PostgreSQL

## Phase status

| Phase | Status | Current boundary |
| --- | --- | --- |
| Phase 0 — Contract and scaffolding | Complete | FastAPI app, configuration, health/meta routes, database foundation, tests, Dockerfile and CI |
| Phase 1 — Identity and authorization | Mostly complete | Rotating refresh tokens, revocation, password change, rate limits, audit log, scoped capabilities on every organiser route and team management by email; email verification and password reset remain |
| Phase 2 — Public events and program | Complete | Public list/detail/programme/speakers/quotes; organiser CRUD for events, tickets, sessions, milestones, speakers and venues |
| Phase 3 — Ticketing and registration | Mostly complete | Oversell-safe checkout with seat holds and sales windows, attendee QR tickets, complimentary tickets and organiser cancellation; refunds remain |
| Phase 4 — Payments | In progress | Snippe adapter, server-side pricing, throttled polling, signed race-safe webhooks, late-payment recovery, audit events, platform and event-scoped finance views; refunds remain |
| Phase 5 — Attendee experience | Mostly complete | Saved sessions, opt-in networking, in-app notifications, certificates with public verification; external notification channels remain |
| Phase 6 — Operations and check-in | Mostly complete | Camera QR scanning in the console, signed-QR/ticket-number check-in with undo, door lookup, attendee list, CSV export, event summary and audit trail; offline check-in remains |
| Phase 7 — Communications, media and scale | In progress | Organiser communications and sponsors on the server with in-app delivery; email/SMS providers, workers, storage, observability and retention remain |

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

### 2026-09-24 — Attendee registration ownership

- Added authenticated payment ownership: mobile payments associate the attendee record with the authenticated user when a bearer token is supplied.
- Added attendee registration list, detail and cancellation routes.
- Enforced ownership checks so one attendee cannot access another attendee's registration.
- Pending registrations can be cancelled and release open payment intents; confirmed registrations remain protected for a future refund workflow.
- Added Postman requests and API tests for registration ownership and cancellation.
- Validation: Ruff, 37 backend tests, frontend checks and Alembic consistency check all pass.

### 2026-09-24 — OWASP and DevSecOps baseline

- Rejected the development JWT secret and wildcard CORS in production/staging settings.
- Restricted the compatibility static admin token to development/test environments.
- Added browser security headers, including HSTS in production/staging.
- Added configuration security tests and documented the OWASP/API Security and DevSecOps baseline in [`SECURITY.md`](./SECURITY.md).
- Follow-up: add token rotation/revocation, rate limiting, security audit events and CI SAST/DAST/dependency checks.

### 2026-09-25 — Production hardening and organiser API

Phases 1, 2, 3, 4 and 6. Commits on `feat/backend`, one per slice:

1. **Runtime** (`feat(api): harden runtime, errors and database pooling`): pure ASGI middleware for
   request ids, security headers, access logs and a request body limit; GZip; readiness probe
   (`/health/ready`); generic 500/503/409 envelopes that never echo input; docs hidden in
   production; PostgreSQL pool settings; non-root Docker image with a health check.
2. **Sessions** (`feat(auth): ...`): rotating refresh tokens with reuse detection, logout,
   logout-all, password change, `token_version` revocation, issuer/audience/type claims,
   constant-time unknown-email login, per-IP and per-account rate limits, `audit_logs`.
   Migration `b7e1c4d2a9f3`. Access tokens issued before this change are rejected (users sign in again).
3. **Checkout integrity** (`fix(payments): ...`): ticket row lock, event capacity, registration and
   sales windows, seat holds for pending registrations, hold committed before the provider call,
   seat released on provider rejection, late collections honoured, throttled polling, race-safe
   webhook inserts, 40-bit ticket numbers. Migration `c5a2f8e7d1b4` adds hot-path indexes.
   Contract change: sold-out conflicts now return error code `sold_out`.
4. **Event management** (`feat(api): add scoped event management for organisers`): organiser CRUD
   and status transitions, speaker/venue directories, public programme/speakers and list filters,
   cache headers. Organization owners/admins now have finance access.
5. **Operations** (`feat(api): add event operations, check-in and reporting`): attendee list,
   CSV export, complimentary tickets, organiser cancellation, signed-QR check-in, door lookup,
   summary, event payments, audit trail, attendee ticket endpoint.
6. **Migrations** (`fix(db): ...`): the original migrations used a literal `now()` default that
   SQLite rejects on insert; replaced with `sa.func.now()`. No effect on already-migrated PostgreSQL.
7. **Review fixes** (`fix(api): close races and abuse paths found in review`): an independent review
   found that a webhook landing during checkout could be overwritten, late payments needed a
   webhook to be recovered, event-wide capacity could be oversold across ticket types on
   PostgreSQL, per-account login limits let anyone lock a user out, shared speakers/venues were
   editable across organizations, and chunked oversized bodies returned 400. All fixed with tests
   (the event-row lock is PostgreSQL-only and not exercised by the SQLite suite).

Validation: Ruff clean; 97 backend tests (including a real Alembic upgrade/check/downgrade run on
SQLite); end-to-end smoke test against uvicorn on a scratch SQLite database (organiser flow,
check-in, CSV, programme, refresh, gzip, 413); p50 latency 1–2 ms locally for catalogue, quote and
admin reads. Not yet validated: migrations `b7e1c4d2a9f3` and `c5a2f8e7d1b4` against Neon
PostgreSQL; run them on a Neon branch before production.

Follow-up: frontend refresh-token handling and organiser screens; provider refunds; email
verification and password reset; offline check-in; dedicated QR signing key; CI security scans.

### 2026-09-27 — Organiser team, Neurotech Africa catalogue and end-to-end check

Phases 1 and 2.

- **Team API** (`feat(api): manage organiser team members and event staff by email`):
  `GET/POST /admin/organizations/{id}/team` and `POST /admin/events/{id}/staff` resolve colleagues by
  sign-up email. Only owners grant owner and nobody changes their own role; removal reuses the
  `/authorization` DELETE routes. Postman folder "Admin - Team and roles" added.
- **Settings fix**: `PATCH /admin/organizations/{id}` now saves `contact_phone`, `default_city` and
  `default_country` (they were silently dropped).
- **Frontend admin**: `/admin/speakers`, `/admin/venues` and `/admin/team` pages on the organiser API.
- **Catalogue**: the seed is themed on Neurotech Africa (Summit, Sarufi, Ghala, SemaCall, Snippe,
  Generative AI Tanzania meetup/hackathon) with company contact details from neurotech.africa.
  `seed_programme()` adds product-team speakers and the summit programme from the CLI only. Event keys
  and ticket codes are unchanged; every slug except the summit changed (`sarufi-ai-agents-workshop`,
  `ghala-whatsapp-commerce-clinic`, `snippe-payments-developer-day`, `generative-ai-tanzania-meetup`,
  `generative-ai-tanzania-hackathon-2025`). Dates and prices are placeholders for the events team.
- **Neon**: the `development` branch was already at head (`c5a2f8e7d1b4`) and was re-seeded.
  Production was **not** migrated in this session; run `alembic upgrade head` against it.

Validation: Ruff clean; 117 backend tests; frontend lint and build; a scripted API run against
uvicorn + Neon development (attendee sign-up/login/refresh reuse detection/logout revocation, free
registration and signed QR ticket, admin login, workspace, team add/remove, speaker CRUD, QR check-in,
duplicate rejection and undo); and a headless-Chrome run of the real UI (home/about/partners content,
account creation landing in `/app`, admin sign-in landing in `/admin`, speakers/venues/team pages,
speaker create and delete) with no console errors.

### 2026-09-27 — Attendee engagement and organiser outreach on the server

Phases 5 and 7. No schema change: the tables were in the initial migration.

- `/me/schedule`, `/me/networking` (+ `PUT /me/networking/profile`), `/me/notifications`,
  `/me/certificates` and public `GET /certificates/{code}/verify`.
- Networking privacy: the directory lists only opted-in profiles of attendees who share a confirmed
  registration with the caller, never contact details; connecting follows the same rule.
- Notifications are created for free, paid and complimentary confirmations, certificates and
  organiser messages (`app/services/notifications.py`, free of service imports to avoid cycles).
- Certificates: issued on read (and via `POST /admin/events/{id}/certificates/issue`) for confirmed,
  checked-in attendees of completed events; 48-bit codes.
- Sponsors CRUD (directory-style permissions) and public sponsors in `/catalogue` without contacts.
- Event communications: drafts, edit/delete, and send with a row lock; delivery is in-app to the chosen
  audience and the response reports `external_delivery: not_configured`.
- Frontend live mode no longer uses the demo store for any of these collections.

Validation: Ruff clean; 126 backend tests (9 new); frontend lint and build; headless Chrome against
uvicorn + local PostgreSQL 18 (admin creates a sponsor that appears on /partners, sends a message the
attendee receives, attendee marks notices read, saves a session that survives reload, creates a
networking profile, loads certificates, and verification rejects an unknown code), no console errors.

### 2026-09-27 — Camera QR check-in

Phase 6 (frontend only; the API already verified signed payloads).

- `src/components/shared/QrScanner.tsx`: rear camera via `getUserMedia`, native `BarcodeDetector` where
  available, lazy-loaded `jsqr` fallback (Apache-2.0) otherwise; 3-second repeat cooldown; scanning
  pauses during a request; tracks stop on close; clear messages for blocked permission, missing or busy
  camera, and insecure origins (the camera needs HTTPS or localhost).
- Check-in page: colour-coded result in one polite live region; mock scanner kept for demo mode only.
- Signed `NTQ1` payloads are routed to their event by registration id before calling the API.
- `docs/IMPLEMENTATION_PLAN.md` now records the current snapshot and a status for every phase.

Validation: frontend lint and build; headless Chrome with a fake camera streaming a real signed ticket
QR against uvicorn + local PostgreSQL, run twice (native detector, and with `BarcodeDetector` removed to
force jsQR): the scan checks the attendee in, the ticket still in frame is then reported as already
checked in, jsQR downloads only for the fallback, closing the camera resets the page, no page errors.

## Next implementation slices

1. Apply `b7e1c4d2a9f3` and `c5a2f8e7d1b4` to Neon production (development is at head).
2. Offline/poor-network check-in strategy and a dedicated QR signing key.
3. Refund workflow through the provider for organiser cancellations flagged `refund_required`.
4. Email verification and password reset once an email provider contract exists.
5. Email/SMS provider for communications, password reset and verification.
6. Add `pip-audit`, secret scanning and SAST to backend CI.
