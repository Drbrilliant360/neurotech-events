# Neurotech Events Backend

This directory is reserved for the FastAPI backend of Neurotech Events.

The repository is intentionally being evolved as a monorepo:

- the existing React/Vite application remains the frontend;
- the FastAPI application will provide the production API;
- both applications share product documentation and are validated through GitHub Actions;
- deployment can scale each application independently without splitting the repository prematurely.

Phase 0 scaffolding, the identity foundation, the full persistence schema and live mobile-money payments are implemented. Remaining business domains are delivered incrementally. This document is both the implementation contract and the current handoff ledger for agents and contributors who continue the backend.

## Current implementation status

Integration branch: `masterchanges`, merged into `main` through pull requests (see `AGENTS.md` and `docs/GIT_WORKFLOW.md`). The earlier `feat/backend` branch has been merged and retired.

Phase status:

| Phase | Status | Notes |
| --- | --- | --- |
| Phase 0 — Contract and scaffolding | Complete | FastAPI app, configuration, health/meta routes, SQLAlchemy/Alembic foundation, tests, Dockerfile and backend CI |
| Phase 1 — Identity and authorization | In progress | `users` (UUID, role enum) linked to `attendees`, Argon2 hashing, JWT login, current-user/profile routes, `platform_admin` gate on admin routes, `python -m app.db.create_admin` |
| Phase 2 — Public events and program | Schema ready | Tables and demo seed exist (`python -m app.db.seed`); public read endpoints pending |
| Phase 3 — Ticketing and registration | Partial | Registrations are created server-side by the payment flow with capacity checks; no stored `sold` counter |
| Phase 4 — Payments | In progress | Snippe mobile money live: server-side pricing, signed webhooks, polling verification, `payment_events` audit trail, super-admin transaction views |
| Phase 5 — Attendee experience | Not started | Dashboard, schedule, networking, notifications and certificates |
| Phase 6 — Operations and check-in | Not started | Scoped check-in, audit history and exports |
| Phase 7 — Communications, media and scale | Not started | Workers, providers, storage, observability and retention |

History lives in `git log main`; the identity work from `feat/backend` and the schema/payments work from `masterchanges` were unified in one merge so Alembic keeps a single revision chain.

## Backend objectives

The backend must replace the current browser-only demo repository with server-owned:

- identity, authentication and authorization;
- organizations and event-level administration;
- events, venues, speakers and sessions;
- ticket types, inventory and ticket entitlements;
- registrations and attendee profiles;
- payment intents, provider callbacks, refunds and receipts;
- attendee schedules, networking and notifications;
- check-in and audit history;
- communications, sponsors, certificates and reports.

The frontend reference implementation is under `src/`. Important current contracts are in:

- `src/domain/types.ts`
- `src/app/router/AppRouter.tsx`
- `src/app/providers/PlatformProvider.tsx`
- `src/repositories/platform.ts`
- `src/data/seed/database.ts`

The Postman contract for the planned API is under `postman/`.

## Recommended architecture

Start with a **modular monolith**, not microservices.

The backend should have one deployable FastAPI application and explicit internal domain modules. This gives the team:

- one transactional database boundary;
- simpler local development and deployment;
- one versioned API for the frontend;
- clear ownership boundaries;
- a future path to extract high-scale modules such as payments or communications.

The backend must not expose SQLAlchemy models directly from route handlers. Keep these boundaries:

```text
HTTP router -> Pydantic schema -> application service -> domain rules -> repository -> database
                                                     |
                                                     +-> external integration ports
```

Recommended layout:

```text
backend/
  README.md
  pyproject.toml
  .env.example
  Dockerfile
  alembic.ini
  app/
    main.py
    config.py
    logging.py
    api/
      deps.py
      errors.py
      v1/
        router.py
        auth.py
        public_events.py
        registrations.py
        payments.py
        attendee.py
        networking.py
        notifications.py
        certificates.py
        checkins.py
        admin_events.py
        admin_program.py
        admin_tickets.py
        admin_attendees.py
        admin_communications.py
        admin_sponsors.py
        admin_reports.py
        admin_settings.py
        webhooks.py
    domain/
      identity/
      organizations/
      events/
      program/
      ticketing/
      registrations/
      attendees/
      payments/
      checkin/
      communications/
      networking/
      certificates/
      reporting/
    schemas/
    services/
    repositories/
    integrations/
      payments/
      messaging/
      storage/
    db/
      session.py
      base.py
      models/
    migrations/
  tests/
    unit/
    integration/
    api/
```

The exact module names may evolve, but domain rules should remain separate from HTTP and persistence concerns.

## API conventions

All public API routes should be versioned:

```text
/api/v1/...
```

The initial API should expose:

- public event discovery and program data;
- authentication and current-user operations;
- attendee registration, ticketing, payments and personal data;
- admin event, program, ticket, attendee, check-in and reporting operations;
- provider webhooks.

Use:

- JSON request and response bodies;
- ISO 8601 timestamps with timezone information;
- opaque IDs;
- pagination for growing collections;
- consistent machine-readable error codes;
- `401` for unauthenticated requests;
- `403` for authenticated users without permission;
- `404` without leaking resource existence where appropriate;
- idempotency keys for registration, payment and check-in mutations.

FastAPI should publish:

```text
GET /health
GET /docs
GET /openapi.json
```

The OpenAPI document is the authoritative API contract. The Postman collection is a convenient manual testing client and must be updated when the contract changes.

## Data and security rules

The backend is authoritative for:

- roles and permissions;
- event lifecycle and registration windows;
- ticket prices and availability;
- payment status;
- refunds;
- attendee ownership;
- check-in eligibility;
- certificate eligibility.

Never trust these values from the browser.

Production requirements:

- PostgreSQL or an equivalent transactional relational database;
- Alembic migrations;
- server-side validation with Pydantic and domain rules;
- secure password hashing;
- secure session or short-lived token strategy defined by an ADR;
- event/organization-scoped authorization;
- audit records for money, identity, publishing, check-in and admin changes;
- secrets supplied through environment or deployment secret stores;
- no production credentials in this repository;
- structured logs without passwords, tokens or unnecessary personal data.

Payment integrations must use provider verification and signed webhooks. The frontend must never determine whether a payment succeeded.

## Database schema

The persistence layer lives in `app/db/models/` and is applied through Alembic. The baseline
migration `0e5f3e6a33fc_create_core_platform_tables` creates 21 tables that mirror the frontend
domain in `src/domain/types.ts` plus the Phase 1 identity models.

| Domain | Tables |
| --- | --- |
| Identity | `organizations`, `users`, `attendees` |
| Events and programme | `venues`, `events`, `speakers`, `sessions`, `timeline_milestones` |
| Ticketing and money | `ticket_types`, `registrations`, `payments`, `payment_events`, `check_ins`, `certificates` |
| Attendee engagement | `notifications`, `communications`, `networking_profiles`, `connections`, `saved_sessions` |
| Sponsors | `sponsors`, `sponsor_events` |

Conventions:

- UUID primary keys, timezone-aware timestamps, `Numeric(12, 2)` for money, ISO currency codes;
- enumerations are stored as strings with CHECK constraints (no native PostgreSQL enums), so
  adding a value is a plain migration;
- list fields (`highlights`, `faqs`, `interests`) are JSONB on PostgreSQL and JSON on SQLite;
- constraint and index names follow the naming convention in `app/db/base.py`, so Alembic diffs stay stable;
- every foreign key declares an explicit `ondelete` rule.

Deliberate departures from the frontend model:

- `ticket_types.tier` is an open string, not a closed enum, so organisers can add products without a deploy;
- there is no stored `sold` counter. Quantity sold is derived from `registrations` inside a transaction;
- `organizations` absorbs the frontend `OrganizationSettings` (VAT, currency, defaults, notification flags);
- `sponsor_events` replaces the `eventIds` array on sponsors;
- `payment_events` is an append-only audit trail of payment status transitions.

Migration workflow:

```bash
alembic upgrade head                                   # apply pending migrations
alembic revision --autogenerate -m "describe change"   # after editing models
alembic downgrade -1                                   # roll back one revision
```

New model modules must be imported in `app/db/models/__init__.py` or autogenerate will not see them.
Review every generated migration before applying it: Alembic does not add the
`from sqlalchemy.dialects import postgresql` import that JSONB variants need, and it does not
detect later changes to CHECK constraints.

## Payments (Snippe)

Mobile-money collections run through [Snippe](https://snippe.sh) (API `2026-01-25`, TZS only).
The server is the only authority on price, provider calls and confirmation:

```text
POST /api/v1/payments/mobile          price ticket from DB, reserve registration, push USSD prompt
GET  /api/v1/payments/{id}            current state; open payments are re-verified with Snippe
POST /api/v1/webhooks/snippe          signed provider events (HMAC-SHA256, 5-minute replay window, de-duplicated)
GET  /api/v1/admin/payments           every payment this platform created, with its audit trail
GET  /api/v1/admin/payments/provider  every transaction on the Snippe account, including other apps
GET  /api/v1/admin/payments/balance   live provider balance
POST /api/v1/admin/payments/{id}/verify  force a provider status check
```

Layout: `app/integrations/payments/snippe.py` (gateway adapter + `PaymentGateway` protocol),
`app/services/payments.py` (pricing, state machine, webhook handling), `app/schemas/payments.py`,
`app/api/v1/{payments,webhooks,admin_payments}.py`.

Rules enforced:

- the client sends an event slug and a ticket `code`; the amount is `price + VAT` from the database;
- payments below Snippe's 500 TZS minimum are refused (free tickets never touch the provider);
- our payment reference doubles as the Snippe `Idempotency-Key` (max 30 characters);
- every status change is appended to `payment_events`; terminal states never regress;
- `paid` confirms the registration, `cancelled`/`expired` releases the seat, `failed` leaves it pending for retry;
- webhooks are rejected unless `SNIPPE_WEBHOOK_SECRET` is set and the signature and timestamp verify;
  each event `id` is stored in `provider_webhook_events`, so redeliveries are no-ops;
- `/admin/*` requires `Authorization: Bearer $ADMIN_API_TOKEN` (interim gate until Phase 1 identity).

Configuration (`.env`): `SNIPPE_API_KEY`, `SNIPPE_WEBHOOK_SECRET`, `PUBLIC_BASE_URL` (HTTPS origin used to
build the webhook URL; leave empty locally and the API verifies by polling), `ADMIN_API_TOKEN`, `CORS_ORIGINS`.

Seed the demo catalogue the API prices against (idempotent):

```bash
python -m app.db.seed
```

Testing: `tests/conftest.py` provides a `FakeGateway`; no test calls Snippe. To exercise a real
payment, run the frontend with `VITE_API_BASE_URL` set, register for a paid ticket and approve the
prompt on your own phone (minimum 500 TZS). Never commit `.env`.

## Phased delivery plan

### Phase 0 — Contract and scaffolding

Status: **complete**.

Deliver:

- backend architecture ADR;
- FastAPI application factory;
- configuration and `.env.example`;
- health endpoint;
- `/api/v1` router;
- database session and migration baseline;
- error envelope;
- CI job that installs and validates the backend;
- initial OpenAPI metadata.

Implemented endpoints:

```text
GET /health
GET /api/v1/meta
GET /docs
GET /openapi.json
```

Validation completed:

```text
ruff check backend
pytest backend/tests
alembic current
alembic upgrade head
```

Exit criteria:

- the backend starts locally;
- `/health`, `/docs` and `/openapi.json` work;
- no domain workflow is implemented yet;
- frontend CI remains green.

### Phase 1 — Identity and authorization

Status: **in progress**.

Deliver:

- user/account model;
- attendee profile model;
- organization model;
- roles and permissions;
- registration/login/logout/current-user flows;
- protected route dependencies;
- event-level authorization policy;
- tests for ownership and forbidden access.

Current implementation includes:

- persisted `users` table (UUID ids, `role` enum) in the baseline migration;
- attendee records in `attendees`, linked by `attendees.user_id`; guest registrations made before sign-up attach to the account by email;
- attendee default role;
- Argon2 password hashing;
- JWT access-token issuance;
- registration and login endpoints;
- authenticated `GET /api/v1/auth/me`;
- authenticated `PATCH /api/v1/auth/me`;
- frontend-compatible `GET /api/v1/me`;
- frontend-compatible `PATCH /api/v1/me`;
- normalized email addresses and duplicate-email protection;
- profile fields for phone, organization, job title, country and interests;
- `platform_admin` role accepted by the admin payment routes (alongside the static `ADMIN_API_TOKEN`);
- duplicate-email and invalid-credential tests.

Validation currently covers registration, login, invalid credentials, duplicate email, protected current-user access and profile updates.

Still required before Phase 1 is complete:

- organization membership model (the `organizations` table exists);
- permission model beyond the role enum;
- `event_staff`, `event_admin` and `platform_admin` authorization;
- event-scoped access checks;
- refresh-token/session revocation strategy;
- password reset;
- email verification;
- explicit `401`, `403` and resource-ownership tests;
- authentication/authorization ADR.

Recommended initial roles:

```text
attendee
event_staff
event_admin
platform_admin
```

### Phase 2 — Public events and program

Status: **not started**. Do not implement event administration or protected event resources until the Phase 1 authorization boundary is defined.

Deliver:

- venues;
- events and lifecycle;
- speakers;
- rooms/tracks if required;
- sessions;
- public list/detail endpoints;
- admin event and session management;
- slug uniqueness and publish validation.

Connect the frontend public routes only after response schemas are stable.

### Phase 3 — Ticketing and registration

Status: **not started**.

Deliver:

- ticket types;
- inventory reservations;
- registration creation and cancellation;
- ticket entitlements;
- duplicate registration policy;
- capacity enforcement;
- idempotency;
- attendee registration and ticket endpoints.

Inventory must be updated transactionally. Do not recreate the frontend `sold` counter as the only source of truth.

### Phase 4 — Payments

Status: **not started**.

Deliver:

- payment intent abstraction;
- provider adapter interface;
- payment attempts;
- webhook verification;
- reconciliation;
- refunds;
- receipts;
- payment audit events.

Begin with a deterministic fake provider for development and tests. Add a real provider only after its contract and secrets are approved.

### Phase 5 — Attendee experience

Status: **not started**.

Deliver:

- dashboard read model;
- personal schedule;
- networking;
- notifications;
- profile preferences;
- event history;
- certificate eligibility and verification.

### Phase 6 — Operations and check-in

Status: **not started**.

Deliver:

- scoped attendee search;
- check-in token/QR contract;
- check-in and undo audit history;
- offline requirements decision;
- admin exports;
- operational reports.

### Phase 7 — Communications, media and scale

Status: **not started**.

Deliver:

- communications and audience resolution;
- provider delivery records and retries;
- consent/unsubscribe handling;
- object storage and signed media URLs;
- background workers;
- rate limiting;
- observability and alerting;
- retention and deletion workflows.

## Monorepo and shipping strategy

Keep the backend in this repository under `backend/` for now. This is the best choice because the frontend and backend share:

- one product domain;
- one API contract;
- one Postman collection;
- one pull-request review process;
- coordinated feature delivery.

Deployments should still be independently buildable:

```text
frontend artifact -> static hosting/CDN
backend artifact   -> container/platform runtime
database           -> managed PostgreSQL
workers            -> separate process using the same backend package
```

Use path-aware CI so frontend-only changes do not require backend deployment, while backend changes run backend checks. A production pipeline should eventually contain:

1. frontend lint/type/build;
2. backend format/lint/type/test;
3. migration validation;
4. OpenAPI contract validation;
5. dependency and secret scanning;
6. container build;
7. deploy to staging;
8. smoke tests;
9. controlled production promotion.

Database migrations must run as a deliberate deployment step. Application startup should not silently mutate production schemas.

## Local development target

The eventual local development commands should be documented here as the backend is implemented. The expected shape is:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Connecting to PostgreSQL (Neon)

The default `.env` points at a local SQLite file. To use a managed PostgreSQL database such as Neon, set `DATABASE_URL` in `.env` to the connection string using the `postgresql+psycopg://` scheme with TLS required:

```bash
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST/DBNAME?sslmode=require&channel_binding=require
```

The `psycopg` (v3) driver is installed with the project dependencies. `.env` is gitignored; never commit a real connection string. Neon's pooled endpoint (the `-pooler` host) is suitable for the running API. Neon recommends the direct endpoint for migration tooling if the pooler causes session-level issues.

The frontend should continue to run separately:

```bash
npm ci
npm run dev
```

The frontend API base URL should be configured through a browser-safe Vite variable once API integration starts.

## Resume checklist for the next agent

Before changing code:

```bash
git switch masterchanges
git pull --ff-only origin masterchanges
git status
```

Read this file and then inspect:

- `backend/app/db/models/`
- `backend/app/schemas/auth.py`
- `backend/app/services/auth.py`
- `backend/app/api/v1/auth.py`
- `backend/app/services/payments.py`
- `backend/tests/test_auth.py`
- `backend/tests/test_payments_api.py`
- `docs/SYSTEM_ENGINEERING.md`
- `postman/neurotech-events.postman_collection.json`

The next recommended implementation slice is **organization membership and authorization**: define the permission matrix, add membership migrations and schemas, protect the remaining admin routes with server-side dependencies, and add forbidden-access tests. Public event read endpoints are the slice after that.

After each coherent slice:

```bash
backend/.venv/bin/ruff check backend
backend/.venv/bin/pytest backend/tests
git diff --check
git add backend
git commit -m "<imperative scoped message>"
git push origin masterchanges
```

Do not commit `.env`, `.venv`, SQLite databases, `__pycache__`, `.pytest_cache`, `.ruff_cache` or `*.egg-info`.

## Definition of done for backend phases

Every phase must include:

- domain and API schemas;
- authorization rules;
- migration(s);
- unit tests for business invariants;
- API/integration tests for successful and rejected requests;
- updated OpenAPI/Postman contract;
- structured error handling;
- documentation of security and operational impact;
- CI validation;
- a focused pull request.

Do not begin the next phase by hiding unfinished behavior behind broad mocks. Mocks are acceptable at explicit integration boundaries, especially payment and messaging providers, but domain rules must be real and tested.